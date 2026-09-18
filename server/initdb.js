require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const mongoose = require('mongoose')

const sqlDir = path.join(__dirname, '..', 'sql')

async function runSql(conn, file) {
    const full = path.join(sqlDir, file)
    const text = fs.readFileSync(full, 'utf8')
    await conn.query(text)
    console.log('ran', file)
}

async function runRoutines(conn) {
    await conn.query('DROP PROCEDURE IF EXISTS sp_upsert_rating')
    await conn.query('DROP PROCEDURE IF EXISTS sp_movie_breakdown')
    await conn.query('DROP FUNCTION IF EXISTS fn_avg_rating')

    await conn.query(`
CREATE PROCEDURE sp_upsert_rating(
    IN p_user_id INT,
    IN p_movie_id INT,
    IN p_rating TINYINT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_rating < 1 OR p_rating > 10 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rating must be 1-10';
    END IF;

    START TRANSACTION;

    INSERT INTO ratings (user_id, movie_id, rating)
    VALUES (p_user_id, p_movie_id, p_rating)
    ON DUPLICATE KEY UPDATE
        rating = p_rating,
        rated_at = CURRENT_TIMESTAMP;

    COMMIT;
END`)

    await conn.query(`
CREATE PROCEDURE sp_movie_breakdown(IN p_movie_id INT)
BEGIN
    SELECT m.movie_id, m.title, m.release_year, m.runtime, m.description,
           fn_avg_rating(m.movie_id) AS avg_rating
    FROM movies m
    WHERE m.movie_id = p_movie_id;

    SELECT k.keyword_id, k.name
    FROM keywords k
    JOIN movie_keywords mk ON mk.keyword_id = k.keyword_id
    WHERE mk.movie_id = p_movie_id
    ORDER BY k.name;

    SELECT p.person_id, p.name, mp.role, mp.character_name, mp.credit_order
    FROM movie_people mp
    JOIN people p ON p.person_id = mp.person_id
    WHERE mp.movie_id = p_movie_id
    ORDER BY mp.credit_order IS NULL, mp.credit_order, mp.role, p.name;

    SELECT u.username, r.rating, r.rated_at
    FROM ratings r
    JOIN users u ON u.user_id = r.user_id
    WHERE r.movie_id = p_movie_id
    ORDER BY r.rated_at DESC;
END`)

    await conn.query(`
CREATE FUNCTION fn_avg_rating(p_movie_id INT)
RETURNS DECIMAL(4,2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v DECIMAL(4,2);
    SELECT ROUND(AVG(rating), 2) INTO v
    FROM ratings
    WHERE movie_id = p_movie_id;
    RETURN v;
END`)

    console.log('routines ok')
}

