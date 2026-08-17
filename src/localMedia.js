// 방문자 모드 — File System Access API로 방문자 자신의 로컬 폴더를 미디어 소스로 사용.
// 파일은 업로드되지 않고, object URL로 이 브라우저 안에서만 재생된다.
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac', '.opus', '.aiff'])
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v', '.mkv'])
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'])

export const supportsFolderPick = () => typeof window.showDirectoryPicker === 'function'

let dirHandle = null
let urlMap = new Map()

// ---- 폴더 핸들을 IndexedDB에 저장해서 다음 방문 때 재연결 ----
const DB_NAME = 'mp-local'
const STORE = 'handles'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveHandle(handle) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(handle, 'media')
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* 저장 실패해도 이번 세션은 동작 */
  }
}

async function loadHandle() {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get('media')
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export const hasSavedFolder = async () => !!(await loadHandle())

// ---- 폴더 선택/재연결/스캔 ----
export async function pickFolder() {
  dirHandle = await window.showDirectoryPicker()
  await saveHandle(dirHandle)
  return scanFolder()
}

// 페이지 로드 시 자동 재연결 — 브라우저가 권한을 기억하고 있을 때만 (제스처 불필요)
export async function autoReconnectFolder() {
  try {
    const handle = await loadHandle()
    if (!handle) return null
    const perm = await handle.queryPermission({ mode: 'read' })
    if (perm !== 'granted') return null
    dirHandle = handle
    return await scanFolder()
  } catch {
    return null
  }
}

// 저장해둔 폴더 재연결 (권한 재요청은 사용자 클릭 안에서 호출해야 함)
export async function reconnectFolder() {
  const handle = await loadHandle()
  if (!handle) return null
  let perm = await handle.queryPermission({ mode: 'read' })
  if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'read' })
  if (perm !== 'granted') return null
  dirHandle = handle
  return scanFolder()
}

export async function scanFolder() {
  if (!dirHandle) return null
  for (const url of urlMap.values()) URL.revokeObjectURL(url)
  urlMap = new Map()
  const media = { audio: [], video: [], image: [] }
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== 'file' || name.startsWith('.')) continue
    const dot = name.lastIndexOf('.')
    if (dot < 0) continue
    const ext = name.slice(dot).toLowerCase()
    const kind = AUDIO_EXT.has(ext)
      ? 'audio'
      : VIDEO_EXT.has(ext)
        ? 'video'
        : IMAGE_EXT.has(ext)
          ? 'image'
          : null
    if (!kind) continue
    const file = await handle.getFile()
    urlMap.set(name, URL.createObjectURL(file))
    media[kind].push(name)
  }
  media.audio.sort()
  media.video.sort()
  media.image.sort()
  return media
}

export const isFolderConnected = () => !!dirHandle
export const folderName = () => dirHandle?.name || ''
export const localFileUrl = (name) => urlMap.get(name) || ''
