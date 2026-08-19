// YouTube IFrame Player API 로더 (싱글턴) + URL 파싱 유틸

let apiPromise = null

export function getYouTubeAPI() {
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      if (window.YT?.Player) return resolve(window.YT)
      window.onYouTubeIframeAPIReady = () => resolve(window.YT)
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.body.appendChild(script)
    })
  }
  return apiPromise
}

// 영상 URL → videoId (watch, youtu.be, shorts, embed, live 지원)
export function parseVideoId(url) {
  if (!url) return null
  const str = String(url).trim()
  if (/^[\w-]{11}$/.test(str)) return str
  const m = str.match(
    /(?:youtube\.com\/(?:watch\?[^#]*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/,
  )
  return m ? m[1] : null
}

// 플레이리스트 URL → playlistId
export function parsePlaylistId(url) {
  if (!url) return null
  const str = String(url).trim()
  if (/^(PL|UU|LL|OL|FL)[\w-]+$/.test(str)) return str
  const m = str.match(/[?&]list=([\w-]+)/)
  return m ? m[1] : null
}

// ---- YouTube Data API v3 (키는 localStorage) ----
import { pushKey } from './sync.js'

export const getApiKey = () => localStorage.getItem('yt_api_key') || ''
export const setApiKey = (key) => {
  localStorage.setItem('yt_api_key', key.trim())
  pushKey('yt_api_key')
}

const API_BASE = 'https://www.googleapis.com/youtube/v3'

async function api(path, params) {
  const q = new URLSearchParams({ ...params, key: getApiKey() })
  const res = await fetch(`${API_BASE}${path}?${q}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(`YouTube API 오류 (${res.status})${body?.error?.message ? `: ${body.error.message}` : ''}`)
  }
  return res.json()
}

// 플레이리스트 정보 (여러 개 한 번에)
export async function getPlaylistsInfo(ids) {
  if (!ids.length) return []
  const data = await api('/playlists', {
    part: 'snippet,contentDetails',
    id: ids.join(','),
    maxResults: '50',
  })
  return data.items || []
}

// 플레이리스트 안 영상 목록 (전체 페이지네이션)
export async function getPlaylistItems(playlistId) {
  const items = []
  let pageToken = ''
  do {
    const data = await api('/playlistItems', {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    })
    items.push(...(data.items || []))
    pageToken = data.nextPageToken || ''
  } while (pageToken)
  // 삭제된/비공개 영상 제외
  return items.filter((it) => it.snippet?.title !== 'Deleted video' && it.snippet?.title !== 'Private video')
}

// 추가한 플레이리스트 ID 목록 저장
export const getSavedPlaylistIds = () => {
  try {
    return JSON.parse(localStorage.getItem('yt_playlists') || '[]')
  } catch {
    return []
  }
}
export const setSavedPlaylistIds = (ids) => {
  localStorage.setItem('yt_playlists', JSON.stringify(ids))
  pushKey('yt_playlists')
}
