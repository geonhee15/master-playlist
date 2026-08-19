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

// ---- R2 클라우드 미디어 (mp3/mp4 등을 어느 기기서나 재생) ----
const AUDIO_EXT = ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac', '.opus', '.aiff']
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v', '.mkv']
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']
const MIME = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.flac': 'audio/flac', '.aac': 'audio/aac', '.opus': 'audio/ogg', '.aiff': 'audio/aiff',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v', '.mkv': 'video/x-matroska',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
}
const extOf = (name) => name.slice(name.lastIndexOf('.')).toLowerCase()
const CORS = { 'Access-Control-Allow-Origin': '*' }

function parseRangeHeader(header) {
  const m = header && header.match(/bytes=(\d*)-(\d*)/)
  if (!m || (!m[1] && !m[2])) return undefined
  if (!m[1]) return { suffix: Number(m[2]) }
  if (!m[2]) return { offset: Number(m[1]) }
  return { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 }
}

async function cloudMediaHandler(request, env, url) {
  if (!env.MEDIA) return new Response('R2 미설정', { status: 503, headers: CORS })
  const key = decodeURIComponent(url.pathname.slice('/media-cloud/'.length))
  if (!key || key.includes('..')) return new Response('bad key', { status: 400, headers: CORS })
  const range = parseRangeHeader(request.headers.get('Range'))
  const object = await env.MEDIA.get(key, range ? { range } : undefined)
  if (!object) return new Response('not found', { status: 404, headers: CORS })

  const headers = new Headers(CORS)
  headers.set('Content-Type', MIME[extOf(key)] || 'application/octet-stream')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'public, max-age=3600')
  if (range && object.range) {
    const offset = object.range.offset ?? Math.max(0, object.size - (object.range.suffix ?? 0))
    const length = object.range.length ?? object.size - offset
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
    headers.set('Content-Length', String(length))
    return new Response(object.body, { status: 206, headers })
  }
  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}

async function cloudListHandler(env) {
  if (!env.MEDIA) return Response.json({ audio: [], video: [], image: [] }, { headers: CORS })
  const names = []
  let cursor
  do {
    const page = await env.MEDIA.list({ limit: 1000, cursor })
    names.push(...page.objects.map((o) => o.key))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  const pick = (exts) => names.filter((n) => exts.includes(extOf(n))).sort()
  return Response.json(
    { audio: pick(AUDIO_EXT), video: pick(VIDEO_EXT), image: pick(IMAGE_EXT) },
    { headers: CORS },
  )
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/lyrics') return lyricsHandler(url)
    if (url.pathname === '/api/playlist-tracks') return playlistTracksHandler(url)
    if (url.pathname === '/api/cloud-media') return cloudListHandler(env)
    if (url.pathname.startsWith('/media-cloud/')) return cloudMediaHandler(request, env, url)
    return env.ASSETS.fetch(request)
  },
}
