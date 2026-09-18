import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJson } from '../api'

export default function Home() {
  const [q, setQ] = useState('')
  const [movies, setMovies] = useState([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  function load(term) {
    const url = term ? '/movies?q=' + encodeURIComponent(term) : '/movies'
    setErr('')
    setLoading(true)
    getJson(url)
      .then(rows => { setMovies(rows); setLoading(false) })
      .catch(e => { setErr(e.message); setLoading(false) })
  }

  useEffect(() => { load('') }, [])

  function onSubmit(e) {
    e.preventDefault()
    load(q)
  }

  return (
    <div>
      <div className="box">
        <form className="row" onSubmit={onSubmit}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="search title" />
          <button type="submit">Search</button>
        </form>
        <p className="muted">Uses MATCH AGAINST on title+description, falls back to LIKE if nothing comes back.</p>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="box movie-list">
        {movies.map(m => (
          <Link key={m.movie_id} to={'/movie/' + m.movie_id}>
            <b>{m.title}</b> ({m.release_year})
            <span className="muted"> — {m.runtime} min
              {m.avg_rating != null ? ' — avg ' + m.avg_rating + ' (' + m.rating_count + ')' : ''}
            </span>
          </Link>
        ))}
        {!loading && !movies.length && <p className="muted">no movies</p>}
        {loading && <p className="muted">loading...</p>}
      </div>
    </div>
  )
}
