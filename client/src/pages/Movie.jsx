import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getJson, postJson, delJson } from '../api'

export default function Movie() {
  const { id } = useParams()
  const [movie, setMovie] = useState(null)
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('')
  const [rating, setRating] = useState('8')
  const [reviewUser, setReviewUser] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [reviewTags, setReviewTags] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  function load() {
    getJson('/movies/' + id).then(setMovie).catch(e => setErr(e.message))
  }

  useEffect(() => {
    load()
    getJson('/users').then(rows => {
      setUsers(rows)
      if (rows[0]) {
        setUserId(String(rows[0].user_id))
        setReviewUser(String(rows[0].user_id))
      }
    }).catch(() => {})
  }, [id])

  async function saveRating(e) {
    e.preventDefault()
    setErr('')
    setMsg('')
    try {
      await postJson('/ratings', {
        user_id: Number(userId),
        movie_id: Number(id),
        rating: Number(rating)
      })
      setMsg('rating saved (stored proc + trigger)')
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function saveReview(e) {
    e.preventDefault()
    setErr('')
    setMsg('')
    try {
      const body = {
        movieId: Number(id),
        userId: Number(reviewUser),
        review: reviewText
      }
      const tags = reviewTags.split(',').map(s => s.trim()).filter(Boolean)
      if (tags.length) body.tags = tags
      await postJson('/reviews', body)
      setReviewText('')
      setReviewTags('')
      setMsg('review saved to mongo')
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function dropRating(ratingId) {
    setErr('')
    setMsg('')
    try {
      await delJson('/ratings/' + ratingId)
      setMsg('rating deleted (trigger writes rating_log)')
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  async function dropReview(reviewId) {
    setErr('')
    setMsg('')
    try {
      await delJson('/reviews/' + reviewId)
      setMsg('review deleted from mongo')
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  if (!movie) return <p>{err || 'loading...'}</p>

  return (
    <div>
      <div className="box">
        <h2 style={{ marginTop: 0 }}>{movie.title} <span className="muted">({movie.release_year})</span></h2>
        <p>{movie.runtime} min
          {movie.avg_rating != null ? ' · avg ' + movie.avg_rating + ' (fn_avg_rating)' : ''}
        </p>
        <p>{movie.description}</p>
        <p>
          {movie.keywords && movie.keywords.map(k => (
            <span key={k.keyword_id} className="pill">{k.name}</span>
          ))}
        </p>
      </div>

      <div className="box">
        <h3>Cast / crew</h3>
        <table>
          <thead>
            <tr><th>Name</th><th>Role</th><th>Character</th></tr>
          </thead>
          <tbody>
            {movie.people && movie.people.map((p, i) => (
              <tr key={p.person_id + p.role + i}>
                <td><Link to={'/person/' + p.person_id}>{p.name}</Link></td>
                <td>{p.role}</td>
                <td>{p.character_name || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="box">
        <h3>Ratings (MySQL)</h3>
        <table>
          <thead>
            <tr><th>User</th><th>Rating</th><th>When</th><th></th></tr>
          </thead>
          <tbody>
            {movie.ratings && movie.ratings.map(r => (
              <tr key={r.rating_id}>
                <td>{r.username}</td>
                <td>{r.rating}</td>
                <td>{String(r.rated_at).replace('T', ' ').slice(0, 19)}</td>
                <td><button type="button" onClick={() => dropRating(r.rating_id)}>delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="row" onSubmit={saveRating} style={{ marginTop: 10 }}>
          <select value={userId} onChange={e => setUserId(e.target.value)}>
            {users.map(u => <option key={u.user_id} value={u.user_id}>{u.username}</option>)}
          </select>
          <select value={rating} onChange={e => setRating(e.target.value)}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button>Save rating</button>
        </form>
        <p className="muted">Goes through sp_upsert_rating. Unique (user, movie) so a second submit updates.</p>
      </div>

      <div className="box">
        <h3>Reviews (MongoDB)</h3>
        {movie.reviews && movie.reviews.map(r => (
          <div key={r._id} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
            <b>user #{r.userId}</b>
            <p style={{ margin: '4px 0' }}>{r.review}</p>
            {r.tags && r.tags.length ? <p className="muted">tags: {r.tags.join(', ')}</p> : null}
            {r.watchedOn ? <p className="muted">{r.watchedOn.platform} {r.watchedOn.date || ''}</p> : null}
            {r.spoiler ? <p className="muted">spoiler flagged</p> : null}
            {r.metadata ? <p className="muted">metadata: {JSON.stringify(r.metadata)}</p> : null}
            {r.extra ? <p className="muted">{JSON.stringify(r.extra)}</p> : null}
            <p><button type="button" onClick={() => dropReview(r._id)}>delete review</button></p>
          </div>
        ))}
        <form onSubmit={saveReview} style={{ marginTop: 10 }}>
          <div className="row">
            <select value={reviewUser} onChange={e => setReviewUser(e.target.value)}>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.username}</option>)}
            </select>
            <input value={reviewTags} onChange={e => setReviewTags(e.target.value)} placeholder="tags, comma separated (optional)" style={{ flex: 1 }} />
          </div>
          <p>
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={3} style={{ width: '100%' }} placeholder="review text" />
          </p>
          <button>Add review</button>
        </form>
      </div>

      {msg && <p>{msg}</p>}
      {err && <p className="err">{err}</p>}
    </div>
  )
}