async function seedMongo() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/moviedb'
    await mongoose.connect(uri)
    const db = mongoose.connection.db
    await db.collection('movie_reviews').deleteMany({})
    await db.collection('review_metadata').drop().catch(() => {})

    // docs are deliberately not the same shape. numeric scores live in MySQL only.
    await db.collection('movie_reviews').insertMany([
        {
            movieId: 1,
            userId: 1,
            review: 'watched this for class. the opening wedding is basically a short film on its own',
            tags: ['classic', 'family', 'crime'],
            watchedOn: { platform: 'Blu-ray', date: '2025-09-12' },
            metadata: { sentiment: 'positive', helpfulVotes: 14 }
        },
        {
            movieId: 1,
            userId: 7,
            review: 'second time seeing it. brando barely talks and still owns every scene',
            language: 'en'
        },
        {
            movieId: 2,
            userId: 4,
            review: 'the stairs shot. i paused it. also the peach is not a joke i guess',
            tags: ['class', 'thriller'],
            spoiler: false,
            watchedOn: { platform: 'Netflix', date: '2025-10-04' },
            metadata: { sentiment: 'positive', helpfulVotes: 22, awards: ['oscar'], spoilerRisk: 'high' }
        },
        {
            movieId: 2,
            userId: 9,
            review: 'rewatch hit different after knowing the turn. still not spoiling it here',
            tags: ['rewatch']
        },
        {
            movieId: 3,
            userId: 5,
            review: 'looks expensive. i lost the plot in the snow part and did not care enough to rewind',
            spoiler: true,
            metadata: { sentiment: 'mixed', helpfulVotes: 5, confusing: true }
        },
        {
            movieId: 3,
            userId: 8,
            review: 'hotel hallway fight is the whole movie for me',
            tags: ['action', 'dreams'],
            watchedOn: { platform: 'Cinema', date: '2010-07-22' }
        },
        {
            movieId: 4,
            userId: 2,
            review: 'no notes. the train bit made me actually anxious',
            tags: ['ghibli', 'animation'],
            language: 'en'
        },
        {
            movieId: 5,
            userId: 5,
            review: 'this is just editing and practical cars. loud in a good way',
            tags: ['action']
        },
        {
            movieId: 6,
            userId: 8,
            review: 'the deer. the sunken place. bingo.',
            tags: ['horror'],
            spoiler: true,
            extra: { jumpScares: false, ending: 'the one with the cops' },
            metadata: { sentiment: 'positive', helpfulVotes: 11, triggerWarnings: ['racism', 'surgery'] }
        },
        {
            movieId: 7,
            userId: 2,
            review: 'barely any music and it still works. the fire scene is obvious but i dont care',
            tags: ['romance'],
            watchedOn: { platform: 'Mubi', date: '2025-10-05' },
            metadata: { sentiment: 'positive', helpfulVotes: 8, language: 'fr' }
        },
        {
            movieId: 8,
            userId: 3,
            review: 'sorkin talking very fast for 2 hours. eisenberg is doing a bit and it works',
            tags: ['dialogue']
        },
        {
            movieId: 9,
            userId: 7,
            review: 'the amateur vs the runts. photography is insane for 2002',
            tags: ['crime'],
            language: 'pt-commentary'
        },
        {
            movieId: 10,
            userId: 10,
            review: 'not a feel good movie about jazz. fletcher is the point',
            tags: ['music', 'abuse'],
            watchedOn: { platform: 'Prime', date: '2026-03-22' },
            metadata: { sentiment: 'positive', helpfulVotes: 19, loud: true }
        },
        {
            movieId: 10,
            userId: 1,
            review: 'my wrists hurt watching the final set. that is all'
        },
        {
            movieId: 11,
            userId: 6,
            review: 'the pale man. i still think about the grapes',
            tags: ['fantasy', 'war'],
            spoiler: true
        },
        {
            movieId: 12,
            userId: 9,
            review: 'funnier than it has any right to be, then it is not funny at all',
            tags: ['crime', 'police'],
            watchedOn: { platform: 'File', date: '2026-03-05' },
            metadata: { sentiment: 'positive', helpfulVotes: 6, basedOnTrueCrime: true }
        },
        {
            movieId: 12,
            userId: 4,
            review: 'song kang-ho eating noodles in the rain is the whole character',
            language: 'en'
        }
    ])

    await db.collection('movie_reviews').createIndex({ movieId: 1 })
    await db.collection('movie_reviews').createIndex({ userId: 1 })
    await db.collection('movie_reviews').createIndex({ tags: 1 })

    console.log('mongo seed ok')
    await mongoose.disconnect()
}


async function main() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        multipleStatements: true
    })

    try {
        await conn.query('SET GLOBAL log_bin_trust_function_creators = 1')
    } catch (e) {}

    await runSql(conn, 'schema.sql')
    await conn.query('USE moviedb')
    await runRoutines(conn)
    await runSql(conn, 'seed.sql')
    await conn.end()

    await seedMongo()
    await require('./bulk').run()
    console.log('done')
}

main().catch(err => {
    console.log(err)
    process.exit(1)
})
