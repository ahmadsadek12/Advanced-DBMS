const express = require('express')
const { Review } = require('../models')

const router = express.Router()

router.get('/', async (req, res) => {
    const movieId = req.query.movieId
    const filter = movieId ? { movieId: Number(movieId) } : {}
    const docs = await Review.find(filter).lean()
    res.json(docs)
})

router.post('/', async (req, res) => {
    const body = req.body || {}
    if (!body.movieId || !body.userId || !body.review) {
        return res.status(400).json({ error: 'movieId, userId, review required' })
    }
    const doc = {
        movieId: Number(body.movieId),
        userId: Number(body.userId),
        review: body.review
    }
    if (Array.isArray(body.tags) && body.tags.length) doc.tags = body.tags
    if (body.watchedOn) doc.watchedOn = body.watchedOn
    if (body.spoiler != null) doc.spoiler = body.spoiler
    if (body.language) doc.language = body.language
    if (body.metadata) doc.metadata = body.metadata
    const created = await Review.create(doc)
    res.status(201).json(created)
})

router.delete('/:id', async (req, res) => {
    await Review.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
})

router.get('/agg/tags', async (req, res) => {
    const rows = await Review.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', n: { $sum: 1 } } },
        { $sort: { n: -1 } }
    ])
    res.json(rows)
})

router.get('/agg/sentiment', async (req, res) => {
    const rows = await Review.aggregate([
        { $match: { 'metadata.sentiment': { $exists: true } } },
        { $group: { _id: '$metadata.sentiment', n: { $sum: 1 }, avgHelpful: { $avg: '$metadata.helpfulVotes' } } },
        { $sort: { n: -1 } }
    ])
    res.json(rows)
})

router.get('/agg/by-movie', async (req, res) => {
    const rows = await Review.aggregate([
        { $group: {
            _id: '$movieId',
            n: { $sum: 1 },
            tags: { $addToSet: '$tags' }
        }},
        { $sort: { n: -1 } }
    ])
    res.json(rows)
})

module.exports = router
