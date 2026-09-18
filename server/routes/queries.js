const express = require('express')
const { q } = require('../db')
const { Review } = require('../models')

const router = express.Router()

const sqlQueries = [
    {
        id: 'top_movies',
        title: 'Highest rated movies (min 4 ratings)',
        note: 'JOIN + GROUP BY + HAVING. Filters out movies that only have 1-2 scores.',
        sql: `SELECT m.title, m.release_year,
       COUNT(*) AS n,
       ROUND(AVG(r.rating), 2) AS avg_rating
FROM movies m
JOIN ratings r ON r.movie_id = m.movie_id
GROUP BY m.movie_id, m.title, m.release_year
HAVING COUNT(*) >= 4
ORDER BY avg_rating DESC, n DESC`
    },
    {
        id: 'keyword_avg',
        title: 'Average rating by keyword',
        note: 'A movie with two keywords is counted in both. That is intentional.',
        sql: `SELECT k.name, COUNT(DISTINCT mk.movie_id) AS movies,
       COUNT(r.rating_id) AS ratings,
       ROUND(AVG(r.rating), 2) AS avg_rating
FROM keywords k
JOIN movie_keywords mk ON mk.keyword_id = k.keyword_id
JOIN ratings r ON r.movie_id = mk.movie_id
GROUP BY k.keyword_id, k.name
ORDER BY avg_rating DESC`
    },
    {
        id: 'multi_job',
        title: 'Same person, more than one job on a film',
        note: 'GROUP_CONCAT on the relationship table. Coppola, Bong, Nolan, etc.',
        sql: `SELECT p.name, m.title, GROUP_CONCAT(mp.role ORDER BY mp.role) AS jobs
FROM movie_people mp
JOIN people p ON p.person_id = mp.person_id
JOIN movies m ON m.movie_id = mp.movie_id
GROUP BY p.person_id, p.name, m.movie_id, m.title
HAVING COUNT(*) > 1
ORDER BY p.name`
    },
    {
        id: 'best_per_year',
        title: 'Best movie of each year',
        note: 'Window function RANK() partitioned by year.',
        sql: `SELECT title, release_year, avg_rating
FROM (
    SELECT m.title, m.release_year,
           ROUND(AVG(r.rating), 2) AS avg_rating,
           RANK() OVER (PARTITION BY m.release_year ORDER BY AVG(r.rating) DESC) AS rk
    FROM movies m
    JOIN ratings r ON r.movie_id = m.movie_id
    GROUP BY m.movie_id, m.title, m.release_year
) t
WHERE rk = 1
ORDER BY release_year`
    },
    {
        id: 'similar_users',
        title: 'Users who rated at least 3 of the same movies',
        note: 'Self-join on ratings. avg_diff close to 0 means they agree.',
        sql: `SELECT u1.username AS u_a, u2.username AS u_b,
       COUNT(*) AS overlap,
       ROUND(AVG(ABS(r1.rating - r2.rating)), 2) AS avg_diff
FROM ratings r1
JOIN ratings r2 ON r1.movie_id = r2.movie_id AND r1.user_id < r2.user_id
JOIN users u1 ON u1.user_id = r1.user_id
JOIN users u2 ON u2.user_id = r2.user_id
GROUP BY r1.user_id, r2.user_id, u1.username, u2.username
HAVING COUNT(*) >= 3
ORDER BY avg_diff, overlap DESC`
    },
    {
        id: 'keyword_pairs',
        title: 'Keyword pairs that appear on the same movie',
        note: 'Self-join of the M:N table with keyword_id < so each pair is once.',
        sql: `SELECT k1.name AS keyword_a, k2.name AS keyword_b, COUNT(*) AS together
FROM movie_keywords a
JOIN movie_keywords b ON a.movie_id = b.movie_id AND a.keyword_id < b.keyword_id
JOIN keywords k1 ON k1.keyword_id = a.keyword_id
JOIN keywords k2 ON k2.keyword_id = b.keyword_id
GROUP BY k1.name, k2.name
ORDER BY together DESC, keyword_a, keyword_b`
    },
    {
        id: 'unrated',
        title: 'Movies with no ratings',
        note: 'Correlated NOT EXISTS. After stripping ratings off a few catalog films, those titles show up here.',
        sql: `SELECT m.title, m.release_year
FROM movies m
WHERE NOT EXISTS (
    SELECT 1 FROM ratings r WHERE r.movie_id = m.movie_id
)`
    },
    {
        id: 'histogram',
        title: 'Rating histogram',
        sql: `SELECT rating, COUNT(*) AS n
FROM ratings
GROUP BY rating
ORDER BY rating`
    },
    {
        id: 'directors',
        title: 'Directors from v_director_stats',
        note: 'Reads a view, not the base tables.',
        sql: `SELECT director, films, avg_rating
FROM v_director_stats
ORDER BY avg_rating DESC, films DESC`
    },
    {
        id: 'bong',
        title: 'People who worked with Bong Joon-ho',
        note: 'Self-join movie_people. He directed Parasite and Memories of Murder.',
        sql: `SELECT DISTINCT p2.name, mp2.role, m.title
FROM movie_people mp1
JOIN movie_people mp2 ON mp1.movie_id = mp2.movie_id AND mp1.person_id <> mp2.person_id
JOIN people p1 ON p1.person_id = mp1.person_id
JOIN people p2 ON p2.person_id = mp2.person_id
JOIN movies m ON m.movie_id = mp1.movie_id
WHERE p1.name = 'Bong Joon-ho'
ORDER BY m.title, mp2.role, p2.name`
    },
    {
        id: 'easy_graders',
        title: 'Users with average rating >= 9',
        sql: `SELECT u.username, COUNT(*) AS n, ROUND(AVG(r.rating), 2) AS avg_rating
FROM users u
JOIN ratings r ON r.user_id = u.user_id
GROUP BY u.user_id, u.username
HAVING AVG(r.rating) >= 9
ORDER BY avg_rating DESC`
    },
    {
        id: 'above_mean',
        title: 'Movies above the overall mean rating',
        note: 'CTE for the mean, then HAVING.',
        sql: `WITH overall AS (
    SELECT AVG(rating) AS mean_r FROM ratings
)
SELECT m.title, ROUND(AVG(r.rating), 2) AS avg_rating
FROM movies m
JOIN ratings r ON r.movie_id = m.movie_id
CROSS JOIN overall
GROUP BY m.movie_id, m.title, overall.mean_r
HAVING AVG(r.rating) > overall.mean_r
ORDER BY avg_rating DESC`
    },
    {
        id: 'above_keyword',
        title: 'Movies above their keyword average',
        note: 'Join to keyword stats. A movie with two keywords can appear twice.',
        sql: `SELECT m.title, k.name AS keyword,
       ROUND(AVG(r.rating), 2) AS movie_avg,
       ks.avg_rating AS keyword_avg
FROM movies m
JOIN movie_keywords mk ON mk.movie_id = m.movie_id
JOIN keywords k ON k.keyword_id = mk.keyword_id
JOIN ratings r ON r.movie_id = m.movie_id
JOIN v_keyword_stats ks ON ks.keyword_id = k.keyword_id
GROUP BY m.movie_id, m.title, k.keyword_id, k.name, ks.avg_rating
HAVING AVG(r.rating) > ks.avg_rating
ORDER BY k.name, movie_avg DESC`
    },
    {
        id: 'movie_stats_view',
        title: 'v_movie_stats',
        sql: `SELECT title, release_year, rating_count, avg_rating, min_rating, max_rating
FROM v_movie_stats
ORDER BY avg_rating DESC`
    },
    {
        id: 'keyword_stats_view',
        title: 'v_keyword_stats',
        sql: `SELECT keyword, movie_count, rating_count, avg_rating
FROM v_keyword_stats
ORDER BY avg_rating DESC`
    },
    {
        id: 'rating_log',
        title: 'rating_log (trigger output)',
        note: 'Rows appear when ratings are inserted/updated/deleted. Seed inserts already filled this.',
        sql: `SELECT m.title, u.username, l.action, l.old_rating, l.new_rating, l.changed_at
FROM rating_log l
JOIN movies m ON m.movie_id = l.movie_id
JOIN users u ON u.user_id = l.user_id
ORDER BY l.changed_at DESC
LIMIT 25`
    },
    {
        id: 'explain_keyword',
        title: 'EXPLAIN the keyword average query',
        note: 'Shows the plan, not the result set.',
        sql: `EXPLAIN
SELECT k.name, ROUND(AVG(r.rating), 2) AS avg_rating
FROM keywords k
JOIN movie_keywords mk ON mk.keyword_id = k.keyword_id
JOIN ratings r ON r.movie_id = mk.movie_id
GROUP BY k.keyword_id, k.name`
    }
]

