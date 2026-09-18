const express = require('express')
const { getPool, q } = require('../db')

const router = express.Router()

router.post('/', async (req, res) => {
    const { user_id, movie_id, rating } = req.body
    if (!user_id || !movie_id || rating == null) {
        return res.status(400).json({ error: 'user_id, movie_id, rating required' })
    }

    const conn = await getPool().getConnection()
    try {
        await conn.beginTransaction()
        await conn.query('CALL sp_upsert_rating(?,?,?)', [user_id, movie_id, rating])
        await conn.commit()
        const [rows] = await conn.query(
            `SELECT r.rating_id, r.rating, r.rated_at, u.username
             FROM ratings r JOIN users u ON u.user_id = r.user_id
             WHERE r.user_id = ? AND r.movie_id = ?`,
            [user_id, movie_id]
        )
        res.json(rows[0])
    } catch (err) {
        await conn.rollback()
        res.status(400).json({ error: err.sqlMessage || err.message })
    } finally {
        conn.release()
    }
})

router.delete('/:id', async (req, res) => {
    try {
        await q('DELETE FROM ratings WHERE rating_id = ?', [Number(req.params.id)])
        res.json({ ok: true })
    } catch (err) {
        res.status(400).json({ error: err.sqlMessage || err.message })
    }
})

module.exports = router
