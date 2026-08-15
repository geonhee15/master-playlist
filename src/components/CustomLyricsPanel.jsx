import { useEffect, useRef } from 'react'
import { parseLrc, showSingerLabel } from './LyricsPanel.jsx'

// 커스텀 섹션용 가사 패널 — 직접 입력한 가사를 표시.
// LRC 타임스탬프가 있으면 재생 시간에 맞춰 하이라이트/자동 스크롤, 없으면 일반 텍스트.
export default function CustomLyricsPanel({ track, time, onSeek, maxLines = 7 }) {
  // 한 줄 ≈ 35px — maxLines 만큼만 보이도록 높이 제한
  const scrollStyle = { maxHeight: maxLines * 35 + 8 }
  const listRef = useRef(null)
  // 사용자가 직접 스크롤하면 잠시 자동 스크롤을 멈춘다
  const manualAtRef = useRef(0)
  const markManual = () => {
    manualAtRef.current = Date.now()
  }
  const lines = track?.lyrics ? parseLrc(track.lyrics) : []
  const synced = lines.length > 0

  let active = -1
  if (synced) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= time + 0.25) active = i
      else break
    }
  }

  // 활성 줄을 패널 가운데로 자동 스크롤 (직접 스크롤 후 4초간은 개입하지 않음)
  useEffect(() => {
    if (Date.now() - manualAtRef.current < 4000) return
    const list = listRef.current
    const el = list?.children[active]
    if (el) {
      list.scrollTo({
        top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2,
        behavior: 'smooth',
      })
    }
  }, [active])

  return (
    <div className="lyrics-panel">
      <div className="lyrics-head">
        <h3>가사</h3>
        {synced && <span className="muted small-text">줄을 클릭하면 이동</span>}
      </div>

      {!track ? (
        <p className="muted">곡을 재생하면 가사가 여기에 표시돼요.</p>
      ) : !track.lyrics?.trim() ? (
        <p className="muted">
          이 곡에 등록된 가사가 없어요. 곡의 수정(✎) 버튼을 눌러 가사를 붙여넣을 수 있어요.
        </p>
      ) : synced ? (
        <div
          className="lyrics-scroll"
          style={scrollStyle}
          ref={listRef}
          onWheel={markManual}
          onTouchMove={markManual}
          onPointerDown={markManual}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              className={`lyric-line ${i === active ? 'active' : ''} ${i < active ? 'past' : ''}`}
              onClick={() => {
                manualAtRef.current = 0 // 줄 클릭으로 이동하면 자동 스크롤 바로 재개
                onSeek?.(line.time)
              }}
            >
              {showSingerLabel(lines, i) && <div className="lyric-singer">{line.singer}</div>}
              {line.text || '♪'}
            </div>
          ))}
        </div>
      ) : (
        <div className="lyrics-scroll" style={scrollStyle}>
          {/* 타임스탬프 없는 일반 가사 — ##가수 표기는 여기서도 라벨로 표시 */}
          <div className="lyrics-plain">
            {track.lyrics.split('\n').map((ln, i) => {
              const m = ln.match(/^##\s*(.+?)\s*$/)
              return m ? (
                <div key={i} className="lyric-singer">
                  {m[1]}
                </div>
              ) : (
                <div key={i}>{ln || ' '}</div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
