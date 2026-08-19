import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import SpotifySection from './components/SpotifySection.jsx'
import CustomSection from './components/CustomSection.jsx'
import YouTubeSection from './components/YouTubeSection.jsx'
import VolumeControl from './components/VolumeControl.jsx'
import SettingsMenu from './components/SettingsMenu.jsx'
import GlobalSearch from './components/GlobalSearch.jsx'
import NowPlayingWidget from './components/NowPlayingWidget.jsx'
import ConsentBanner from './components/ConsentBanner.jsx'
import DashboardSection from './components/DashboardSection.jsx'
import { exchangeCode } from './spotify.js'
import { recordSectionVisit } from './stats.js'
import { getNowPlaying } from './nowPlaying.js'
import { MenuIcon } from './components/Icons.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import { authEnabled, watchUser } from './auth.js'
import { initSync } from './sync.js'

export default function App() {
  const [section, setSection] = useState('spotify')
  const [navOpen, setNavOpen] = useState(false) // 모바일 사이드바 드로어
  const [user, setUser] = useState(undefined) // undefined = 인증 상태 확인 중
  const loginPreview = window.location.search.includes('login-preview')

  useEffect(() => watchUser(setUser), [])
  useEffect(() => {
    initSync() // 로그인 계정으로 설정 동기화 (Firestore)
  }, [])
  const [booting, setBooting] = useState(window.location.pathname === '/callback')
  const [authError, setAuthError] = useState('')

  // Spotify 로그인 후 /callback 으로 돌아왔을 때 code → token 교환
  useEffect(() => {
    if (window.location.pathname !== '/callback') return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    const finish = () => {
      window.history.replaceState({}, '', '/')
      setBooting(false)
    }

    if (error) {
      setAuthError(`Spotify 인증이 취소되었어요 (${error})`)
      finish()
    } else if (code) {
      exchangeCode(code)
        .catch((e) => setAuthError(e.message))
        .finally(finish)
    } else {
      finish()
    }
  }, [])

  // 전역 검색 결과 클릭 → 해당 섹션으로 이동 (섹션 내부에서 플리를 연다)
  useEffect(() => {
    const onNavigate = (e) => setSection(e.detail.section)
    window.addEventListener('mp:navigate', onNavigate)
    return () => window.removeEventListener('mp:navigate', onNavigate)
  }, [])

  // 섹션 방문 통계 (대시보드용)
  useEffect(() => {
    recordSectionVisit(section)
  }, [section])

  // 스페이스바 = 지금 재생 중인 것(미니바가 가리키는 소스) 재생/일시정지.
  // 입력창 타이핑 중엔 무시, preventDefault로 스크롤·포커스된 버튼 눌림 방지.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.code !== 'Space' && e.key !== ' ') || e.defaultPrevented) return
      const t = e.target
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      )
        return
      const nowPlaying = getNowPlaying()
      if (!nowPlaying?.controls?.toggle) return
      e.preventDefault()
      nowPlaying.controls.toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="spinner" />
        <p>Spotify 연결 중…</p>
      </div>
    )
  }

  // 로그인 게이트 (Firebase 설정이 있을 때만; ?login-preview 로 디자인 미리보기 가능)
  if (authEnabled() || loginPreview) {
    if (user === undefined && !loginPreview) {
      return (
        <div className="boot-screen">
          <div className="spinner" />
        </div>
      )
    }
    if (!user) return <LoginScreen preview={loginPreview && !authEnabled()} />
  }

  return (
    <div className="app">
      <button className="mobile-nav-btn" onClick={() => setNavOpen(true)} title="메뉴">
        <MenuIcon size={16} />
      </button>
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <Sidebar
        section={section}
        open={navOpen}
        onSelect={(s) => {
          setSection(s)
          setNavOpen(false)
        }}
      />
      {/* 섹션을 전환해도 재생이 끊기지 않도록 언마운트 대신 숨김 처리 */}
      <main className="main">
        <div style={{ display: section === 'spotify' ? 'block' : 'none' }}>
          <SpotifySection authError={authError} clearAuthError={() => setAuthError('')} />
        </div>
        <div style={{ display: section === 'youtube' ? 'block' : 'none' }}>
          <YouTubeSection />
        </div>
        <div style={{ display: section === 'custom' ? 'block' : 'none' }}>
          <CustomSection />
        </div>
        {section === 'dashboard' && <DashboardSection />}
      </main>
      {/* 우상단 고정: 검색 · 음량 · 설정 */}
      <div className="top-controls">
        <GlobalSearch />
        <VolumeControl />
        <SettingsMenu />
      </div>
      <NowPlayingWidget section={section} />
      <ConsentBanner />
    </div>
  )
}
