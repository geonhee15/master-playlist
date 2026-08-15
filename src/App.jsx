import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import SpotifySection from './components/SpotifySection.jsx'
import CustomSection from './components/CustomSection.jsx'
import { exchangeCode } from './spotify.js'

export default function App() {
  const [section, setSection] = useState('spotify')
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

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="spinner" />
        <p>Spotify 연결 중…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <Sidebar section={section} onSelect={setSection} />
      {/* 섹션을 전환해도 재생이 끊기지 않도록 언마운트 대신 숨김 처리 */}
      <main className="main">
        <div style={{ display: section === 'spotify' ? 'block' : 'none' }}>
          <SpotifySection authError={authError} clearAuthError={() => setAuthError('')} />
        </div>
        <div style={{ display: section === 'custom' ? 'block' : 'none' }}>
          <CustomSection />
        </div>
      </main>
    </div>
  )
}
