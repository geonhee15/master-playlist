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
