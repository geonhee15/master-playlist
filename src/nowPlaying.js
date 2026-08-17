// 전역 "Now playing" 상태 — 어느 섹션에서 재생 중이든 왼쪽 아래 위젯이 구독한다
// state: { source: 'spotify'|'youtube'|'custom', playlistId, title, sub,
//          isPlaying, detailVisible, controls: { toggle, stop } } | null
let state = null

const listeners = new Set()
const emit = () => {
  for (const fn of listeners) fn(state)
}

export const getNowPlaying = () => state

export const setNowPlaying = (next) => {
  // 다른 소스가 재생을 시작하면 기존 소스는 일시정지 (중첩 재생 방지)
  if (state && next && state.source !== next.source) {
    try {
      ;(state.controls?.pause || state.controls?.stop)?.()
    } catch {
      /* 이전 플레이어가 이미 사라진 경우 */
    }
  }
  state = next
  emit()
}

export const updateNowPlaying = (partial) => {
  if (!state) return
  state = { ...state, ...partial }
  emit()
}

// source를 주면 그 소스일 때만 지운다 (다른 소스가 이미 덮어썼으면 유지)
export const clearNowPlaying = (source) => {
  if (source && state?.source !== source) return
  state = null
  emit()
}

export const onNowPlayingChange = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
