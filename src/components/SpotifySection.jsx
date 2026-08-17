import { useEffect, useState } from 'react'
import SetupCard from './SetupCard.jsx'
import PlaylistDetail from './PlaylistDetail.jsx'
import {
  getClientId,
  isLoggedIn,
  startLogin,
  logout,
  getMe,
  getAllPlaylists,
} from '../spotify.js'

const LIKED = { id: '__liked__', name: '좋아요 표시한 곡', images: [] }

export default function SpotifySection({ authError, clearAuthError }) {
  const [hasClientId, setHasClientId] = useState(!!getClientId())
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [me, setMe] = useState(null)
  const [playlists, setPlaylists] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [editingSetup, setEditingSetup] = useState(false)

  useEffect(() => {
    if (!loggedIn) return
    // 프로필은 부가 정보라 실패해도 플레이리스트 로딩을 막지 않는다
    getMe()
      .then(setMe)
      .catch(() => {})
    getAllPlaylists()
      .then((lists) => setPlaylists(lists.filter(Boolean)))
      .catch((e) => {
        setError(e)
        // 토큰이 완전히 만료/폐기된 경우 다시 연결하도록
        if (String(e.message).includes('로그인')) {
          logout()
          setLoggedIn(false)
        }
      })
  }, [loggedIn])

  // 전역 검색에서 Spotify 플리 클릭 → 해당 플리 열기
  useEffect(() => {
    const onNavigate = (e) => {
      if (e.detail?.section !== 'spotify') return
      setPlaylists((current) => {
        const target = current?.find((p) => p.id === e.detail.playlistId)
        if (target) setSelected(target)
        return current
      })
    }
    window.addEventListener('mp:navigate', onNavigate)
    return () => window.removeEventListener('mp:navigate', onNavigate)
  }, [])

  const disconnect = () => {
    logout()
    setLoggedIn(false)
    setMe(null)
    setPlaylists(null)
    setSelected(null)
  }

  // 1) Client ID 설정 전 (또는 수정 중)
  if (!hasClientId || editingSetup) {
    return (
      <section>
        <h1 className="section-title">Spotify</h1>
        <SetupCard
          onSaved={() => {
            setHasClientId(true)
            setEditingSetup(false)
          }}
        />
      </section>
    )
  }

  // 2) 연결 전
  if (!loggedIn) {
    return (
      <section>
        <h1 className="section-title">Spotify</h1>
        {authError && (
          <div className="error-box">
            {authError}{' '}
            <button className="btn small" onClick={clearAuthError}>
              닫기
            </button>
          </div>
        )}
        <div className="card connect-card">
          <h2>Spotify 계정 연결</h2>
          <p className="muted">연결하면 내 플레이리스트를 여기서 바로 볼 수 있어요.</p>
          <div className="connect-actions">
            <button className="btn primary" onClick={startLogin}>
              Spotify 연결하기
            </button>
            <button className="btn" onClick={() => setEditingSetup(true)}>
              Client ID 변경
            </button>
          </div>
        </div>
      </section>
    )
  }

  // 3) 플레이리스트 상세
  if (selected) {
    return (
      <section>
        <h1 className="section-title">Spotify</h1>
        <PlaylistDetail playlist={selected} onBack={() => setSelected(null)} />
      </section>
    )
  }

  // 4) 라이브러리 (플레이리스트 그리드)
  return (
    <section>
      <div className="section-head">
        <h1 className="section-title">Spotify</h1>
        <div className="profile-chip">
          {me?.images?.[0]?.url && <img src={me.images[0].url} alt="" />}
          <span>{me?.display_name || '…'}</span>
          <button className="btn small" onClick={disconnect}>
            연결 해제
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box">
          <div>{error.message}</div>
          {error.status === 403 && (
            <p className="error-hint">
              앱이 Development mode일 때는 <b>앱을 만든 계정</b>이거나 대시보드의{' '}
              <b>Settings → User Management</b>에 등록된 계정만 사용할 수 있어요. 방금 로그인한
              Spotify 계정이 맞는지 확인해보세요.
            </p>
          )}
        </div>
      )}

      {!playlists ? (
        <div className="loading-row">
          <div className="spinner" />
          <span className="muted">플레이리스트 불러오는 중…</span>
        </div>
      ) : (
        <div className="grid">
          <button className="card playlist-card liked" onClick={() => setSelected(LIKED)}>
            <div className="cover placeholder liked-cover">♥</div>
            <div className="playlist-name">좋아요 표시한 곡</div>
            <div className="muted small-text">내 라이브러리</div>
          </button>
          {playlists.map((p) => (
            <button className="card playlist-card" key={p.id} onClick={() => setSelected(p)}>
              {p.images?.[0]?.url ? (
                <img className="cover" src={p.images[0].url} alt="" loading="lazy" />
              ) : (
                <div className="cover placeholder">♪</div>
              )}
              <div className="playlist-name">{p.name}</div>
              <div className="muted small-text">
                {/* Spotify 목록 API가 곡 수를 0으로 잘못 주는 경우가 있어 그때는 숨긴다 */}
                {p.tracks?.total > 0 && `${p.tracks.total}곡 · `}
                {p.owner?.id === 'spotify' ? (
                  <span className="owner-badge">Spotify 제작</span>
                ) : (
                  p.owner?.display_name
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
