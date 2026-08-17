// 전역 음량 상태 (0~1) — 모든 재생 엔진(파일 <video>, 유튜브 플레이어)이 구독한다
let volume = (() => {
  const raw = localStorage.getItem('mp_volume')
  if (raw === null) return 1 // 저장된 값이 없으면 최대 음량
  const saved = Number(raw)
  return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1
})()

const listeners = new Set()

export const getVolume = () => volume

export const setVolume = (v) => {
  volume = Math.max(0, Math.min(1, v))
  localStorage.setItem('mp_volume', String(volume))
  for (const fn of listeners) fn(volume)
}

export const onVolumeChange = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
