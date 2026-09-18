require('dotenv').config()
const mysql = require('mysql2/promise')
const mongoose = require('mongoose')

let pool

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DB || 'moviedb',
            waitForConnections: true,
            connectionLimit: 10,
            multipleStatements: true
        })
    }
    return pool
}

async function q(sql, params) {
    const [rows] = await getPool().query(sql, params)
    return rows
}

async function connectMongo() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/moviedb'
    if (mongoose.connection.readyState === 1) return
    await mongoose.connect(uri)
}

module.exports = { getPool, q, connectMongo, mongoose }
