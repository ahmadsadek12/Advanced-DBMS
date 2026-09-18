import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJson } from '../api'

export default function People() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    getJson('/people').then(setRows).catch(e => setErr(e.message))
  }, [])

  return (
    <div className="box">
      <h2 style={{ marginTop: 0 }}>People</h2>
      {err && <p className="err">{err}</p>}
      <table>
        <thead>
          <tr><th>Name</th><th>Born</th><th>Films</th></tr>
        </thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.person_id}>
              <td><Link to={'/person/' + p.person_id}>{p.name}</Link></td>
              <td>{p.date_of_birth ? String(p.date_of_birth).slice(0, 10) : ''}</td>
              <td>{p.film_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
