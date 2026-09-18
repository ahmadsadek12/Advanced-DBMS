require('dotenv').config()
const mysql = require('mysql2/promise')
const mongoose = require('mongoose')

const first = ['Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Quinn', 'Avery', 'Jamie', 'Taylor', 'Drew', 'Reese', 'Cameron', 'Skyler', 'Parker']
const last = ['Nguyen', 'Hassan', 'Okafor', 'Petrov', 'Silva', 'Berg', 'Khan', 'Walsh', 'Ito', 'Moreau', 'Costa', 'Nair', 'Olsen', 'Diaz', 'Kowalski']

function nameAt(i) {
    return first[i % first.length] + ' ' + last[Math.floor(i / first.length) % last.length] + (i >= 225 ? ' ' + i : '')
}

async function bulkMysql(conn) {
    await conn.query('USE moviedb')
    console.log('using moviedb')

    const [[{ m }]] = await conn.query('SELECT COUNT(*) m FROM movies')
    const [[{ maxM }]] = await conn.query('SELECT IFNULL(MAX(movie_id),0) maxM FROM movies')
    if (m < 100) {
        const rows = []
        for (let i = 1; rows.length + m < 100; i++) {
            const id = maxM + i
            const year = 1955 + (id % 70)
            const runtime = 80 + (id % 70)
            rows.push([id, 'Catalog Film ' + id, year, runtime, 'Extra catalogue title used to pad the movies table. Entry ' + id + '.'])
        }
        await conn.query('INSERT INTO movies (movie_id, title, release_year, runtime, description) VALUES ?', [rows])
    }

    const [[{ p }]] = await conn.query('SELECT COUNT(*) p FROM people')
    const [[{ maxP }]] = await conn.query('SELECT IFNULL(MAX(person_id),0) maxP FROM people')
    if (p < 100) {
        const rows = []
        for (let i = 0; rows.length + p < 100; i++) {
            const id = maxP + i + 1
            const y = 1930 + (id % 60)
            const mo = 1 + (id % 12)
            const d = 1 + (id % 28)
            rows.push([id, nameAt(id), y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'), null])
        }
        await conn.query('INSERT INTO people (person_id, name, date_of_birth, biography) VALUES ?', [rows])
    }

    const [[{ u }]] = await conn.query('SELECT COUNT(*) u FROM users')
    const [[{ maxU }]] = await conn.query('SELECT IFNULL(MAX(user_id),0) maxU FROM users')
    if (u < 100) {
        const rows = []
        for (let i = 1; rows.length + u < 100; i++) {
            const id = maxU + i
            const uname = 'user' + String(id).padStart(3, '0')
            rows.push([id, uname, uname + '@school.edu'])
        }
        await conn.query('INSERT INTO users (user_id, username, email) VALUES ?', [rows])
    }

    const [movies] = await conn.query('SELECT movie_id FROM movies ORDER BY movie_id')
    const [keywords] = await conn.query('SELECT keyword_id FROM keywords ORDER BY keyword_id')
    const [people] = await conn.query('SELECT person_id FROM people ORDER BY person_id')
    const [users] = await conn.query('SELECT user_id FROM users ORDER BY user_id')
    const movieIds = movies.map(r => r.movie_id)
    const keywordIds = keywords.map(r => r.keyword_id)
    const peopleIds = people.map(r => r.person_id)
    const userIds = users.map(r => r.user_id)

    const [[{ mk }]] = await conn.query('SELECT COUNT(*) mk FROM movie_keywords')
    if (mk < 100) {
        const rows = []
        const seen = new Set()
        for (let i = 0; rows.length + mk < 220 && i < 20000; i++) {
            const movie = movieIds[i % movieIds.length]
            const keyword = keywordIds[(i * 3) % keywordIds.length]
            const k = movie + ':' + keyword
            if (seen.has(k)) continue
            seen.add(k)
            rows.push([movie, keyword])
        }
        if (rows.length) {
            await conn.query('INSERT IGNORE INTO movie_keywords (movie_id, keyword_id) VALUES ?', [rows])
        }
    }

    const [[{ mp }]] = await conn.query('SELECT COUNT(*) mp FROM movie_people')
    if (mp < 100) {
        const rows = []
        const seen = new Set()
        const roles = ['director', 'actor', 'writer', 'producer']
        for (let i = 0; rows.length + mp < 220 && i < 20000; i++) {
            const movie = movieIds[i % movieIds.length]
            const person = peopleIds[(i * 5) % peopleIds.length]
            const role = roles[i % roles.length]
            const k = movie + ':' + person + ':' + role
            if (seen.has(k)) continue
            seen.add(k)
            const character = role === 'actor' ? 'Role ' + ((i % 40) + 1) : null
            const order = role === 'actor' ? 1 + (i % 5) : 0
            rows.push([movie, person, role, character, order])
        }
        if (rows.length) {
            await conn.query('INSERT IGNORE INTO movie_people (movie_id, person_id, role, character_name, credit_order) VALUES ?', [rows])
        }
    }

    const [[{ r }]] = await conn.query('SELECT COUNT(*) r FROM ratings')
    if (r < 100) {
        const rows = []
        const seen = new Set()
        for (let i = 0; rows.length + r < 400 && i < 50000; i++) {
            const user = userIds[i % userIds.length]
            const movie = movieIds[Math.floor(i / 3) % movieIds.length]
            const k = user + ':' + movie
            if (seen.has(k)) continue
            seen.add(k)
            const score = 1 + ((i * 7) % 10)
            rows.push([user, movie, score])
        }
        if (rows.length) {
            await conn.query('INSERT IGNORE INTO ratings (user_id, movie_id, rating) VALUES ?', [rows])
        }
    }

    await conn.query('DELETE FROM ratings WHERE movie_id BETWEEN 65 AND 72')

    const counts = await conn.query(`
        SELECT 'movies' t, COUNT(*) n FROM movies
        UNION ALL SELECT 'keywords', COUNT(*) FROM keywords
        UNION ALL SELECT 'movie_keywords', COUNT(*) FROM movie_keywords
        UNION ALL SELECT 'people', COUNT(*) FROM people
        UNION ALL SELECT 'movie_people', COUNT(*) FROM movie_people
        UNION ALL SELECT 'users', COUNT(*) FROM users
        UNION ALL SELECT 'ratings', COUNT(*) FROM ratings
        UNION ALL SELECT 'rating_log', COUNT(*) FROM rating_log
    `)
    console.log('mysql counts')
    for (const row of counts[0]) console.log(row.t, row.n)
}

async function bulkMongo() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/moviedb'
    await mongoose.connect(uri)
    const db = mongoose.connection.db
    const reviews = db.collection('movie_reviews')
    await db.collection('review_metadata').drop().catch(() => {})

    const nRev = await reviews.countDocuments()
    if (nRev < 100) {
        const docs = []
        const tagsPool = ['slow', 'rewatch', 'sound', 'ending', 'cast', 'boring', 'funny', 'long']
        const sent = ['positive', 'mixed', 'negative']
        for (let i = nRev; i < 110; i++) {
            const movieId = 1 + (i % 100)
            const userId = 1 + ((i * 3) % 100)
            const doc = {
                movieId,
                userId,
                review: 'catalog review ' + (i + 1)
            }
            if (i % 2 === 0) doc.tags = [tagsPool[i % tagsPool.length], tagsPool[(i + 3) % tagsPool.length]]
            if (i % 3 === 0) doc.watchedOn = { platform: i % 5 === 0 ? 'Cinema' : 'Stream', date: '2025-0' + (1 + (i % 9)) + '-12' }
            if (i % 4 === 0) doc.spoiler = i % 8 === 0
            if (i % 5 === 0) doc.language = i % 10 === 0 ? 'en' : 'other'
            if (i % 3 === 0) {
                doc.metadata = { sentiment: sent[i % 3], helpfulVotes: i % 40 }
                if (i % 6 === 0) doc.metadata.padded = true
            }
            docs.push(doc)
        }
        if (docs.length) await reviews.insertMany(docs)
    }

    console.log('mongo reviews', await reviews.countDocuments())
    await mongoose.disconnect()
}

async function run() {
    console.log('connecting mysql')
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        multipleStatements: true
    })
    await bulkMysql(conn)
    await conn.end()
    await bulkMongo()
    console.log('bulk done')
}

if (require.main === module) {
    run().catch(err => {
        console.log(err)
        process.exit(1)
    })
}

module.exports = { run }
