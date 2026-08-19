// 커스텀 섹션 — 로컬 라이브러리 API 클라이언트
// 방문자 모드(배포 사이트)에서는 선택한 폴더의 object URL과 localStorage 라이브러리를 쓴다.

let visitorMediaResolver = null
export const setVisitorMediaResolver = (fn) => {
  visitorMediaResolver = fn
}

export const loadVisitorLibrary = () => {
  try {
    return JSON.parse(localStorage.getItem('mp_visitor_library')) || { playlists: [] }
  } catch {
    return { playlists: [] }
  }
}
export const saveVisitorLibrary = (library) =>
  localStorage.setItem('mp_visitor_library', JSON.stringify(library))

export async function loadLibrary() {
  const res = await fetch('/api/library')
  if (!res.ok) throw new Error('라이브러리를 불러오지 못했어요')
  return res.json()
}

export async function saveLibrary(library) {
  const res = await fetch('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(library),
  })
  if (!res.ok) throw new Error('저장에 실패했어요')
}

// 플리 하나만 저장/삭제 — 서버가 병합 후 최신 전체 라이브러리를 돌려준다
export async function savePlaylist(playlist) {
  const res = await fetch('/api/playlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playlist),
  })
  if (!res.ok) throw new Error('저장에 실패했어요')
  return res.json()
}

export async function deletePlaylistById(id) {
  const res = await fetch('/api/playlist-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error('삭제에 실패했어요')
  return res.json()
}

export async function listMedia() {
  const res = await fetch('/api/media')
  if (!res.ok) throw new Error('파일 목록을 불러오지 못했어요')
  return res.json()
}

export function openMediaFolder() {
  fetch('/api/open-folder', { method: 'POST' }).catch(() => {})
}

export const mediaUrl = (file) =>
  visitorMediaResolver ? visitorMediaResolver(file) : `/media/${encodeURIComponent(file)}`

// ---- 외부 URL 미디어 (구글 드라이브/드롭박스/직접 링크) ----
// 공유 링크를 브라우저가 바로 재생할 수 있는 직접 링크로 변환
export function normalizeMediaUrl(url) {
  if (!url) return ''
  const u = String(url).trim()
  // 구글 드라이브: file/d/ID, open?id=ID, uc?id=ID 형태 모두 지원
  const drive = u.match(
    /drive\.google\.com\/(?:file\/d\/([\w-]+)|open\?id=([\w-]+)|uc\?(?:[^#]*&)?id=([\w-]+))/,
  )
  if (drive) {
    const id = drive[1] || drive[2] || drive[3]
    return `https://drive.usercontent.google.com/download?id=${id}&export=download`
  }
  // 드롭박스 공유 링크 → 직접 링크
  if (/www\.dropbox\.com\//.test(u))
    return u.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/([?&])dl=0/, '$1raw=1')
  return u
}

// 곡의 재생 소스: 로컬 파일 우선, 없으면 외부 URL(클라우드 포함)
export const trackHasAudio = (t) => !!(t?.audioFile || t?.audioUrl)
export const trackHasVideo = (t) => !!(t?.videoFile || t?.videoUrl)
export const trackAudioSrc = (t) =>
  t?.audioFile ? mediaUrl(t.audioFile) : normalizeMediaUrl(t?.audioUrl)
export const trackVideoSrc = (t) =>
  t?.videoFile ? mediaUrl(t.videoFile) : normalizeMediaUrl(t?.videoUrl)

// ---- 클라우드 미디어 (Cloudflare R2, Worker가 서빙) — 어느 기기서나 재생 ----
const CLOUD_BASE = 'https://masterplaylist.net'
export const cloudFileUrl = (name) => `${CLOUD_BASE}/media-cloud/${encodeURIComponent(name)}`
export const cloudNameFromUrl = (url) => {
  const m = String(url || '').match(/\/media-cloud\/([^?#]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export async function listCloudMedia() {
  try {
    const res = await fetch(`${CLOUD_BASE}/api/cloud-media`)
    if (!res.ok) return { audio: [], video: [], image: [] }
    return await res.json()
  } catch {
    return { audio: [], video: [], image: [] }
  }
}
