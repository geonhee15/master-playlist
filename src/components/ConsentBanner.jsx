import { useState } from 'react'
import { getConsent, setConsent } from '../consent.js'

// 첫 방문 시 하단 동의 배너 — 브라우저 저장(쿠키/localStorage) 사용 안내
export default function ConsentBanner() {
  const [answered, setAnswered] = useState(!!getConsent())
  if (answered) return null

  const choose = (value) => {
    setConsent(value)
    setAnswered(true)
    if (value === 'all') window.dispatchEvent(new Event('mp:consent-all'))
  }

  return (
    <div className="consent-banner">
      <div className="consent-text">
        이 사이트는 설정·플리 데이터를 <b>이 브라우저에만</b> 저장해요 (로컬 저장소 사용, 외부 전송
        없음). 모두 동의하면 <b>음악 폴더 자동 연결</b> 같은 편의 기능이 켜져요.
      </div>
      <div className="consent-actions">
        <button className="btn primary small" onClick={() => choose('all')}>
          모두 동의
        </button>
        <button className="btn small" onClick={() => choose('essential')}>
          필수만
        </button>
      </div>
    </div>
  )
}
