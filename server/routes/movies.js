const express = require('express')
const { q } = require('../db')
const { Review } = require('../models')

const router = express.Router()

router.get('/', async (req, res) => {
    const search = (req.query.q || '').trim()
    let rows
    if (search.length > 2) {
        try {
            rows = await q(
                `SELECT m.movie_id, m.title, m.release_year, m.runtime,
                        ROUND(AVG(r.rating), 2) AS avg_rating,
                        COUNT(r.rating_id) AS rating_count
                 FROM movies m
                 LEFT JOIN ratings r ON r.movie_id = m.movie_id
                 WHERE MATCH(m.title, m.description) AGAINST(? IN NATURAL LANGUAGE MODE)
                 GROUP BY m.movie_id, m.title, m.release_year, m.runtime
                 ORDER BY avg_rating DESC`,
                [search]
            )
        } catch (e) {
            rows = []
        }
        if (!rows.length) {
            rows = await q(
                `SELECT m.movie_id, m.title, m.release_year, m.runtime,
                        ROUND(AVG(r.rating), 2) AS avg_rating,
                        COUNT(r.rating_id) AS rating_count
                 FROM movies m
                 LEFT JOIN ratings r ON r.movie_id = m.movie_id
                 WHERE m.title LIKE ? OR m.description LIKE ?
                 GROUP BY m.movie_id, m.title, m.release_year, m.runtime
                 ORDER BY m.title`,
                ['%' + search + '%', '%' + search + '%']
            )
        }
    } else if (search) {
        rows = await q(
            `SELECT m.movie_id, m.title, m.release_year, m.runtime,
                    ROUND(AVG(r.rating), 2) AS avg_rating,
                    COUNT(r.rating_id) AS rating_count
             FROM movies m
             LEFT JOIN ratings r ON r.movie_id = m.movie_id
             WHERE m.title LIKE ? OR m.description LIKE ?
             GROUP BY m.movie_id, m.title, m.release_year, m.runtime
             ORDER BY m.title`,
            ['%' + search + '%', '%' + search + '%']
        )
    } else {
        rows = await q(
            `SELECT m.movie_id, m.title, m.release_year, m.runtime,
                    ROUND(AVG(r.rating), 2) AS avg_rating,
                    COUNT(r.rating_id) AS rating_count
             FROM movies m
             LEFT JOIN ratings r ON r.movie_id = m.movie_id
             GROUP BY m.movie_id, m.title, m.release_year, m.runtime
             ORDER BY m.release_year DESC`
        )
    }
    res.json(rows)
})

router.get('/:id', async (req, res) => {
    const id = Number(req.params.id)
    try {
    const movies = await q(
        `SELECT m.*, fn_avg_rating(m.movie_id) AS avg_rating
         FROM movies m WHERE m.movie_id = ?`,
        [id]
    )
    if (!movies.length) return res.status(404).json({ error: 'not found' })

    const keywords = await q(
        `SELECT k.keyword_id, k.name
         FROM keywords k
         JOIN movie_keywords mk ON mk.keyword_id = k.keyword_id
         WHERE mk.movie_id = ?
         ORDER BY k.name`,
        [id]
    )
    const people = await q(
        `SELECT p.person_id, p.name, DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') AS date_of_birth, mp.role, mp.character_name, mp.credit_order
         FROM movie_people mp
         JOIN people p ON p.person_id = mp.person_id
         WHERE mp.movie_id = ?
         ORDER BY mp.credit_order IS NULL, mp.credit_order, p.name`,
        [id]
    )
    const ratings = await q(
        `SELECT r.rating_id, r.rating, r.rated_at, u.user_id, u.username
         FROM ratings r
         JOIN users u ON u.user_id = r.user_id
         WHERE r.movie_id = ?
         ORDER BY r.rated_at DESC`,
        [id]
    )

    const reviews = await Review.find({ movieId: id }).lean()

    res.json({
        ...movies[0],
        keywords,
        people,
        ratings,
        reviews
    })
    } catch (e) {
        res.status(500).json({ error: e.sqlMessage || e.message })
    }
})

module.exports = router
