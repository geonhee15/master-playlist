// Cloudflare Worker — 정적 에셋 + API 프록시 (가사 LRCLIB / Spotify 임베드 트랙)
// functions/ (Pages 전용)와 같은 로직의 Workers 버전
const LRCLIB_HEADERS = { 'User-Agent': 'MasterPlaylist/0.1 (personal project)' }
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

async function lyricsHandler(url) {
  const q = {
    track: url.searchParams.get('track') || '',
    artist: url.searchParams.get('artist') || '',
    album: url.searchParams.get('album') || '',
    duration: url.searchParams.get('duration') || '',
  }
  let result = null
  try {
    const exact = new URLSearchParams({
      track_name: q.track,
      artist_name: q.artist,
      album_name: q.album,
      duration: q.duration,
    })
    let res = await fetch(`https://lrclib.net/api/get?${exact}`, { headers: LRCLIB_HEADERS })
    if (res.ok) result = await res.json()
    if (!result?.syncedLyrics && !result?.plainLyrics) {
      const search = new URLSearchParams({ track_name: q.track, artist_name: q.artist })
      res = await fetch(`https://lrclib.net/api/search?${search}`, { headers: LRCLIB_HEADERS })
      if (res.ok) {
        const list = await res.json()
        const dur = Number(q.duration) || 0
        const close = (x) => !dur || Math.abs((x.duration || 0) - dur) <= 3
        result =
          list.find((x) => x.syncedLyrics && close(x)) ||
          list.find((x) => x.syncedLyrics) ||
          list.find((x) => x.plainLyrics && close(x)) ||
          null
      }
    }
  } catch {
    result = null
  }
  return Response.json(result || {})
}

async function playlistTracksHandler(url) {
  const id = url.searchParams.get('id') || ''
  if (!/^[A-Za-z0-9]+$/.test(id)) return Response.json({})
  try {
    const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en' },
    })
    if (!res.ok) return Response.json({})
    const html = await res.text()
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>(.*?)<\/script>/s)
    if (!m) return Response.json({})
    const entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity
    if (!Array.isArray(entity?.trackList)) return Response.json({})
    return Response.json({
      name: entity.name || '',
      tracks: entity.trackList
        .filter((t) => t.uri && t.isPlayable !== false)
        .map((t) => ({
          id: t.uri.split(':').pop(),
          name: t.title || '',
          artists: t.subtitle ? [{ name: t.subtitle }] : [],
          album: null,
          duration_ms: t.duration || 0,
        })),
    })
  } catch {
    return Response.json({})
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/lyrics') return lyricsHandler(url)
    if (url.pathname === '/api/playlist-tracks') return playlistTracksHandler(url)
    return env.ASSETS.fetch(request)
  },
}
