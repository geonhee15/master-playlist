import { useState } from 'react'
import { getClientId, setClientId, redirectUri } from '../spotify.js'

export default function SetupCard({ onSaved }) {
  const [value, setValue] = useState(getClientId())
  const [copied, setCopied] = useState(false)
  const uri = redirectUri()

  const copyUri = async () => {
    await navigator.clipboard.writeText(uri)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const save = () => {
    if (!value.trim()) return
    setClientId(value)
    onSaved()
  }

  return (
    <div className="card setup-card">
      <h2>Spotify 연동 설정</h2>
      <p className="muted">
        내 플레이리스트를 불러오려면 Spotify 개발자 앱이 하나 필요해요. 한 번만 하면 됩니다 (약 2분).
      </p>

      <ol className="steps">
        <li>
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
            developer.spotify.com/dashboard
          </a>
          에 접속해서 <b>본인 Spotify 계정</b>으로 로그인
        </li>
        <li>
          <b>Create app</b> 클릭 — 이름/설명은 아무거나 (예: Master Playlist)
        </li>
        <li>
          <b>Redirect URI</b>에 아래 주소를 붙여넣고 <b>Add</b> 클릭:
          <div className="uri-row">
            <code>{uri}</code>
            <button className="btn small" onClick={copyUri}>
              {copied ? '복사됨 ✓' : '복사'}
            </button>
          </div>
        </li>
        <li>
          API 선택 항목이 나오면 <b>Web API</b> 체크 후 <b>Save</b>
        </li>
        <li>
          생성된 앱의 <b>Settings</b>에서 <b>Client ID</b>를 복사해 아래에 붙여넣기
        </li>
      </ol>

      <div className="client-id-row">
        <input
          className="input"
          placeholder="Client ID 붙여넣기"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button className="btn primary" onClick={save} disabled={!value.trim()}>
          저장
        </button>
      </div>

      <p className="hint">
        <b>주의:</b> 사이트는 반드시 <code>http://127.0.0.1:5173</code> 으로 열어야 해요 (localhost
        불가 — Spotify가 127.0.0.1만 허용).
      </p>
    </div>
  )
}
