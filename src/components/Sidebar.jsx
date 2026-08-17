import { useEffect, useState } from 'react'
import { YouTubeIcon } from './Icons.jsx'
import { getNickname, onNicknameChange } from '../profile.js'

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.31a.75.75 0 0 1-1.03.25c-2.82-1.72-6.36-2.11-10.54-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.49-.59 11.65 1.34.35.21.46.67.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.96-1.4a.94.94 0 1 1-.55-1.79c4.36-1.32 9.78-.68 13.49 1.6.44.27.58.85.31 1.28zm.13-3.4C15.24 8.34 8.88 8.13 5.19 9.25a1.12 1.12 0 1 1-.65-2.15c4.24-1.28 11.28-1.03 15.72 1.6a1.12 1.12 0 0 1-1.16 1.94z" />
  </svg>
)

export default function Sidebar({ section, onSelect }) {
  const [nickname, setNicknameState] = useState(getNickname())
  useEffect(() => onNicknameChange(setNicknameState), [])

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">♪</span>
        <div>
          <div className="brand-title">Master Playlist</div>
          <div className="brand-sub">나만의 플레이리스트</div>
        </div>
      </div>

      <button
        className={`profile-block ${section === 'dashboard' ? 'active' : ''}`}
        onClick={() => onSelect('dashboard')}
        title="대시보드 열기"
      >
        <div className="nav-label">My profile</div>
        <div className="welcome-text">
          Welcome{nickname ? (
            <>
              , <b>{nickname}</b>
            </>
          ) : (
            ''
          )}
          !
        </div>
        {!nickname && <div className="muted small-text">우상단 설정에서 닉네임을 정해보세요</div>}
      </button>

      <nav className="nav">
        <div className="nav-label">섹션</div>
        <button
          className={`nav-item ${section === 'spotify' ? 'active' : ''}`}
          onClick={() => onSelect('spotify')}
        >
          <span className="nav-icon spotify">
            <SpotifyIcon />
          </span>
          Spotify
        </button>
        <button
          className={`nav-item ${section === 'youtube' ? 'active' : ''}`}
          onClick={() => onSelect('youtube')}
        >
          <span className="nav-icon youtube">
            <YouTubeIcon size={17} />
          </span>
          YouTube
        </button>
        <button
          className={`nav-item ${section === 'custom' ? 'active' : ''}`}
          onClick={() => onSelect('custom')}
        >
          <span className="nav-icon custom">♬</span>
          Custom
        </button>
        <div className="nav-item disabled">
          <span className="nav-icon">+</span>새 섹션 (예정)
        </div>
      </nav>
    </aside>
  )
}
