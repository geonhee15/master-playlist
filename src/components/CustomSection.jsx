import { useEffect, useRef, useState } from 'react'
import CustomPlaylistDetail from './CustomPlaylistDetail.jsx'
import PlayerDock from './PlayerDock.jsx'
import {
  loadLibrary,
  savePlaylist,
  deletePlaylistById,
  listMedia,
  mediaUrl,
  openMediaFolder,
} from '../library.js'

function PlaylistForm({ initial, media, onRefreshMedia, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [cover, setCover] = useState(initial?.cover || '')

  return (
    <div className="card form-card">
      <h2>{initial ? '플레이리스트 수정' : '새 플레이리스트'}</h2>
      <label className="field">
        <span>이름 *</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 최애 커버곡 모음"
          autoFocus
        />
      </label>
      <label className="field">
        <span>설명</span>
        <textarea
          className="input"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="어떤 플레이리스트인지 메모"
        />
      </label>
      <label className="field">
        <span>커버 이미지</span>
        <div className="cover-pick">
          <select className="input" value={cover} onChange={(e) => setCover(e.target.value)}>
            <option value="">없음 (기본 커버)</option>
            {cover && !media.image?.includes(cover) && (
              <option value={cover}>{cover} (폴더에 없음)</option>
            )}
            {media.image?.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button className="btn small" onClick={onRefreshMedia}>
            새로고침
          </button>
          <button className="btn small" onClick={openMediaFolder}>
            폴더 열기
          </button>
        </div>
        {cover && <img className="cover-preview" src={mediaUrl(cover)} alt="" />}
      </label>
      <p className="hint" style={{ marginTop: 0 }}>
        커버로 쓸 이미지(jpg, png, webp …)도 <code>public/media</code> 폴더에 넣으면 목록에 떠요.
      </p>
      <div className="form-actions">
        <button
          className="btn primary"
          disabled={!name.trim()}
          onClick={() =>
            onSubmit({
              id: initial?.id || crypto.randomUUID(),
              tracks: initial?.tracks || [],
              name: name.trim(),
              description: description.trim(),
              cover,
            })
          }
        >
          저장
        </button>
        <button className="btn" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  )
}

export default function CustomSection() {
  const [library, setLibrary] = useState(null)
  const [media, setMedia] = useState({ audio: [], video: [], image: [] })
  const [selectedId, setSelectedId] = useState(null)
  const [editingPlaylist, setEditingPlaylist] = useState(null) // null | 'new' | playlist
  const [error, setError] = useState('')

  useEffect(() => {
    loadLibrary()
      .then(setLibrary)
      .catch((e) => setError(e.message))
    refreshMedia()
  }, [])

  const refreshMedia = () => listMedia().then(setMedia).catch(() => {})

  // 플리 단위로 저장 — 탭이 여러 개 열려 있어도 서로의 다른 플리를 덮어쓰지 않는다.
  // 서버가 최신 전체 라이브러리를 돌려주므로 다른 탭의 변경도 함께 반영된다.
  const upsertPlaylist = (pl) => {
    const exists = library.playlists.some((p) => p.id === pl.id)
    setLibrary({
      ...library,
      playlists: exists
        ? library.playlists.map((p) => (p.id === pl.id ? pl : p))
        : [...library.playlists, pl],
    })
    savePlaylist(pl)
      .then(setLibrary)
      .catch(() => setError('저장 실패 — 개발 서버가 실행 중인지 확인하세요'))
  }

  const deletePlaylist = (id) => {
    setLibrary({ ...library, playlists: library.playlists.filter((p) => p.id !== id) })
    if (selectedId === id) setSelectedId(null)
    deletePlaylistById(id)
      .then(setLibrary)
      .catch(() => setError('삭제 실패 — 개발 서버가 실행 중인지 확인하세요'))
  }

  const selected = library?.playlists.find((p) => p.id === selectedId)

  // ---- 플레이어 ----
  const videoRef = useRef(null)
  const pendingSeek = useRef(null)
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(-1)
  const [mode, setMode] = useState('audio') // 'audio' | 'video'
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeatOne, setRepeatOne] = useState(false)
  const originalQueueRef = useRef([]) // 셔플 해제 시 원래 순서로 복원용

  // 영상 패널 크기 — "긴 쪽 변" 기준으로 저장해서 가로/세로(쇼츠) 영상 모두 자연스럽게 조절된다
  // (가로 영상: size = 너비, 세로 영상: size = 높이)
  const [videoSize, setVideoSize] = useState(() => {
    const saved = Number(localStorage.getItem('mp_video_size'))
    return saved >= 200 ? saved : 480
  })
  useEffect(() => {
    localStorage.setItem('mp_video_size', String(videoSize))
  }, [videoSize])
  const [videoAspect, setVideoAspect] = useState(16 / 9)

  const currentTrack = queueIndex >= 0 ? queue[queueIndex] : null

  // 큐에는 재생 시작 시점의 사본이 들어가므로, 가사 등 최신 정보는 라이브러리에서 다시 찾는다
  const freshCurrentTrack =
    currentTrack && library
      ? library.playlists.flatMap((p) => p.tracks).find((t) => t.id === currentTrack.id) ||
        currentTrack
      : currentTrack

  const shuffleArray = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const loadSource = (track, m, seekTo = null, autoplay = true) => {
    const v = videoRef.current
    if (!v) return
    pendingSeek.current = seekTo
    v.src = mediaUrl(m === 'video' ? track.videoFile : track.audioFile)
    if (autoplay) v.play().catch(() => {})
  }

  // 큐를 바꾸지 않고 큐 내부의 index 곡을 재생 (자동 다음 곡/이전·다음 버튼용)
  const startAt = (q, index) => {
    const track = q[index]
    // 직전에 보던 형식(영상/음악)을 유지하고, 그 형식 파일이 없으면 있는 쪽으로
    const m =
      mode === 'video'
        ? track.videoFile
          ? 'video'
          : 'audio'
        : track.audioFile
          ? 'audio'
          : 'video'
    setQueue(q)
    setQueueIndex(index)
    setMode(m)
    setTime(0)
    setDuration(0)
    loadSource(track, m)
  }

  // 트랙 목록에서 사용자가 직접 재생을 시작 (셔플이면 클릭한 곡부터 나머지를 섞는다)
  const playAt = (tracks, index, forceShuffle = shuffle) => {
    originalQueueRef.current = tracks
    if (forceShuffle) {
      const rest = tracks.filter((_, i) => i !== index)
      startAt([tracks[index], ...shuffleArray(rest)], 0)
    } else {
      startAt(tracks, index)
    }
  }

  const toggleShuffle = () => {
    const next = !shuffle
    setShuffle(next)
    if (queueIndex < 0) return
    const current = queue[queueIndex]
    if (next) {
      // 현재 곡을 앞에 두고 나머지를 섞는다
      const rest = queue.filter((_, i) => i !== queueIndex)
      setQueue([current, ...shuffleArray(rest)])
      setQueueIndex(0)
    } else {
      // 원래 순서 복원
      const original = originalQueueRef.current
      const idx = original.findIndex((t) => t.id === current.id)
      if (idx >= 0) {
        setQueue(original)
        setQueueIndex(idx)
      }
    }
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v || !currentTrack) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  const step = (dir) => {
    if (!queue.length) return
    startAt(queue, (queueIndex + dir + queue.length) % queue.length)
  }

  const seekTo = (sec) => {
    if (videoRef.current) videoRef.current.currentTime = sec
  }

  const toggleMode = () => {
    if (!currentTrack?.audioFile || !currentTrack?.videoFile) return
    const v = videoRef.current
    const target = mode === 'audio' ? 'video' : 'audio'
    const wasPlaying = v ? !v.paused : false
    setMode(target)
    loadSource(currentTrack, target, v ? v.currentTime : null, wasPlaying)
  }

  const stop = () => {
    const v = videoRef.current
    if (v) {
      v.pause()
      v.removeAttribute('src')
      v.load()
    }
    setQueue([])
    setQueueIndex(-1)
    setIsPlaying(false)
    setTime(0)
    setDuration(0)
  }

  // 영상이 커질수록 가사 패널 표시 줄 수를 7줄에서 한 줄씩 줄인다 (겹침 방지)
  const videoDockWidth = videoAspect >= 1 ? videoSize : videoSize * videoAspect
  const videoDockHeight = currentTrack && mode === 'video' ? videoDockWidth / videoAspect : 0
  const lyricsMaxLines = videoDockHeight
    ? Math.max(2, Math.min(7, Math.floor((window.innerHeight - 330 - videoDockHeight) / 35)))
    : 7

  // 스페이스바 = 재생/일시정지 (입력창 타이핑 중일 때는 제외).
  // preventDefault로 스크롤·포커스된 버튼 눌림도 막는다.
  useEffect(() => {
    if (!currentTrack) return
    const onKey = (e) => {
      if ((e.code !== 'Space' && e.key !== ' ') || e.defaultPrevented) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
        return
      e.preventDefault()
      togglePlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentTrack])

  const videoEvents = {
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onTimeUpdate: (e) => setTime(e.target.currentTime),
    onLoadedMetadata: (e) => {
      setDuration(e.target.duration)
      if (e.target.videoWidth > 0) setVideoAspect(e.target.videoWidth / e.target.videoHeight)
      if (pendingSeek.current != null) {
        e.target.currentTime = pendingSeek.current
        pendingSeek.current = null
      }
    },
    onEnded: (e) => {
      if (repeatOne) {
        e.target.currentTime = 0
        e.target.play().catch(() => {})
      } else if (queue.length) {
        // 마지막 곡이 끝나면 첫 곡부터 다시 (전체 반복이 기본)
        startAt(queue, (queueIndex + 1) % queue.length)
      }
    },
  }

  return (
    <section>
      {editingPlaylist ? (
        <>
          <h1 className="section-title">커스텀</h1>
          <PlaylistForm
            initial={editingPlaylist === 'new' ? null : editingPlaylist}
            media={media}
            onRefreshMedia={refreshMedia}
            onSubmit={(pl) => {
              upsertPlaylist(pl)
              setEditingPlaylist(null)
            }}
            onCancel={() => setEditingPlaylist(null)}
          />
        </>
      ) : selected ? (
        <CustomPlaylistDetail
          playlist={selected}
          media={media}
          refreshMedia={refreshMedia}
          onBack={() => setSelectedId(null)}
          onChange={upsertPlaylist}
          onEditPlaylist={() => setEditingPlaylist(selected)}
          onDelete={() => {
            if (confirm(`"${selected.name}" 플레이리스트를 삭제할까요?`)) deletePlaylist(selected.id)
          }}
          onPlay={(i) => {
            const track = selected.tracks[i]
            if (currentTrack?.id === track.id) togglePlay()
            else playAt(selected.tracks, i)
          }}
          onShufflePlay={() => {
            if (!selected.tracks.length) return
            setShuffle(true)
            playAt(selected.tracks, Math.floor(Math.random() * selected.tracks.length), true)
          }}
          currentTrack={freshCurrentTrack}
          isPlaying={isPlaying}
          time={time}
          onSeek={seekTo}
          lyricsMaxLines={lyricsMaxLines}
        />
      ) : (
        <>
          <div className="section-head">
            <h1 className="section-title">커스텀</h1>
            <button className="btn primary" onClick={() => setEditingPlaylist('new')}>
              + 새 플레이리스트
            </button>
          </div>
          <p className="muted section-desc">
            커버곡 · 밈 · 비공식 음원 모음. 파일을 <code>public/media</code> 폴더에 넣고 플리를
            만들어보세요.
          </p>

          {error && <div className="error-box">{error}</div>}

          {!library ? (
            <div className="loading-row">
              <div className="spinner" />
              <span className="muted">불러오는 중…</span>
            </div>
          ) : library.playlists.length === 0 ? (
            <div className="empty-state">
              <div className="empty-mark">♬</div>
              <p className="muted">아직 플레이리스트가 없어요.</p>
              <button className="btn primary" onClick={() => setEditingPlaylist('new')}>
                첫 플레이리스트 만들기
              </button>
            </div>
          ) : (
            <div className="grid">
              {library.playlists.map((p) => (
                <button className="card playlist-card" key={p.id} onClick={() => setSelectedId(p.id)}>
                  {p.cover ? (
                    <img className="cover" src={mediaUrl(p.cover)} alt="" loading="lazy" />
                  ) : (
                    <div className="cover placeholder custom-cover">♬</div>
                  )}
                  <div className="playlist-name">{p.name}</div>
                  <div className="muted small-text">{p.tracks.length}곡</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <PlayerDock
        videoRef={videoRef}
        videoEvents={videoEvents}
        track={currentTrack}
        mode={mode}
        isPlaying={isPlaying}
        time={time}
        duration={duration}
        onTogglePlay={togglePlay}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onSeek={seekTo}
        onToggleMode={toggleMode}
        onStop={stop}
        shuffle={shuffle}
        repeatOne={repeatOne}
        onToggleShuffle={toggleShuffle}
        onToggleRepeatOne={() => setRepeatOne((r) => !r)}
        videoSize={videoSize}
        onVideoSize={setVideoSize}
        videoAspect={videoAspect}
      />
    </section>
  )
}
