import React, { useEffect, useState } from 'react'
import { getJson } from '../api'

export default function Queries() {
  const [list, setList] = useState([])
  const [current, setCurrent] = useState(null)
  const [err, setErr] = useState('')
  const [which, setWhich] = useState('')

  useEffect(() => {
    getJson('/queries').then(setList).catch(e => setErr(e.message))
  }, [])

  function run(id) {
    setWhich(id)
    setErr('')
    getJson('/queries/run/' + id).then(setCurrent).catch(e => {
      setCurrent(null)
      setErr(e.message)
    })
  }

  function runMongo(path, id) {
    setWhich(id)
    setErr('')
    getJson(path).then(setCurrent).catch(e => {
      setCurrent(null)
      setErr(e.message)
    })
  }

  const rows = current && current.rows ? current.rows : []
  const cols = rows.length ? Object.keys(rows[0]) : []

  return (
    <div>
      <div className="box">
        <h2 style={{ marginTop: 0 }}>Query demos</h2>
        <p>These hit the live database. SQL is in <code>sql/queries.sql</code> too if you want to run it in Workbench.</p>
      </div>

      <div className="box">
        <b>MySQL</b>
        <div style={{ marginTop: 8 }}>
          {list.map(q => (
            <button key={q.id} className={'qlink' + (which === q.id ? ' active' : '')} onClick={() => run(q.id)}>
              {q.title}
            </button>
          ))}
        </div>
        <p style={{ marginTop: 14 }}><b>MongoDB / hybrid</b></p>
        <button className={'qlink' + (which === 'mongo_tags' ? ' active' : '')} onClick={() => runMongo('/queries/mongo/tags', 'mongo_tags')}>
          Tag frequency (unwind + group)
        </button>
        <button className={'qlink' + (which === 'mongo_sent' ? ' active' : '')} onClick={() => runMongo('/queries/mongo/sentiment', 'mongo_sent')}>
          Sentiment from embedded metadata
        </button>
        <button className={'qlink' + (which === 'mongo_hybrid' ? ' active' : '')} onClick={() => runMongo('/queries/mongo/by-movie', 'mongo_hybrid')}>
          Reviews per movie (Mongo counts + MySQL titles)
        </button>
      </div>

      {err && <p className="err">{err}</p>}

      {current && (
        <div className="box">
          <h3 style={{ marginTop: 0 }}>{current.title}</h3>
          {current.note && <p className="muted">{current.note}</p>}
          {current.sql && <pre className="sql">{current.sql}</pre>}
          {current.pipeline && <p className="muted">{current.pipeline}</p>}
          {rows.length ? (
            <table>
              <thead>
                <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {cols.map(c => <td key={c}>{formatCell(row[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">0 rows</p>
          )}
        </div>
      )}
    </div>
  )
}

function formatCell(v) {
  if (v == null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
