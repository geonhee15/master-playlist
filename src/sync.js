// 기기 간 설정 동기화 — 로그인한 Firebase 계정(Firestore users/{uid})에 저장.
// 동기화 대상: 닉네임, Spotify Client ID, YouTube API 키, 추가한 YouTube 플리 목록.
// (Spotify 재생 토큰은 보안·토큰 회전 문제로 동기화하지 않음 — 기기마다 "연결하기" 한 번 필요)
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore'
import { authEnabled, getFirebaseApp, watchUser } from './auth.js'

const SYNC_KEYS = ['mp_nickname', 'sp_client_id', 'yt_api_key', 'yt_playlists']

let uid = null
let db = null
let started = false

export function initSync() {
  if (started || !authEnabled()) return
  started = true
  watchUser(async (user) => {
    uid = user?.uid || null
    if (!uid) return
    try {
      db = db || getFirestore(getFirebaseApp())
      const ref = doc(db, 'users', uid)
      const snap = await getDoc(ref)
      const cloud = snap.exists() ? snap.data() : {}

      let applied = false
      const toPush = {}
      for (const key of SYNC_KEYS) {
        const local = localStorage.getItem(key)
        if (cloud[key] != null && cloud[key] !== local) {
          localStorage.setItem(key, cloud[key]) // 클라우드(계정) 값 우선
          applied = true
        } else if (cloud[key] == null && local != null) {
          toPush[key] = local // 이 기기에만 있는 값은 계정에 올림
        }
      }
      if (Object.keys(toPush).length) await setDoc(ref, toPush, { merge: true })

      // 계정 값이 적용됐으면 모듈들이 새 값으로 초기화되도록 한 번 새로고침
      if (applied) window.location.reload()
    } catch {
      /* Firestore 미활성/오프라인 → 동기화 없이 동작 */
    }
  })
}

// 설정이 바뀔 때 호출 — 계정에 반영
export async function pushKey(key) {
  if (!uid || !db) return
  try {
    await setDoc(doc(db, 'users', uid), { [key]: localStorage.getItem(key) }, { merge: true })
  } catch {
    /* 무시 */
  }
}
