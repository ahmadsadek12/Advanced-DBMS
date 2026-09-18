const express = require('express')
const { q } = require('../db')

const router = express.Router()

router.get('/:id', async (req, res) => {
    const id = Number(req.params.id)
    const people = await q('SELECT person_id, name, DATE_FORMAT(date_of_birth, \'%Y-%m-%d\') AS date_of_birth, biography FROM people WHERE person_id = ?', [id])
    if (!people.length) return res.status(404).json({ error: 'not found' })

    const credits = await q(
        `SELECT m.movie_id, m.title, m.release_year, mp.role, mp.character_name
         FROM movie_people mp
         JOIN movies m ON m.movie_id = mp.movie_id
         WHERE mp.person_id = ?
         ORDER BY m.release_year, mp.role`,
        [id]
    )

    res.json({ ...people[0], credits })
})

router.get('/', async (req, res) => {
    const rows = await q(
        `SELECT p.person_id, p.name, DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') AS date_of_birth,
                COUNT(DISTINCT mp.movie_id) AS film_count
         FROM people p
         LEFT JOIN movie_people mp ON mp.person_id = p.person_id
         GROUP BY p.person_id, p.name, p.date_of_birth
         ORDER BY p.name`
    )
    res.json(rows)
})

module.exports = router
