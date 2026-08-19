import { useState } from 'react'
import { loginWithEmail, signupWithEmail, loginWithGoogle, authErrorMessage } from '../auth.js'

// 우리 디자인의 로그인 화면 — 이메일/비번 + 구글
export default function LoginScreen({ preview }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (preview) return setError('미리보기 모드예요 — Firebase 설정 후 동작합니다.')
    if (!email.trim() || !password) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') await loginWithEmail(email.trim(), password)
      else await signupWithEmail(email.trim(), password)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    if (preview) return setError('미리보기 모드예요 — Firebase 설정 후 동작합니다.')
    setError('')
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(authErrorMessage(err))
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">♪</span>
          <div>
            <div className="brand-title">Master Playlist</div>
            <div className="brand-sub">나만의 플레이리스트</div>
          </div>
        </div>

        <h1>{mode === 'login' ? '로그인' : '회원가입'}</h1>

        <div className="login-fields">
          <input
            className="input"
            type="email"
            placeholder="이메일 (아이디)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="input"
            type="password"
            placeholder={mode === 'signup' ? '비밀번호 (6자 이상)' : '비밀번호'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button
          className="btn primary login-submit"
          onClick={submit}
          disabled={busy || !email.trim() || !password}
        >
          {busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
        </button>

        <div className="login-divider">
          <span>또는</span>
        </div>

        <button className="btn login-google" onClick={google}>
          <span className="google-g">G</span> Google로 계속하기
        </button>

        <p className="login-switch muted">
          {mode === 'login' ? (
            <>
              계정이 없나요?{' '}
              <button className="link-btn" onClick={() => { setMode('signup'); setError('') }}>
                회원가입
              </button>
            </>
          ) : (
            <>
              이미 계정이 있나요?{' '}
              <button className="link-btn" onClick={() => { setMode('login'); setError('') }}>
                로그인
              </button>
            </>
          )}
        </p>

        <p className="hint" style={{ textAlign: 'center' }}>
          아이디로 가입해도 나중에 설정에서 구글 계정을 연동할 수 있어요 (반대도 가능).
        </p>
      </div>
    </div>
  )
}
