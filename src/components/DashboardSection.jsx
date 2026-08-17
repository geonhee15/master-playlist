import { useEffect, useState } from 'react'
import { getNickname } from '../profile.js'
import { getStats } from '../stats.js'
import { isLoggedIn } from '../spotify.js'
import { getApiKey, getSavedPlaylistIds } from '../youtube.js'
import { loadVisitorLibrary } from '../library.js'

const SECTION_NAMES = { spotify: 'Spotify', youtube: 'YouTube', custom: 'Custom', dashboard: '대시보드' }

export default function DashboardSection() {
  const nickname = getNickname()
  const stats = getStats()
  const [customCount, setCustomCount] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/library')
        const type = res.headers.get('content-type') || ''
        const lib = res.ok && type.includes('json') ? await res.json() : loadVisitorLibrary()
        setCustomCount(lib.playlists?.length ?? 0)
      } catch {
        setCustomCount(loadVisitorLibrary().playlists?.length ?? 0)
      }
    })()
  }, [])

  const visits = Object.entries(stats.sectionVisits).filter(([k]) => k !== 'dashboard')
  const topSection = visits.sort((a, b) => b[1] - a[1])[0]
  const totalPlays = stats.plays.reduce((sum, p) => sum + p.count, 0)
  const topPlays = [...stats.plays].sort((a, b) => b.count - a.count).slice(0, 5)
  const spotifyOn = isLoggedIn()
  const youtubeOn = !!getApiKey()

  return (
    <section className="dashboard">
      <div className="dash-hero">
        <h1>
          Welcome{nickname ? (
            <>
              , <span className="dash-nick">{nickname}</span>
            </>
          ) : (
            ''
          )}
          !
        </h1>
        <p className="muted">나만의 마스터 플레이리스트 대시보드예요.</p>
      </div>

      <div className="dash-grid">
        <div className="card dash-card">
          <div className="dash-card-label">가장 자주 간 섹션</div>
          <div className="dash-card-value">
            {topSection ? SECTION_NAMES[topSection[0]] || topSection[0] : '아직 없음'}
          </div>
          {topSection && <div className="muted small-text">{topSection[1]}번 방문</div>}
        </div>

        <div className="card dash-card">
          <div className="dash-card-label">총 재생 횟수</div>
          <div className="dash-card-value">{totalPlays}</div>
          <div className="muted small-text">이 브라우저 기준</div>
        </div>

        <div className="card dash-card">
          <div className="dash-card-label">커스텀 플리</div>
          <div className="dash-card-value">{customCount ?? '…'}</div>
          <div className="muted small-text">YouTube 플리 {getSavedPlaylistIds().length}개 추가됨</div>
        </div>

        <div className="card dash-card">
          <div className="dash-card-label">연결된 계정</div>
          <div className="dash-links">
            <span className={`dash-link ${spotifyOn ? 'on' : ''}`}>
              Spotify {spotifyOn ? '연결됨' : '미연결'}
            </span>
            <span className={`dash-link ${youtubeOn ? 'on' : ''}`}>
              YouTube {youtubeOn ? '연결됨' : '미연결'}
            </span>
          </div>
        </div>
      </div>

      <div className="card dash-top">
        <h2>많이 들은 곡/영상</h2>
        {topPlays.length === 0 ? (
          <p className="muted">아직 재생 기록이 없어요 — 노래를 틀면 여기에 쌓여요.</p>
        ) : (
          <div className="dash-top-list">
            {topPlays.map((p, i) => (
              <div className="dash-top-row" key={`${p.source}|${p.title}`}>
                <span className="dash-rank">{i + 1}</span>
                <span className="track-title">
                  <b className="ellipsis">{p.title}</b>
                  <span className="muted ellipsis">{p.sub}</span>
                </span>
                <span className="dash-source muted">{SECTION_NAMES[p.source] || p.source}</span>
                <span className="dash-count">{p.count}회</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