router.get('/', (req, res) => {
    res.json(sqlQueries.map(({ id, title, note }) => ({ id, title, note })))
})

router.get('/run/:id', async (req, res) => {
    const item = sqlQueries.find(x => x.id === req.params.id)
    if (!item) return res.status(404).json({ error: 'unknown query' })
    try {
        const rows = await q(item.sql)
        res.json({ title: item.title, note: item.note, sql: item.sql, rows })
    } catch (err) {
        res.status(500).json({ error: err.sqlMessage || err.message, sql: item.sql })
    }
})

router.get('/mongo/tags', async (req, res) => {
    const rows = await Review.aggregate([
        { $match: { tags: { $exists: true, $ne: [] } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', n: { $sum: 1 } } },
        { $sort: { n: -1 } }
    ])
    res.json({
        title: 'Tag frequency (MongoDB)',
        note: 'Not every review has tags — that is the point of the document model.',
        pipeline: 'unwind tags -> group -> sort',
        rows
    })
})

router.get('/mongo/sentiment', async (req, res) => {
    const rows = await Review.aggregate([
        { $match: { 'metadata.sentiment': { $exists: true } } },
        { $group: { _id: '$metadata.sentiment', n: { $sum: 1 }, avgHelpful: { $avg: '$metadata.helpfulVotes' } } },
        { $sort: { n: -1 } }
    ])
    res.json({
        title: 'Sentiment from embedded metadata',
        note: 'metadata lives on the review document. Not every review has it.',
        rows
    })
})

router.get('/mongo/by-movie', async (req, res) => {
    const agg = await Review.aggregate([
        { $group: { _id: '$movieId', reviews: { $sum: 1 } } },
        { $sort: { reviews: -1 } }
    ])
    if (!agg.length) return res.json({ title: 'Reviews per movie (mysql titles + mongo counts)', rows: [] })

    const ids = agg.map(x => x._id)
    const movies = await q(
        `SELECT movie_id, title FROM movies WHERE movie_id IN (${ids.map(() => '?').join(',')})`,
        ids
    )
    const nameOf = {}
    for (const m of movies) nameOf[m.movie_id] = m.title

    const rows = agg.map(x => ({
        movie: nameOf[x._id] || ('#' + x._id),
        reviews: x.reviews
    }))
    res.json({
        title: 'Reviews per movie',
        note: 'Counts come from MongoDB. Titles come from MySQL. This is the hybrid query.',
        rows
    })
})

router.get('/fn/:movieId', async (req, res) => {
    const rows = await q('SELECT fn_avg_rating(?) AS avg_rating', [Number(req.params.movieId)])
    res.json(rows[0])
})

module.exports = router
