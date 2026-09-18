const { mongoose } = require('./db')

const reviewSchema = new mongoose.Schema({
    movieId: { type: Number, required: true },
    userId: { type: Number, required: true },
    review: String,
    tags: [String],
    watchedOn: {
        platform: String,
        date: String
    },
    spoiler: Boolean,
    language: String,
    metadata: mongoose.Schema.Types.Mixed
}, { collection: 'movie_reviews', strict: false, timestamps: false })

reviewSchema.index({ movieId: 1 })
reviewSchema.index({ userId: 1 })
reviewSchema.index({ tags: 1 })

module.exports = {
    Review: mongoose.model('Review', reviewSchema)
}
