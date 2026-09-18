const API = '/api'

export async function getJson(url) {
  const res = await fetch(API + url)
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = body.error || msg
    } catch (e) {}
    throw new Error(msg)
  }
  return res.json()
}

export async function postJson(url, data) {
  const res = await fetch(API + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = body.error || msg
    } catch (e) {}
    throw new Error(msg)
  }
  return res.json()
}

export async function delJson(url) {
  const res = await fetch(API + url, { method: 'DELETE' })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = body.error || msg
    } catch (e) {}
    throw new Error(msg)
  }
  return res.json()
}
