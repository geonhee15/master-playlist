import { useEffect, useState } from 'react'
import { GearIcon } from './Icons.jsx'
import { getNickname, setNickname } from '../profile.js'
import {
  authEnabled,
  watchUser,
  linkGoogle,
  linkPassword,
  logoutAuth,
  hasProvider,
  authErrorMessage,
} from '../auth.js'

// 우상단 끝 설정 버튼 — 닉네임, 계정 연동, 로그아웃
export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(getNickname())
  const [saved, setSaved] = useState(false)
  const [user, setUser] = useState(null)
  const [linkPw, setLinkPw] = useState('')
  const [linkingPw, setLinkingPw] = useState(false)
  const [message, setMessage] = useState('')
  const isLocal = ['127.0.0.1', 'localhost'].includes(window.location.hostname)

  useEffect(() => watchUser(setUser), [])

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

  const doLinkGoogle = async () => {
    setMessage('')
    try {
      await linkGoogle()
      setMessage('구글 계정이 연동됐어요!')
    } catch (err) {
      setMessage(authErrorMessage(err))
    }
  }

  const doLinkPassword = async () => {
    if (!linkPw) return
    setMessage('')
    try {
      await linkPassword(linkPw)
      setLinkPw('')
      setLinkingPw(false)
      setMessage('이제 이메일/비밀번호로도 로그인할 수 있어요!')
    } catch (err) {
      setMessage(authErrorMessage(err))
    }
  }

  const logout = () => {
    if (authEnabled()) {
      logoutAuth()
      setOpen(false)
      return
    }
    // Firebase 미설정 시엔 Cloudflare Access 세션 로그아웃 (배포 사이트에서만 의미 있음)
    window.location.href = '/cdn-cgi/access/logout'
  }

  const googleLinked = hasProvider(user, 'google.com')
  const passwordLinked = hasProvider(user, 'password')

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

            {authEnabled() && user && (
              <>
                <div className="settings-sep" />
                <div className="settings-account">
                  <div className="field">
                    <span>계정</span>
                    <div className="account-line ellipsis">{user.email || '(이메일 없음)'}</div>
                    <div className="muted small-text">
                      로그인 수단: {[passwordLinked && '아이디/비번', googleLinked && 'Google']
                        .filter(Boolean)
                        .join(' + ') || '없음'}
                    </div>
                  </div>

                  {!googleLinked && (
                    <button className="btn small" onClick={doLinkGoogle}>
                      구글 계정 연동하기
                    </button>
                  )}

                  {!passwordLinked &&
                    (linkingPw ? (
                      <div className="client-id-row" style={{ marginTop: 6 }}>
                        <input
                          className="input"
                          type="password"
                          placeholder="새 비밀번호 (6자 이상)"
                          value={linkPw}
                          onChange={(e) => setLinkPw(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && doLinkPassword()}
                        />
                        <button className="btn small" onClick={doLinkPassword} disabled={!linkPw}>
                          연동
                        </button>
                      </div>
                    ) : (
                      <button className="btn small" onClick={() => setLinkingPw(true)}>
                        아이디/비번 로그인 연동하기
                      </button>
                    ))}

                  {message && <div className="muted small-text" style={{ marginTop: 6 }}>{message}</div>}
                </div>
              </>
            )}

            <div className="settings-sep" />

            <button
              className="menu-item danger"
              onClick={logout}
              disabled={!authEnabled() && isLocal}
              title={!authEnabled() && isLocal ? '배포 사이트(masterplaylist.net)에서만 동작해요' : ''}
            >
              로그아웃{!authEnabled() && isLocal ? ' (배포 사이트 전용)' : ''}
            </button>
          </div>
        </>
      )}
    </>
  )
}
