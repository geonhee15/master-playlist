// 커스텀 섹션용 로컬 API — Vite 개발 서버에 붙는 미들웨어
// - GET  /api/library     : data/library.json 읽기
// - POST /api/library     : data/library.json 쓰기
// - GET  /api/media       : public/media 폴더의 오디오/영상 파일 목록
// - POST /api/open-folder : Finder로 미디어 폴더 열기
// - GET  /api/lyrics      : LRCLIB(lrclib.net)에서 싱크 가사 검색 (CORS 우회 프록시)
import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'

const ROOT = process.cwd()
const DATA_FILE = path.join(ROOT, 'data', 'library.json')
const MEDIA_DIR = path.join(ROOT, 'public', 'media')

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac', '.opus', '.aiff'])
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v', '.mkv'])
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'])

const MIME = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.opus': 'audio/ogg',
  '.aiff': 'audio/aiff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
}

const sendJson = (res, data, status = 200) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(typeof data === 'string' ? data : JSON.stringify(data))
}

// 미디어 파일 스트리밍 — Range 요청 지원 (영상/오디오 구간 탐색에 필요).
// Vite의 public 폴더 서빙은 서버 시작 후 추가된 파일을 못 찾는 경우가 있어 직접 처리한다.
function serveMedia(req, res, url) {
  const name = decodeURIComponent(url.slice('/media/'.length))
  const filePath = path.join(MEDIA_DIR, name)
  if (name.includes('/') || name.includes('..') || !filePath.startsWith(MEDIA_DIR)) {
    res.statusCode = 403
    return res.end('forbidden')
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404
    return res.end('not found')
  }

  const size = fs.statSync(filePath).size
  res.setHeader('Content-Type', MIME[path.extname(name).toLowerCase()] || 'application/octet-stream')
  res.setHeader('Accept-Ranges', 'bytes')

  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range)
  if (range && (range[1] || range[2])) {
    let start = range[1] ? parseInt(range[1], 10) : size - parseInt(range[2], 10)
    let end = range[1] && range[2] ? parseInt(range[2], 10) : size - 1
    if (Number.isNaN(start) || start < 0 || start > end || end >= size) {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${size}`)
      return res.end()
    }
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
    res.setHeader('Content-Length', end - start + 1)
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(filePath, { start, end }).pipe(res)
  } else {
    res.setHeader('Content-Length', size)
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(filePath).pipe(res)
  }
}

// ---- 플레이리스트 트랙 우회 조회 ----
// Spotify가 신규 개발자 앱의 플레이리스트 트랙 API를 제한하는 경우가 있어,
// 공개 임베드 페이지(open.spotify.com/embed)에 포함된 JSON에서 트랙 목록을 읽어온다.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

async function fetchEmbedTracks(playlistId) {
  if (!/^[A-Za-z0-9]+$/.test(playlistId)) return null
  try {
    const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
      headers: { 'User-Agent': BROWSER_UA },
    })
    if (!res.ok) return null
    const html = await res.text()
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>(.*?)<\/script>/s)
    if (!m) return null
    const entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity
    if (!Array.isArray(entity?.trackList)) return null
    return {
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
    }
  } catch {
    return null
  }
}

// ---- 가사 (LRCLIB) ----
const LRCLIB_HEADERS = { 'User-Agent': 'MasterPlaylist/0.1 (personal project)' }
const lyricsCache = new Map()

async function fetchLyrics(q) {
  const key = `${q.artist}|${q.track}|${q.album}|${q.duration}`
  if (lyricsCache.has(key)) return lyricsCache.get(key)

  let result = null
  try {
    // 1차: 정확 매칭
    const exact = new URLSearchParams({
      track_name: q.track || '',
      artist_name: q.artist || '',
      album_name: q.album || '',
      duration: q.duration || '',
    })
    let res = await fetch(`https://lrclib.net/api/get?${exact}`, { headers: LRCLIB_HEADERS })
    if (res.ok) result = await res.json()

    // 2차: 검색 후 재생시간이 비슷한 것 중 싱크 가사 우선
    if (!result?.syncedLyrics && !result?.plainLyrics) {
      const search = new URLSearchParams({ track_name: q.track || '', artist_name: q.artist || '' })
      res = await fetch(`https://lrclib.net/api/search?${search}`, { headers: LRCLIB_HEADERS })
      if (res.ok) {
        const list = await res.json()
        const dur = Number(q.duration) || 0
        const closeEnough = (x) => !dur || Math.abs((x.duration || 0) - dur) <= 3
        result =
          list.find((x) => x.syncedLyrics && closeEnough(x)) ||
          list.find((x) => x.syncedLyrics) ||
          list.find((x) => x.plainLyrics && closeEnough(x)) ||
          null
      }
    }
  } catch {
    result = null
  }
  lyricsCache.set(key, result)
  return result
}

