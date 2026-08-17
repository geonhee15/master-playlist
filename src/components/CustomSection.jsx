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
  setVisitorMediaResolver,
  loadVisitorLibrary,
  saveVisitorLibrary,
} from '../library.js'
import {
  supportsFolderPick,
  pickFolder,
  reconnectFolder,
  autoReconnectFolder,
  scanFolder,
  isFolderConnected,
  folderName,
  hasSavedFolder,
  localFileUrl,
} from '../localMedia.js'
import { setNowPlaying, clearNowPlaying } from '../nowPlaying.js'
import { recordPlay } from '../stats.js'
import { allowsConvenience } from '../consent.js'
import { getYouTubeAPI, parseVideoId } from '../youtube.js'
import { getVolume, onVolumeChange } from '../volume.js'

// 파일이 없고 유튜브 링크만 있는 곡 → 유튜브 임베드로 재생
const trackYouTubeId = (track) =>
  track && !track.audioFile && !track.videoFile ? parseVideoId(track.youtubeUrl) : null

function PlaylistForm({ initial, media, onRefreshMedia, onOpenFolder, onSubmit, onCancel }) {
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
          <button className="btn small" onClick={onOpenFolder}>
            폴더 열기
          </button>
        </div>
        {cover && <img className="cover-preview" src={mediaUrl(cover)} alt="" />}
      </label>
      <p className="hint" style={{ marginTop: 0 }}>
        커버로 쓸 이미지(jpg, png, webp …)도 미디어 폴더에 넣으면 목록에 떠요.
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

  // 환경 감지: 로컬 개발 서버(내 라이브러리+public/media)냐, 배포 사이트 방문(자기 폴더 선택)이냐
  const [envMode, setEnvMode] = useState('detecting') // 'detecting' | 'local' | 'visitor'
  const [folderConnected, setFolderConnected] = useState(false)
  const [savedFolder, setSavedFolder] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/media')
        const type = res.headers.get('content-type') || ''
        if (res.ok && type.includes('json')) {
          setEnvMode('local')
          setMedia(await res.json())
          loadLibrary()
            .then(setLibrary)
            .catch((e) => setError(e.message))
          return
        }
      } catch {
        /* 로컬 API 없음 → 방문자 모드 */
      }
      setVisitorMediaResolver(localFileUrl)
      setEnvMode('visitor')
      setLibrary(loadVisitorLibrary())
      setSavedFolder(await hasSavedFolder())
      // 동의('모두 동의')한 경우, 브라우저가 권한을 기억하는 폴더는 자동 재연결
      if (allowsConvenience()) {
        const m = await autoReconnectFolder()
        if (m) {
          setMedia(m)
          setFolderConnected(true)
        }
      }
    })()
  }, [])

  const refreshMedia = () => {
    if (envMode === 'visitor') {
      if (isFolderConnected()) scanFolder().then((m) => m && setMedia(m))
      return
    }
    listMedia().then(setMedia).catch(() => {})
  }

  // 방문자 모드: 폴더 선택/재연결 (사용자 클릭 안에서 호출되어야 함)
  const connectFolder = async (reconnect) => {
    try {
      const m = reconnect ? await reconnectFolder() : await pickFolder()
      if (m) {
        setMedia(m)
        setFolderConnected(true)
        setSavedFolder(true)
      }
    } catch {
      /* 사용자가 선택 취소 */
    }
  }

  const openFolder = () => {
    if (envMode === 'visitor') connectFolder(false)
    else openMediaFolder()
  }

  // 플리 파일(.mpl.json) 가져오기 — 내보내기한 파일을 업로드하면 그대로 복사된다
  const importInputRef = useRef(null)

  const importPlaylistFile = async (file) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      const raw = data?.playlist || data
      if (!raw?.name || !Array.isArray(raw.tracks)) throw new Error('형식 오류')
      const playlist = {
        id: raw.id || crypto.randomUUID(),
        name: String(raw.name),
        description: raw.description || '',
        cover: raw.cover || '',
        tracks: raw.tracks
          .filter((t) => t && t.title)
          .map((t) => ({
            id: t.id || crypto.randomUUID(),
            title: String(t.title),
            originalArtist: t.originalArtist || '',
            coverArtist: t.coverArtist || '',
            originalTitle: t.originalTitle || '',
            description: t.description || '',
            lyrics: t.lyrics || '',
            audioFile: t.audioFile || '',
            videoFile: t.videoFile || '',
            youtubeUrl: t.youtubeUrl || '',
          })),
      }
      const exists = library?.playlists.some((p) => p.id === playlist.id)
      if (exists && !confirm(`"${playlist.name}" 플리가 이미 있어요. 파일 내용으로 덮어쓸까요?`))
        return
      setError('')
      upsertPlaylist(playlist)
    } catch {
      setError('플리 파일을 읽지 못했어요 — "파일로 내보내기"로 만든 .json 파일인지 확인해주세요')
    }
  }

  // 플리 단위로 저장 — 탭이 여러 개 열려 있어도 서로의 다른 플리를 덮어쓰지 않는다.
  // 방문자 모드에서는 이 브라우저의 localStorage에만 저장된다.
  const upsertPlaylist = (pl) => {
    const exists = library.playlists.some((p) => p.id === pl.id)
    const updated = {
      ...library,
      playlists: exists
        ? library.playlists.map((p) => (p.id === pl.id ? pl : p))
        : [...library.playlists, pl],
    }
    setLibrary(updated)
    if (envMode === 'visitor') {
      saveVisitorLibrary(updated)
      return
    }
    savePlaylist(pl)
      .then(setLibrary)
      .catch(() => setError('저장 실패 — 개발 서버가 실행 중인지 확인하세요'))
  }

  const deletePlaylist = (id) => {
    const updated = { ...library, playlists: library.playlists.filter((p) => p.id !== id) }
    setLibrary(updated)
    if (selectedId === id) setSelectedId(null)
    if (envMode === 'visitor') {
      saveVisitorLibrary(updated)
      return
    }
    deletePlaylistById(id)
      .then(setLibrary)
      .catch(() => setError('삭제 실패 — 개발 서버가 실행 중인지 확인하세요'))
  }

  const selected = library?.playlists.find((p) => p.id === selectedId)

  // ---- 플레이어 (파일: <video> 엔진 / 유튜브: IFrame Player 엔진) ----
  const videoRef = useRef(null)
  const pendingSeek = useRef(null)
  const ytMountRef = useRef(null) // PlayerDock 안의 유튜브 플레이어 자리
  const ytPlayerRef = useRef(null)
  const handleEndedRef = useRef(null) // 유튜브 이벤트는 한 번만 등록되므로 ref로 최신 로직 유지
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

  // 유튜브 플레이어는 처음 필요할 때 한 번만 생성
  const ensureYtPlayer = async () => {
    if (ytPlayerRef.current) return ytPlayerRef.current
    const YT = await getYouTubeAPI()
    if (ytPlayerRef.current) return ytPlayerRef.current
    const mount = document.createElement('div')
    ytMountRef.current.appendChild(mount)
    const player = await new Promise((resolve) => {
      const p = new YT.Player(mount, {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            p.setVolume(Math.round(getVolume() * 100))
            resolve(p)
          },
          onStateChange: (e) => {
            if (e.data === 0) handleEndedRef.current?.()
            else if (e.data === 1) setIsPlaying(true)
            else if (e.data === 2) setIsPlaying(false)
          },
        },
      })
    })
    ytPlayerRef.current = player
    return player
  }

  const loadSource = async (track, m, seekTo = null, autoplay = true) => {
    const ytId = trackYouTubeId(track)
    const v = videoRef.current
    if (ytId) {
      // 파일 엔진 정지 후 유튜브로
      if (v) {
        v.pause()
        v.removeAttribute('src')
        v.load()
      }
      const player = await ensureYtPlayer()
      const opts = { videoId: ytId, startSeconds: seekTo || 0 }
      if (autoplay) player.loadVideoById(opts)
      else player.cueVideoById(opts)
    } else {
      // 유튜브 엔진 정지 후 파일로
      ytPlayerRef.current?.stopVideo?.()
      if (!v) return
      pendingSeek.current = seekTo
      v.src = mediaUrl(m === 'video' ? track.videoFile : track.audioFile)
      if (autoplay) v.play().catch(() => {})
    }
  }

  // 큐를 바꾸지 않고 큐 내부의 index 곡을 재생 (자동 다음 곡/이전·다음 버튼용)
  const startAt = (q, index) => {
    const track = q[index]
    const ytId = trackYouTubeId(track)
    // 유튜브 곡은 항상 영상, 파일 곡은 직전에 보던 형식(영상/음악)을 유지
    const m = ytId
      ? 'video'
      : mode === 'video'
        ? track.videoFile
          ? 'video'
          : 'audio'
        : track.audioFile
          ? 'audio'
          : 'video'
    setQueue(q)
    setQueueIndex(index)
    setMode(m)
    if (ytId) setVideoAspect(16 / 9)
    setTime(0)
    setDuration(0)
    loadSource(track, m)
  }

  // 트랙 목록에서 사용자가 직접 재생을 시작 (셔플이면 클릭한 곡부터 나머지를 섞는다)
  const playAt = (tracks, index, forceShuffle = shuffle) => {
    const t = tracks[index]
    if (t)
      recordPlay({
        source: 'custom',
        title: t.title,
        sub: [t.originalArtist, t.coverArtist && `커버: ${t.coverArtist}`].filter(Boolean).join(' · '),
      })
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

  const engine = currentTrack && trackYouTubeId(currentTrack) ? 'youtube' : 'file'

  const togglePlay = () => {
    if (!currentTrack) return
    if (engine === 'youtube') {
      const p = ytPlayerRef.current
      if (!p) return
      if (p.getPlayerState?.() === 1) p.pauseVideo()
      else p.playVideo()
    } else {
      const v = videoRef.current
      if (!v) return
      if (v.paused) v.play().catch(() => {})
      else v.pause()
    }
  }

  const step = (dir) => {
    if (!queue.length) return
    startAt(queue, (queueIndex + dir + queue.length) % queue.length)
  }

  const seekTo = (sec) => {
    if (engine === 'youtube') ytPlayerRef.current?.seekTo?.(sec, true)
    else if (videoRef.current) videoRef.current.currentTime = sec
  }

  const toggleMode = () => {
    if (!currentTrack?.audioFile || !currentTrack?.videoFile) return
    const v = videoRef.current
    const target = mode === 'audio' ? 'video' : 'audio'
    const wasPlaying = v ? !v.paused : false
    setMode(target)
    loadSource(currentTrack, target, v ? v.currentTime : null, wasPlaying)
  }

  // 다른 소스가 재생을 시작할 때 호출됨 — 큐는 유지하고 소리만 멈춘다
  const pausePlayback = () => {
    if (engine === 'youtube') ytPlayerRef.current?.pauseVideo?.()
    else videoRef.current?.pause()
  }

  const stop = () => {
    const v = videoRef.current
    if (v) {
      v.pause()
      v.removeAttribute('src')
      v.load()
    }
    ytPlayerRef.current?.stopVideo?.()
    setQueue([])
    setQueueIndex(-1)
    setIsPlaying(false)
    setTime(0)
    setDuration(0)
  }

  // 곡이 끝났을 때 (파일/유튜브 공통): 한 곡 반복이면 처음부터, 아니면 다음 곡 (끝이면 첫 곡)
  const handleEnded = () => {
    if (repeatOne) {
      if (engine === 'youtube') {
        ytPlayerRef.current?.seekTo?.(0, true)
        ytPlayerRef.current?.playVideo?.()
      } else {
        const v = videoRef.current
        if (v) {
          v.currentTime = 0
          v.play().catch(() => {})
        }
      }
    } else if (queue.length) {
      startAt(queue, (queueIndex + 1) % queue.length)
    }
  }
  handleEndedRef.current = handleEnded

  // Now playing 위젯에 커스텀 재생 상태 공유 (다른 섹션에 있을 때 왼쪽 아래 미니 플레이어)
  useEffect(() => {
    if (currentTrack) {
      setNowPlaying({
        source: 'custom',
        playlistId: selectedId || null,
        title: currentTrack.title,
        sub: [currentTrack.originalArtist, currentTrack.coverArtist && `커버: ${currentTrack.coverArtist}`]
          .filter(Boolean)
          .join(' · '),
        isPlaying,
        detailVisible: true, // 커스텀 독은 섹션 안 어디서나 보이므로 섹션 밖에서만 위젯 표시
        controls: { toggle: togglePlay, stop, pause: pausePlayback },
      })
    } else {
      clearNowPlaying('custom')
    }
    // eslint 없음 — togglePlay/stop은 렌더마다 새로 만들어져 최신 상태를 캡처한다
  }, [currentTrack, isPlaying])

  // 전역 음량을 두 재생 엔진에 적용
  useEffect(() => {
    const apply = (v) => {
      if (videoRef.current) videoRef.current.volume = v
      ytPlayerRef.current?.setVolume?.(Math.round(v * 100))
    }
    apply(getVolume())
    return onVolumeChange(apply)
  }, [])

  // 유튜브 재생 중에는 시간/길이를 주기적으로 읽어온다 (가사 싱크·시크바용)
  useEffect(() => {
    if (engine !== 'youtube') return
    const id = setInterval(() => {
      const p = ytPlayerRef.current
      if (!p?.getCurrentTime) return
      setTime(p.getCurrentTime() || 0)
      setDuration(p.getDuration() || 0)
    }, 300)
    return () => clearInterval(id)
  }, [engine, currentTrack?.id])

  // 영상이 커질수록 가사 패널 표시 줄 수를 7줄에서 한 줄씩 줄인다 (겹침 방지)
  const videoDockWidth = videoAspect >= 1 ? videoSize : videoSize * videoAspect
  const videoDockHeight = currentTrack && mode === 'video' ? videoDockWidth / videoAspect : 0
  const lyricsMaxLines = videoDockHeight
    ? Math.max(2, Math.min(7, Math.floor((window.innerHeight - 330 - videoDockHeight) / 35)))
    : 7

  // 전역 검색에서 커스텀 플리 클릭 → 해당 플리 열기
  useEffect(() => {
    const onNavigate = (e) => {
      if (e.detail?.section !== 'custom' || !e.detail.playlistId) return
      setEditingPlaylist(null)
      setSelectedId(e.detail.playlistId)
    }
    window.addEventListener('mp:navigate', onNavigate)
    return () => window.removeEventListener('mp:navigate', onNavigate)
  }, [])

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
    onEnded: () => handleEnded(),
  }

  return (
    <section>
      {editingPlaylist ? (
        <>
          <h1 className="section-title">Custom</h1>
          <PlaylistForm
            initial={editingPlaylist === 'new' ? null : editingPlaylist}
            media={media}
            onRefreshMedia={refreshMedia}
            onOpenFolder={openFolder}
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
          envMode={envMode}
          onOpenFolder={openFolder}
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
            <h1 className="section-title">Custom</h1>
            <div className="head-actions">
              {envMode === 'visitor' && folderConnected && (
                <button className="btn small" onClick={() => connectFolder(false)} title="폴더 변경">
                  폴더: {folderName()}
                </button>
              )}
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  importPlaylistFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <button
                className="btn small"
                onClick={() => importInputRef.current?.click()}
                title="내보내기한 플리 파일(.mpl.json)을 업로드하면 그대로 복사돼요"
              >
                플리 파일 가져오기
              </button>
              <button className="btn primary" onClick={() => setEditingPlaylist('new')}>
                + 새 플레이리스트
              </button>
            </div>
          </div>
          <p className="muted section-desc">
            {envMode === 'visitor' ? (
              <>커버곡 · 밈 · 비공식 음원을 내 컴퓨터의 파일이나 유튜브 링크로 모아두는 공간이에요.</>
            ) : (
              <>
                커버곡 · 밈 · 비공식 음원 모음. 파일을 <code>public/media</code> 폴더에 넣고 플리를
                만들어보세요.
              </>
            )}
          </p>

          {envMode === 'visitor' && !folderConnected && (
            <div className="card connect-card" style={{ marginBottom: 20 }}>
              <h2>내 컴퓨터의 음악으로 시작하기</h2>
              <p className="muted">
                음악/영상이 들어있는 폴더를 선택하면 그 파일들로 나만의 플리를 만들 수 있어요.
                파일은 어디에도 업로드되지 않고 이 브라우저에서만 재생되며, 플리는 이 브라우저에
                저장됩니다. 유튜브 링크 곡은 폴더 없이도 추가할 수 있고, 다른 곳에서 내보낸 플리
                파일이 있다면 위의 <b>플리 파일 가져오기</b>로 그대로 불러올 수 있어요.
              </p>
              {supportsFolderPick() ? (
                <div className="connect-actions">
                  <button className="btn primary" onClick={() => connectFolder(false)}>
                    음악 폴더 선택
                  </button>
                  {savedFolder && (
                    <button className="btn" onClick={() => connectFolder(true)}>
                      이전 폴더 다시 연결
                    </button>
                  )}
                </div>
              ) : (
                <p className="hint">
                  이 브라우저는 폴더 선택을 지원하지 않아요 — Chrome/Edge에서 열어주세요. 유튜브
                  링크 곡은 지금도 추가할 수 있습니다.
                </p>
              )}
            </div>
          )}

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
        engine={engine}
        ytMountRef={ytMountRef}
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
