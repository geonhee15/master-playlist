import { useEffect, useState } from 'react'
import { getNowPlaying, onNowPlayingChange, clearNowPlaying } from '../nowPlaying.js'
import { PlayIcon, PauseIcon } from './Icons.jsx'

// 왼쪽 아래 미니 플레이어 — 재생 중인 화면을 벗어나 있을 때만 보인다
export default function NowPlayingWidget({ section }) {
  const [state, setState] = useState(getNowPlaying())
  useEffect(() => onNowPlayingChange(setState), [])

  if (!state) return null
  // 재생 UI(상세/독)가 보이는 화면에서는 위젯을 숨긴다
  if (section === state.source && state.detailVisible) return null

  const open = () =>
    window.dispatchEvent(
      new CustomEvent('mp:navigate', {
        detail: { section: state.source, playlistId: state.playlistId },
      }),
    )

  const close = () => {
    state.controls?.stop?.()
    clearNowPlaying()
  }

  return (
    <div className="now-playing-widget">
      <button className="np-info" onClick={open} title="재생 화면으로 가기">
        <div className="np-label">Now playing</div>
        <div className="np-title ellipsis">{state.title}</div>
        {state.sub && <div className="np-sub ellipsis">{state.sub}</div>}
      </button>
      <div className="np-actions">
        <button className="np-btn" onClick={() => state.controls?.toggle?.()} title="재생/일시정지">
          {state.isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
        </button>
        <button className="np-btn" onClick={close} title="재생 종료">
          ✕
        </button>
      </div>
    </div>
  )
}
