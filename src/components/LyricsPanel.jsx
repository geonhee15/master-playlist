import { useEffect, useRef, useState } from 'react'

// LRC 형식("[mm:ss.xx] 가사") 파싱 → [{time, text, singer}]
// "##가수이름" 줄이 나오면 다음 ##가 나올 때까지 그 아래 가사들의 singer로 붙는다.
export function parseLrc(lrc) {
  const lines = []
  let singer = null
  for (const raw of lrc.split('\n')) {
    const singerMatch = raw.match(/^##\s*(.+?)\s*$/)
    if (singerMatch) {
      singer = singerMatch[1]
      continue
    }
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    if (!stamps.length) continue
    const text = raw.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim()
    for (const s of stamps) lines.push({ time: Number(s[1]) * 60 + parseFloat(s[2]), text, singer })
  }
  return lines.sort((a, b) => a.time - b.time)
}

// i번째 줄 위에 가수 라벨을 보여줘야 하는지 (가수 블록의 첫 줄에만)
export const showSingerLabel = (lines, i) =>
  !!lines[i].singer && (i === 0 || lines[i - 1].singer !== lines[i].singer)

// 가사 가져오기: 1차 서버 프록시(/api/lyrics), 실패 시 LRCLIB 직접 요청(CORS 허용)
// — 프록시가 없는 정적 호스팅 환경에서도 가사가 나오도록
async function fetchLyricsData(track) {
  const meta = {
    track: track.name || '',
    artist: track.artists?.[0]?.name || '',
    album: track.album?.name || '',
    duration: track.duration_ms ? String(Math.round(track.duration_ms / 1000)) : '',
  }

  try {
    const res = await fetch(`/api/lyrics?${new URLSearchParams(meta)}`)
    const type = res.headers.get('content-type') || ''
    if (res.ok && type.includes('json')) {
      const data = await res.json()
      if (data?.syncedLyrics || data?.plainLyrics) return data
    }
  } catch {
    /* 프록시 없음 → 직접 요청으로 */
  }

  try {
    let res = await fetch(
      `https://lrclib.net/api/get?${new URLSearchParams({
        track_name: meta.track,
        artist_name: meta.artist,
        album_name: meta.album,
        duration: meta.duration,
      })}`,
    )
    if (res.ok) {
      const data = await res.json()
      if (data?.syncedLyrics || data?.plainLyrics) return data
    }
    res = await fetch(
      `https://lrclib.net/api/search?${new URLSearchParams({
        track_name: meta.track,
        artist_name: meta.artist,
      })}`,
    )
    if (res.ok) {
      const list = await res.json()
      const dur = Number(meta.duration) || 0
      const close = (x) => !dur || Math.abs((x.duration || 0) - dur) <= 3
      return (
        list.find((x) => x.syncedLyrics && close(x)) ||
        list.find((x) => x.syncedLyrics) ||
        list.find((x) => x.plainLyrics && close(x)) ||
        null
      )
    }
  } catch {
    /* 네트워크 실패 */
  }
  return null
}

export default function LyricsPanel({ track, position, onSeek }) {
  const [state, setState] = useState({ status: 'loading' })
  const listRef = useRef(null)
  // 사용자가 직접 스크롤하면 잠시 자동 스크롤을 멈춘다
  const manualAtRef = useRef(0)
  const markManual = () => {
    manualAtRef.current = Date.now()
  }

  useEffect(() => {
    if (!track) return
    let alive = true
    setState({ status: 'loading' })
    fetchLyricsData(track)
      .then((data) => {
        if (!alive) return
        if (data?.syncedLyrics) setState({ status: 'synced', lines: parseLrc(data.syncedLyrics) })
        else if (data?.plainLyrics) setState({ status: 'plain', text: data.plainLyrics })
        else setState({ status: 'none' })
      })
      .catch(() => alive && setState({ status: 'none' }))
    return () => {
      alive = false
    }
  }, [track?.id])

  // 현재 재생 위치에 해당하는 줄
  let active = -1
  if (state.status === 'synced') {
    for (let i = 0; i < state.lines.length; i++) {
      if (state.lines[i].time <= position + 0.25) active = i
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
        {state.status === 'synced' && <span className="muted small-text">줄을 클릭하면 이동</span>}
      </div>

      {state.status === 'loading' && (
        <div className="loading-row">
          <div className="spinner" />
          <span className="muted">가사 찾는 중…</span>
        </div>
      )}

      {state.status === 'synced' && (
        <div
          className="lyrics-scroll"
          ref={listRef}
          onWheel={markManual}
          onTouchMove={markManual}
          onPointerDown={markManual}
        >
          {state.lines.map((line, i) => (
            <div
              key={i}
              className={`lyric-line ${i === active ? 'active' : ''} ${i < active ? 'past' : ''}`}
              onClick={() => {
                manualAtRef.current = 0 // 줄 클릭으로 이동하면 자동 스크롤 바로 재개
                onSeek?.(line.time)
              }}
            >
              {showSingerLabel(state.lines, i) && (
                <div className="lyric-singer">{line.singer}</div>
              )}
              {line.text || '♪'}
            </div>
          ))}
        </div>
      )}

      {state.status === 'plain' && (
        <div className="lyrics-scroll">
          <p className="muted small-text" style={{ marginBottom: 10 }}>
            시간 정보가 없는 가사라 자동 스크롤은 되지 않아요.
          </p>
          <div className="lyrics-plain">{state.text}</div>
        </div>
      )}

      {state.status === 'none' && <p className="muted">이 곡의 가사를 찾지 못했어요.</p>}

      <div className="lyrics-credit muted small-text">가사 제공: LRCLIB</div>
    </div>
  )
}
