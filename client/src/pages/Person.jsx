import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getJson } from '../api'

export default function Person() {
  const { id } = useParams()
  const [person, setPerson] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    getJson('/people/' + id).then(setPerson).catch(e => setErr(e.message))
  }, [id])

  if (!person) return <p>{err || 'loading...'}</p>

  return (
    <div className="box">
      <h2 style={{ marginTop: 0 }}>{person.name}</h2>
      {person.date_of_birth && <p>b. {String(person.date_of_birth).slice(0, 10)}</p>}
      {person.biography && <p>{person.biography}</p>}
      <table>
        <thead>
          <tr><th>Year</th><th>Movie</th><th>Role</th><th>As</th></tr>
        </thead>
        <tbody>
          {person.credits && person.credits.map((c, i) => (
            <tr key={i}>
              <td>{c.release_year}</td>
              <td><Link to={'/movie/' + c.movie_id}>{c.title}</Link></td>
              <td>{c.role}</td>
              <td>{c.character_name || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
