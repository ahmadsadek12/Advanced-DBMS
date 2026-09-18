require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { connectMongo, q } = require('./db')

const app = express()
app.use(cors())
app.use(express.json())
app.use('/diagrams', express.static(path.join(__dirname, '..', 'diagrams')))

app.get('/api/users', async (req, res) => {
    const rows = await q('SELECT user_id, username, email, created_at FROM users ORDER BY username')
    res.json(rows)
})

app.use('/api/movies', require('./routes/movies'))
app.use('/api/people', require('./routes/people'))
app.use('/api/ratings', require('./routes/ratings'))
app.use('/api/reviews', require('./routes/reviews'))
app.use('/api/queries', require('./routes/queries'))

app.get('/api/health', (req, res) => {
    res.json({ ok: true })
})

const port = process.env.PORT || 3001

connectMongo()
    .then(() => {
        app.listen(port, () => {
            console.log('api on ' + port)
        })
    })
    .catch(err => {
        console.log('mongo failed:', err.message)
        process.exit(1)
    })
