// 쿠키/로컬 저장소 사용 동의 — 'all'(편의 기능 포함) | 'essential'(필수만)
const KEY = 'mp_consent'

export const getConsent = () => localStorage.getItem(KEY) || ''
export const setConsent = (value) => localStorage.setItem(KEY, value)
export const allowsConvenience = () => getConsent() === 'all'
