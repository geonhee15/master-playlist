import { useEffect, useState } from 'react'
import { GearIcon } from './Icons.jsx'
import { getNickname, setNickname } from '../profile.js'

// 우상단 끝 설정 버튼 — 닉네임 설정, 로그아웃 등
export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(getNickname())
  const [saved, setSaved] = useState(false)
  const isLocal = ['127.0.0.1', 'localhost'].includes(window.location.hostname)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const save = () => {
    setNickname(name)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const logout = () => {
    // Cloudflare Access 세션 로그아웃 (배포 사이트에서만 의미 있음)
    window.location.href = '/cdn-cgi/access/logout'
  }

  return (
    <>
      <button className="top-icon-btn" onClick={() => setOpen(!open)} title="설정">
        <GearIcon size={15} />
      </button>

      {open && (
        <>
          <div className="context-overlay" onClick={() => setOpen(false)} />
          <div className="settings-panel">
            <div className="settings-title">설정</div>

            <label className="field">
              <span>유저 닉네임</span>
              <div className="client-id-row">
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="닉네임 입력"
                  onKeyDown={(e) => e.key === 'Enter' && save()}
                />
                <button className="btn small" onClick={save}>
                  {saved ? '저장됨' : '저장'}
                </button>
              </div>
            </label>

            <div className="settings-sep" />

            <button
              className="menu-item danger"
              onClick={logout}
              disabled={isLocal}
              title={isLocal ? '배포 사이트(masterplaylist.net)에서만 동작해요' : ''}
            >
              로그아웃{isLocal ? ' (배포 사이트 전용)' : ''}
            </button>
          </div>
        </>
      )}
    </>
  )
}