export default function libraryPlugin() {
  return {
    name: 'master-playlist-library',
    configureServer(server) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true })
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
      if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ playlists: [] }, null, 2))
      }

      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]

        if (url === '/api/library' && req.method === 'GET') {
          sendJson(res, fs.readFileSync(DATA_FILE, 'utf8'))
        } else if (url === '/api/library' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body)
              fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2))
              sendJson(res, { ok: true })
            } catch {
              sendJson(res, { error: 'invalid json' }, 400)
            }
          })
        } else if (url === '/api/playlist' && req.method === 'POST') {
          // 플리 하나만 저장 (탭 여러 개가 서로의 변경을 덮어쓰지 않도록 플리 단위로 병합)
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            try {
              const pl = JSON.parse(body)
              const lib = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
              const idx = lib.playlists.findIndex((p) => p.id === pl.id)
              if (idx >= 0) lib.playlists[idx] = pl
              else lib.playlists.push(pl)
              fs.writeFileSync(DATA_FILE, JSON.stringify(lib, null, 2))
              sendJson(res, lib)
            } catch {
              sendJson(res, { error: 'invalid json' }, 400)
            }
          })
        } else if (url === '/api/playlist-delete' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            try {
              const { id } = JSON.parse(body)
              const lib = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
              lib.playlists = lib.playlists.filter((p) => p.id !== id)
              fs.writeFileSync(DATA_FILE, JSON.stringify(lib, null, 2))
              sendJson(res, lib)
            } catch {
              sendJson(res, { error: 'invalid json' }, 400)
            }
          })
        } else if (url === '/api/media' && req.method === 'GET') {
          const files = fs.readdirSync(MEDIA_DIR).filter((f) => !f.startsWith('.'))
          sendJson(res, {
            audio: files.filter((f) => AUDIO_EXT.has(path.extname(f).toLowerCase())).sort(),
            video: files.filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase())).sort(),
            image: files.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase())).sort(),
          })
        } else if (url === '/api/open-folder' && req.method === 'POST') {
          exec(`open "${MEDIA_DIR}"`)
          sendJson(res, { ok: true })
        } else if (url === '/api/playlist-tracks' && req.method === 'GET') {
          const id = new URL(req.url, 'http://localhost').searchParams.get('id') || ''
          fetchEmbedTracks(id).then((data) => sendJson(res, data || {}))
        } else if (url === '/api/lyrics' && req.method === 'GET') {
          const q = new URL(req.url, 'http://localhost').searchParams
          fetchLyrics({
            track: q.get('track') || '',
            artist: q.get('artist') || '',
            album: q.get('album') || '',
            duration: q.get('duration') || '',
          }).then((data) => sendJson(res, data || {}))
        } else if (url.startsWith('/media/') && (req.method === 'GET' || req.method === 'HEAD')) {
          serveMedia(req, res, url)
        } else {
          next()
        }
      })
    },
  }
}
