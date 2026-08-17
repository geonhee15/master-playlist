import { useEffect, useRef, useState } from 'react'
import { getPlaylistTracks, getLikedTracks } from '../spotify.js'
import { getIframeAPI } from '../spotify-embed.js'
import LyricsPanel from './LyricsPanel.jsx'
import { PlayIcon, ShuffleIcon, RepeatOneIcon } from './Icons.jsx'

const formatDuration = (ms) => {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function PlaylistDetail({ playlist, onBack }) {
  const isLiked = playlist.id === '__liked__'
  const [tracks, setTracks] = useState(null)
  const [error, setError] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPaused, setIsPaused] = useState(true)
  const [position, setPosition] = useState(0) // 초 단위 (가사 싱크용)
  const [noticeDismissed, setNoticeDismissed] = useState(false) // 새로고침하면 다시 보임
  const [usedFallback, setUsedFallback] = useState(false) // 임베드 데이터로 트랙을 불러온 경우
  const [shuffle, setShuffle] = useState(false)
  const [repeatOne, setRepeatOne] = useState(false)

  const embedHostRef = useRef(null)
  const controllerRef = useRef(null)
  const controllerPromise = useRef(null)
  const lastUpdate = useRef({ pos: 0, at: 0, paused: true })
  const lastPlayAt = useRef(0)
  const endedRef = useRef(false)
  const tracksRef = useRef(null)
  const currentIndexRef = useRef(-1)
  // 임베드 이벤트 리스너는 한 번만 등록되므로 셔플/반복 상태는 ref로도 유지한다
  const shuffleRef = useRef(false)
  const repeatOneRef = useRef(false)
  const orderRef = useRef(null) // 셔플 재생 순서 (트랙 인덱스 배열)
  const orderPosRef = useRef(0)

  const buildOrder = (startIndex) => {
    const list = tracksRef.current || []
    const rest = list.map((_, i) => i).filter((i) => i !== startIndex)
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
    orderRef.current = startIndex >= 0 ? [startIndex, ...rest] : rest
    orderPosRef.current = 0
  }

  useEffect(() => {
    let alive = true
    const apply = (list) => {
      if (!alive) return
      const filtered = list.filter(Boolean)
      setTracks(filtered)
      tracksRef.current = filtered
    }
    const load = async () => {
      try {
        apply(await (isLiked ? getLikedTracks() : getPlaylistTracks(playlist.id)))
      } catch (e) {
        // 공식 API가 막힌 경우(신규 개발자 앱 제한) 임베드 페이지 데이터로 우회
        if (!isLiked) {
          try {
            const res = await fetch(`/api/playlist-tracks?id=${encodeURIComponent(playlist.id)}`)
            const data = res.ok ? await res.json() : null
            if (data?.tracks?.length) {
              apply(data.tracks)
              if (alive) setUsedFallback(true)
              return
            }
          } catch {
            /* 아래 error 처리로 넘어감 */
          }
        }
        if (alive) setError(e)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [playlist.id, isLiked])

  // 임베드의 재생 위치 업데이트는 드문드문 오므로, 사이를 보간해서 가사가 부드럽게 따라가게 한다
  useEffect(() => {
    const id = setInterval(() => {
      const u = lastUpdate.current
      if (!u.at) return
      const ms = u.paused ? u.pos : u.pos + (performance.now() - u.at)
      setPosition(ms / 1000)
    }, 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => () => controllerRef.current?.destroy?.(), [])

  // 스페이스바 = 재생/일시정지 (입력창 타이핑 중이거나 커스텀 섹션이 이미 처리한 경우 제외)
  useEffect(() => {
    if (currentIndex < 0) return
    const onKey = (e) => {
      if ((e.code !== 'Space' && e.key !== ' ') || e.defaultPrevented) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
        return
      e.preventDefault()
      controllerRef.current?.togglePlay?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex])

  const ensureController = (uri) => {
    if (!controllerPromise.current) {
      controllerPromise.current = getIframeAPI().then(
        (IFrameAPI) =>
          new Promise((resolve) => {
            const mount = document.createElement('div')
            embedHostRef.current.appendChild(mount)
            IFrameAPI.createController(
              mount,
              { uri, width: '100%', height: 152 },
              (controller) => {
                controller.addListener('playback_update', (e) => {
                  const { position: pos, duration, isPaused: paused } = e.data
                  lastUpdate.current = { pos, at: performance.now(), paused }
                  setIsPaused(paused)
                  // 곡이 끝났을 때 처리 (방금 시작한 곡의 잔여 이벤트는 무시)
                  if (
                    duration > 0 &&
                    pos >= duration - 400 &&
                    performance.now() - lastPlayAt.current > 2000 &&
                    !endedRef.current
                  ) {
                    endedRef.current = true
                    // 한 곡 반복: 같은 곡을 처음부터 다시
                    if (repeatOneRef.current) {
                      lastPlayAt.current = performance.now()
                      lastUpdate.current = { pos: 0, at: performance.now(), paused: false }
                      controller.seek(0)
                      controller.play()
                      endedRef.current = false
                      return
                    }
                    const list = tracksRef.current
                    if (!list) return
                    // 셔플: 미리 섞어둔 순서대로, 아니면 다음 곡.
                    // 끝까지 갔으면 처음부터 다시 (전체 반복이 기본)
                    if (shuffleRef.current && orderRef.current) {
                      const nextPos = (orderPosRef.current + 1) % orderRef.current.length
                      orderPosRef.current = nextPos
                      playTrack(orderRef.current[nextPos], true)
                    } else {
                      playTrack((currentIndexRef.current + 1) % list.length)
                    }
                  }
                })
                controllerRef.current = controller
                resolve(controller)
              },
            )
          }),
      )
    }
    return controllerPromise.current
  }

  const playTrack = async (index, fromAuto = false) => {
    const track = tracksRef.current?.[index]
    if (!track?.id) return
    // 사용자가 직접 곡을 고르면 셔플 순서를 그 곡부터 다시 만든다
    if (shuffleRef.current && !fromAuto) buildOrder(index)
    setCurrentIndex(index)
    currentIndexRef.current = index
    endedRef.current = false
    lastPlayAt.current = performance.now()
    lastUpdate.current = { pos: 0, at: performance.now(), paused: false }
    setPosition(0)
    const uri = `spotify:track:${track.id}`
    const controller = await ensureController(uri)
    controller.loadUri(uri)
    controller.play()
  }

  const toggleShuffle = () => {
    const next = !shuffle
    setShuffle(next)
    shuffleRef.current = next
    if (next) {
      if (currentIndexRef.current >= 0) {
        buildOrder(currentIndexRef.current)
      } else if (tracksRef.current?.length) {
        // 아직 재생 전이면 랜덤 곡부터 바로 셔플 재생 시작
        playTrack(Math.floor(Math.random() * tracksRef.current.length))
      }
    } else {
      orderRef.current = null
    }
  }

  const toggleRepeatOne = () => {
    const next = !repeatOne
    setRepeatOne(next)
    repeatOneRef.current = next
  }

  const currentTrack = currentIndex >= 0 ? tracks?.[currentIndex] : null

  return (
    <div className="detail">
      <button className="btn small back" onClick={onBack}>
        ← 목록으로
      </button>

      <header className="detail-header">
        {playlist.images?.[0]?.url ? (
          <img className="detail-cover" src={playlist.images[0].url} alt="" />
        ) : (
          <div className="detail-cover placeholder">{isLiked ? '♥' : '♪'}</div>
        )}
        <div>
          <h2>{playlist.name}</h2>
          {playlist.description && (
            <p className="muted" dangerouslySetInnerHTML={{ __html: playlist.description }} />
          )}
          <p className="muted small-text">
            {tracks
              ? `${tracks.length}곡`
              : error
                ? playlist.tracks?.total != null && `${playlist.tracks.total}곡`
                : '불러오는 중…'}
            {playlist.owner?.display_name && ` · ${playlist.owner.display_name}`}
          </p>
          {!isLiked && (
            <a
              className="btn small"
              href={playlist.external_urls?.spotify}
              target="_blank"
              rel="noreferrer"
            >
              Spotify에서 열기 ↗
            </a>
          )}
        </div>
      </header>

      {/* 트랙 목록을 못 불러오는 플리는 예전처럼 통짜 임베드로 재생 */}
      {error && !isLiked && (
        <iframe
          className="embed"
          title="Spotify 플레이어"
          src={`https://open.spotify.com/embed/playlist/${playlist.id}?theme=0`}
          height="152"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )}

      {error && !noticeDismissed && (
        <div className="notice">
          <span>
            {!isLiked && (error.status === 403 || error.status === 404)
              ? `Spotify API가 트랙 목록 조회를 제한하고 있고 (${error.status}), 비공개 플리라서 임베드 데이터도 없어요. ` +
                'Spotify 앱에서 이 플리를 공개(프로필에 추가)로 바꾸면 여기서도 목록과 가사가 보여요. ' +
                '모든 플리가 이렇게 뜬다면 연결된 계정(목록 화면 우상단 프로필)이 플리 주인 계정이 맞는지 확인해보세요.'
              : error.message}
          </span>
          <button className="notice-close" onClick={() => setNoticeDismissed(true)} title="닫기">
            ✕
          </button>
        </div>
      )}

      {usedFallback && !noticeDismissed && (
        <div className="notice">
          <span>
            Spotify API가 트랙 조회를 제한하고 있어서 임베드 데이터로 목록을 불러왔어요. 곡이 아주
            많은 플리는 일부만 보일 수 있어요.
          </span>
          <button className="notice-close" onClick={() => setNoticeDismissed(true)} title="닫기">
            ✕
          </button>
        </div>
      )}

      {tracks && (
        <div className="detail-columns">
          <div className="track-col">
            <div className="track-list">
              <div className="track-row head">
                <span>#</span>
                <span />
                <span>제목</span>
                <span>앨범</span>
                <span>시간</span>
              </div>
              {tracks.map((t, i) => (
                <div
                  className={`track-row clickable ${i === currentIndex ? 'playing' : ''}`}
                  key={`${t.id || t.uri}-${i}`}
                  onClick={() => playTrack(i)}
                >
                  <span className="row-num muted">
                    {i === currentIndex ? (
                      <span className="playing-note">♪</span>
                    ) : (
                      <>
                        <span className="num">{i + 1}</span>
                        <span className="hover-play">
                          <PlayIcon size={11} />
                        </span>
                      </>
                    )}
                  </span>
                  {t.album?.images?.length ? (
                    <img src={t.album.images.at(-1).url} alt="" className="track-cover" />
                  ) : (
                    <span className="track-cover placeholder-sm">♪</span>
                  )}
                  <span className="track-title">
                    <b>{t.name}</b>
                    <span className="muted">{t.artists?.map((a) => a.name).join(', ')}</span>
                  </span>
                  <span className="muted ellipsis">{t.album?.name}</span>
                  <span className="muted">{t.duration_ms ? formatDuration(t.duration_ms) : '–'}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="now-col">
            <div className="play-options">
              <button
                className={`btn small toggle ${shuffle ? 'on' : ''}`}
                onClick={toggleShuffle}
              >
                <ShuffleIcon size={13} /> 셔플
              </button>
              <button
                className={`btn small toggle ${repeatOne ? 'on' : ''}`}
                onClick={toggleRepeatOne}
              >
                <RepeatOneIcon size={13} /> 한 곡 반복
              </button>
            </div>
            <div className="embed-host" ref={embedHostRef} />
            {currentTrack ? (
              <LyricsPanel
                track={currentTrack}
                position={position}
                onSeek={(sec) => controllerRef.current?.seek?.(sec)}
              />
            ) : (
              <div className="lyrics-panel">
                <div className="lyrics-head">
                  <h3>가사</h3>
                </div>
                <p className="muted">
                  왼쪽에서 곡을 클릭하면 여기서 재생되고, 가사가 있으면 노래에 맞춰 표시돼요.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
