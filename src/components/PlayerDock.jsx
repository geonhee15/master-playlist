import { useEffect } from 'react'
import {
  PlayIcon,
  PauseIcon,
  PrevIcon,
  NextIcon,
  VideoIcon,
  FullscreenIcon,
  ShuffleIcon,
  RepeatOneIcon,
} from './Icons.jsx'

const fmt = (sec) => {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = String(Math.floor(sec % 60)).padStart(2, '0')
  return `${m}:${s}`
}

export default function PlayerDock({
  videoRef,
  videoEvents,
  track,
  mode,
  isPlaying,
  time,
  duration,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onToggleMode,
  onStop,
  shuffle,
  repeatOne,
  onToggleShuffle,
  onToggleRepeatOne,
  videoSize,
  onVideoSize,
  videoAspect,
  engine = 'file',
  ytMountRef,
}) {
  const showVideo = track && mode === 'video'

  // size는 "긴 쪽 변" 기준: 가로 영상은 너비, 세로(쇼츠) 영상은 높이.
  // 세로 영상도 충분히 작게 줄일 수 있다.
  const aspect = videoAspect || 16 / 9
  const displayWidth = Math.round(aspect >= 1 ? videoSize : videoSize * aspect)

  // 우상단 모서리 드래그로 영상 크기 조절 (비율은 video 요소가 자동 유지)
  const startResize = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startSize = videoSize
    const maxSize =
      aspect >= 1
        ? Math.min(window.innerWidth * 0.72, window.innerHeight * 0.72 * aspect)
        : Math.min(window.innerHeight * 0.72, (window.innerWidth * 0.72) / aspect)
    document.body.style.userSelect = 'none'
    const onMove = (ev) => {
      // 오른쪽/위로 끌면 커지고, 왼쪽/아래로 끌면 작아진다
      const delta = ev.clientX - startX - (ev.clientY - startY)
      onVideoSize(Math.round(Math.max(200, Math.min(maxSize, startSize + delta))))
    }
    const onUp = () => {
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 전체화면에서는 자체 컨트롤이 안 보이므로 브라우저 기본 컨트롤을 켠다
  useEffect(() => {
    const onFullscreenChange = () => {
      const v = videoRef.current
      if (v) v.controls = !!document.fullscreenElement
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [videoRef])

  const goFullscreen = async () => {
    const target =
      engine === 'youtube' ? ytMountRef?.current?.querySelector('iframe') : videoRef.current
    if (!target) return
    try {
      await target.requestFullscreen()
    } catch {
      // Safari 등 표준 API가 막힌 환경 폴백 (영상 전용 전체화면)
      target.webkitEnterFullscreen?.()
    }
  }

  return (
    <div className={`player-dock ${track ? '' : 'dock-hidden'}`}>
      <div className="video-panel" style={{ display: showVideo ? 'flex' : 'none' }}>
        <div className="video-box" style={{ width: displayWidth }}>
          {/* 이 <video> 엘리먼트가 파일 재생 엔진 (오디오 모드·유튜브 곡에선 숨김) */}
          <video
            ref={videoRef}
            playsInline
            preload="auto"
            style={{ display: engine === 'file' ? 'block' : 'none' }}
            {...videoEvents}
          />
          {/* 유튜브 곡은 IFrame Player가 여기 들어간다 */}
          <div
            className="yt-host"
            ref={ytMountRef}
            style={{
              display: engine === 'youtube' ? 'block' : 'none',
              height: engine === 'youtube' ? Math.round(displayWidth / (16 / 9)) : undefined,
            }}
          />
          <div className="video-resize-handle" onPointerDown={startResize} title="드래그로 크기 조절" />
        </div>
      </div>

      {track && (
        <div className="dock-controls">
          <div className="dock-info">
            <div className="dock-title ellipsis">{track.title}</div>
            <div className="muted small-text ellipsis">
              {[track.originalArtist, track.coverArtist && `커버: ${track.coverArtist}`]
                .filter(Boolean)
                .join(' · ') || ' '}
            </div>
          </div>

          <button
            className={`dock-btn toggle ${shuffle ? 'on' : ''}`}
            onClick={onToggleShuffle}
            title="셔플"
          >
            <ShuffleIcon size={14} />
          </button>
          <button className="dock-btn" onClick={onPrev} title="이전 곡">
            <PrevIcon size={15} />
          </button>
          <button className="dock-btn play" onClick={onTogglePlay} title="재생/일시정지">
            {isPlaying ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
          </button>
          <button className="dock-btn" onClick={onNext} title="다음 곡">
            <NextIcon size={15} />
          </button>
          <button
            className={`dock-btn toggle ${repeatOne ? 'on' : ''}`}
            onClick={onToggleRepeatOne}
            title="한 곡 반복"
          >
            <RepeatOneIcon size={14} />
          </button>

          <div className="dock-seek">
            <span>{fmt(time)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="any"
              value={Math.min(time, duration || 0)}
              onChange={(e) => onSeek(Number(e.target.value))}
            />
            <span>{fmt(duration)}</span>
          </div>

          {track.audioFile && track.videoFile && (
            <button className="btn small" onClick={onToggleMode}>
              {mode === 'audio' ? (
                <>
                  <VideoIcon size={13} /> 영상으로 전환
                </>
              ) : (
                '♪ 음악으로 전환'
              )}
            </button>
          )}

          {showVideo && (
            <button className="dock-btn" onClick={goFullscreen} title="전체화면">
              <FullscreenIcon size={14} />
            </button>
          )}

          <button className="dock-btn close" onClick={onStop} title="재생 종료">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
