import { useEffect, useRef, useState } from 'react'
import { SearchIcon } from './Icons.jsx'
import { isLoggedIn, getAllPlaylists, getPlaylistTracks } from '../spotify.js'
import { getApiKey, getSavedPlaylistIds, getPlaylistsInfo, getPlaylistItems } from '../youtube.js'
import { loadVisitorLibrary } from '../library.js'

// 전체 라이브러리 캐시 (열 때 한 번 수집, 새로고침 버튼으로 갱신)
let cache = null

async function loadAllData() {
  if (cache) return cache
  const data = { spotify: [], youtube: [], custom: [] }

  // 커스텀 (로컬 서버 or 방문자 localStorage)
  try {
    const res = await fetch('/api/library')
    const type = res.headers.get('content-type') || ''
    const lib = res.ok && type.includes('json') ? await res.json() : loadVisitorLibrary()
    data.custom = lib.playlists || []
  } catch {
    data.custom = loadVisitorLibrary().playlists || []
  }

  // Spotify — 연결돼 있으면 전체 플리의 트랙까지 수집
  if (isLoggedIn()) {
    try {
      const playlists = (await getAllPlaylists()).filter(Boolean)
      data.spotify = await Promise.all(
        playlists.map(async (playlist) => {
          let tracks = []
          try {
            tracks = (await getPlaylistTracks(playlist.id)).filter(Boolean)
          } catch {
            try {
              const res = await fetch(`/api/playlist-tracks?id=${playlist.id}`)
              const d = await res.json()
              tracks = d.tracks || []
            } catch {
              /* 이 플리는 목록 없이 이름만 검색 대상 */
            }
          }
          return { playlist, tracks }
        }),
      )
    } catch {
      /* Spotify 미연결/오류 → 검색에서 제외 */
    }
  }

  // YouTube — API 키가 있으면 추가한 플리의 영상까지 수집
  if (getApiKey()) {
    try {
      const infos = await getPlaylistsInfo(getSavedPlaylistIds())
      data.youtube = await Promise.all(
        infos.map(async (playlist) => {
          let items = []
          try {
            items = await getPlaylistItems(playlist.id)
          } catch {
            /* 이름만 검색 대상 */
          }
          return { playlist, items }
        }),
      )
    } catch {
      /* 키 오류 → 제외 */
    }
  }

  cache = data
  return data
}

function searchAll(data, query) {
  const q = query.toLowerCase()
  const has = (...fields) => fields.some((f) => f && String(f).toLowerCase().includes(q))
  const LIMIT = 8

  const spotify = []
  for (const { playlist, tracks } of data.spotify) {
    if (has(playlist.name))
      spotify.push({ section: 'spotify', label: playlist.name, sub: '플레이리스트', playlistId: playlist.id })
    for (const t of tracks) {
      if (spotify.length >= LIMIT * 2) break
      if (has(t.name, t.artists?.map((a) => a.name).join(' ')))
        spotify.push({
          section: 'spotify',
          label: t.name,
          sub: `${t.artists?.[0]?.name || ''} · ${playlist.name}`,
          playlistId: playlist.id,
        })
    }
  }

  const youtube = []
  for (const { playlist, items } of data.youtube) {
    if (has(playlist.snippet?.title))
      youtube.push({ section: 'youtube', label: playlist.snippet.title, sub: '플레이리스트', playlistId: playlist.id })
    for (const it of items) {
      if (youtube.length >= LIMIT * 2) break
      if (has(it.snippet?.title, it.snippet?.videoOwnerChannelTitle))
        youtube.push({
          section: 'youtube',
          label: it.snippet.title,
          sub: `${it.snippet?.videoOwnerChannelTitle || ''} · ${playlist.snippet?.title}`,
          playlistId: playlist.id,
        })
    }
  }

  const custom = []
  for (const p of data.custom) {
    if (has(p.name)) custom.push({ section: 'custom', label: p.name, sub: '플레이리스트', playlistId: p.id })
    for (const t of p.tracks || []) {
      if (custom.length >= LIMIT * 2) break
      if (has(t.title, t.originalArtist, t.coverArtist, t.originalTitle))
        custom.push({
          section: 'custom',
          label: t.title,
          sub: `${t.originalArtist || t.coverArtist || ''} · ${p.name}`,
          playlistId: p.id,
        })
    }
  }

  return {
    spotify: spotify.slice(0, LIMIT),
    youtube: youtube.slice(0, LIMIT),
    custom: custom.slice(0, LIMIT),
  }
}

const GROUP_LABELS = { spotify: 'Spotify', youtube: 'YouTube', custom: 'Custom' }

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const inputRef = useRef(null)

  const openSearch = async () => {
    setOpen(true)
    if (!data) {
      setLoading(true)
      setData(await loadAllData())
      setLoading(false)
    }
  }

  const refresh = async () => {
    cache = null
    setLoading(true)
    setData(await loadAllData())
    setLoading(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const go = (item) => {
    window.dispatchEvent(new CustomEvent('mp:navigate', { detail: item }))
    setOpen(false)
    setQuery('')
  }

  const results = data && query.trim() ? searchAll(data, query.trim()) : null
  const total = results ? results.spotify.length + results.youtube.length + results.custom.length : 0

  return (
    <>
      <button className="top-icon-btn search-btn" onClick={openSearch} title="전체 검색">
        <SearchIcon size={14} />
        <span>검색</span>
      </button>

      {open && (
        <>
          <div className="context-overlay" onClick={() => setOpen(false)} />
          <div className="search-panel">
            <div className="search-input-row">
              <SearchIcon size={14} />
              <input
                ref={inputRef}
                autoFocus
                className="search-input"
                placeholder="모든 플리에서 노래/영상 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="btn small" onClick={refresh} title="라이브러리 다시 수집">
                새로고침
              </button>
            </div>

            {loading ? (
              <div className="loading-row" style={{ padding: '14px 4px' }}>
                <div className="spinner" />
                <span className="muted">전체 라이브러리 수집 중… (플리가 많으면 조금 걸려요)</span>
              </div>
            ) : !query.trim() ? (
              <p className="muted small-text search-hint">
                제목·가수·채널로 검색 — Spotify / YouTube / Custom 전체에서 찾아요.
              </p>
            ) : total === 0 ? (
              <p className="muted small-text search-hint">검색 결과가 없어요.</p>
            ) : (
              <div className="search-results">
                {['spotify', 'youtube', 'custom'].map(
                  (key) =>
                    results[key].length > 0 && (
                      <div key={key}>
                        <div className="search-group-label">{GROUP_LABELS[key]}</div>
                        {results[key].map((item, i) => (
                          <button className="search-item" key={i} onClick={() => go(item)}>
                            <span className="search-item-label ellipsis">{item.label}</span>
                            <span className="muted small-text ellipsis">{item.sub}</span>
                          </button>
                        ))}
                      </div>
                    ),
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
