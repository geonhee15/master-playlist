// Spotify Web API — Authorization Code with PKCE (서버 없이 브라우저에서 인증)
const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API_BASE = 'https://api.spotify.com/v1'
const SCOPES = 'playlist-read-private playlist-read-collaborative user-library-read'

export const redirectUri = () => `${window.location.origin}/callback`

// ---- Client ID 저장 ----
import { pushKey } from './sync.js'

export const getClientId = () => localStorage.getItem('sp_client_id') || ''
export const setClientId = (id) => {
  localStorage.setItem('sp_client_id', id.trim())
  pushKey('sp_client_id')
}

// ---- PKCE 유틸 ----
function randomString(len = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

async function sha256base64url(str) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ---- 인증 흐름 ----
export async function startLogin() {
  const verifier = randomString(64)
  localStorage.setItem('sp_verifier', verifier)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    scope: SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await sha256base64url(verifier),
  })
  window.location.href = `${AUTH_URL}?${params}`
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`토큰 요청 실패 (${res.status}) ${text}`)
  }
  const data = await res.json()
  localStorage.setItem('sp_access_token', data.access_token)
  if (data.refresh_token) localStorage.setItem('sp_refresh_token', data.refresh_token)
  localStorage.setItem('sp_expires_at', String(Date.now() + data.expires_in * 1000))
  return data
}

export async function exchangeCode(code) {
  await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: getClientId(),
    code_verifier: localStorage.getItem('sp_verifier') || '',
  })
  localStorage.removeItem('sp_verifier')
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('sp_refresh_token')
  if (!refreshToken) throw new Error('로그인이 필요합니다')
  await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: getClientId(),
  })
}

export const isLoggedIn = () => !!localStorage.getItem('sp_access_token')

export function logout() {
  for (const key of ['sp_access_token', 'sp_refresh_token', 'sp_expires_at', 'sp_verifier']) {
    localStorage.removeItem(key)
  }
}

// ---- API 호출 (만료 시 자동 갱신) ----
async function api(path) {
  const expiresAt = Number(localStorage.getItem('sp_expires_at') || 0)
  if (Date.now() > expiresAt - 60_000) await refreshAccessToken()

  let res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('sp_access_token')}` },
  })
  if (res.status === 401) {
    await refreshAccessToken()
    res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sp_access_token')}` },
    })
  }
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json())?.error?.message || ''
    } catch {
      /* 본문이 JSON이 아니면 상태 코드만 표시 */
    }
    const err = new Error(`Spotify API 오류 (${res.status})${detail ? `: ${detail}` : ''}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

async function paginate(firstPath, mapItem) {
  const items = []
  let data = await api(firstPath)
  items.push(...data.items)
  while (data.next) {
    data = await api(data.next.replace(API_BASE, ''))
    items.push(...data.items)
  }
  return mapItem ? items.map(mapItem) : items
}

export const getMe = () => api('/me')

export const getAllPlaylists = () => paginate('/me/playlists?limit=50')

export const getPlaylistTracks = (playlistId) =>
  paginate(`/playlists/${playlistId}/tracks?limit=100`, (it) => it.track)

export const getLikedTracks = () => paginate('/me/tracks?limit=50', (it) => it.track)
