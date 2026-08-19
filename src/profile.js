// 유저 프로필 (닉네임) — localStorage 저장, 구독 방식은 volume.js와 동일
import { pushKey } from './sync.js'

let nickname = localStorage.getItem('mp_nickname') || ''

const listeners = new Set()

export const getNickname = () => nickname

export const setNickname = (name) => {
  nickname = String(name).trim()
  localStorage.setItem('mp_nickname', nickname)
  pushKey('mp_nickname')
  for (const fn of listeners) fn(nickname)
}

export const onNicknameChange = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
