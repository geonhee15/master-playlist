// 로컬 사용 통계 — 대시보드용 (이 브라우저에만 저장)
const KEY = 'mp_stats'

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s))

export function recordSectionVisit(section) {
  const s = load()
  s.sectionVisits = s.sectionVisits || {}
  s.sectionVisits[section] = (s.sectionVisits[section] || 0) + 1
  save(s)
}

export function recordPlay({ source, title, sub }) {
  if (!title) return
  const s = load()
  s.plays = s.plays || {}
  const key = `${source}|${title}`
  const entry = s.plays[key] || { source, title, sub: sub || '', count: 0 }
  entry.count += 1
  if (sub) entry.sub = sub
  entry.lastAt = new Date().toISOString()
  s.plays[key] = entry
  save(s)
}

export function getStats() {
  const s = load()
  return {
    sectionVisits: s.sectionVisits || {},
    plays: Object.values(s.plays || {}),
  }
}
