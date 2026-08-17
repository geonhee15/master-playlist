import { useEffect, useRef, useState } from 'react'
import TrackForm from './TrackForm.jsx'
import CustomLyricsPanel from './CustomLyricsPanel.jsx'
import { PlayIcon, PauseIcon, VideoIcon, ShuffleIcon, YouTubeIcon } from './Icons.jsx'
import { mediaUrl } from '../library.js'

// 플리 전체(곡 정보·가사·유튜브 링크·커버 설정 포함)를 파일 하나로 내보내기
function exportPlaylist(playlist) {
  const data = { app: 'master-playlist', type: 'playlist', version: 1, playlist }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${playlist.name}.mpl.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function CustomPlaylistDetail({
  playlist,
  media,
  refreshMedia,
  envMode,
  onOpenFolder,
  onBack,
  onChange,
  onEditPlaylist,
  onDelete,
  onPlay,
  onShufflePlay,
  currentTrack,
  isPlaying,
  time,
  onSeek,
  lyricsMaxLines,
}) {
  const currentTrackId = currentTrack?.id
  const [trackForm, setTrackForm] = useState(null) // null | 'new' | track
  const [menu, setMenu] = useState(null) // 우클릭 메뉴: {x, y, track, confirming}
  const [dragOrder, setDragOrder] = useState(null) // 드래그 중 임시 순서
  const dragIndexRef = useRef(null)

  // Esc로 우클릭 메뉴 닫기
  useEffect(() => {
    if (!menu) return
    const onKey = (e) => e.key === 'Escape' && setMenu(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  const submitTrack = (track) => {
    const exists = playlist.tracks.some((t) => t.id === track.id)
    onChange({
      ...playlist,
      tracks: exists
        ? playlist.tracks.map((t) => (t.id === track.id ? track : t))
        : [...playlist.tracks, track],
    })
    setTrackForm(null)
  }

  const deleteTrack = (id) => {
    onChange({ ...playlist, tracks: playlist.tracks.filter((t) => t.id !== id) })
    setMenu(null)
  }

  // 드래그 순서 변경: 드래그 중에는 임시 순서로 보여주다가 끝나면 저장
  const rows = dragOrder || playlist.tracks

  const commitDrag = () => {
    if (dragOrder) onChange({ ...playlist, tracks: dragOrder })
    setDragOrder(null)
    dragIndexRef.current = null
  }

  return (
    <div className="detail">
      <button className="btn small back" onClick={onBack}>
        ← 목록으로
      </button>

      <header className="detail-header">
        {playlist.cover ? (
          <img className="detail-cover" src={mediaUrl(playlist.cover)} alt="" />
        ) : (
          <div className="detail-cover placeholder custom-cover">♬</div>
        )}
        <div>
          <h2>{playlist.name}</h2>
          {playlist.description && <p className="muted">{playlist.description}</p>}
          <p className="muted small-text">{playlist.tracks.length}곡</p>
          <div className="detail-actions">
            {playlist.tracks.length > 1 && (
              <button className="btn small" onClick={onShufflePlay}>
                <ShuffleIcon size={12} /> 셔플 재생
              </button>
            )}
            <button className="btn small" onClick={() => setTrackForm('new')}>
              + 곡 추가
            </button>
            <button className="btn small" onClick={onEditPlaylist}>
              정보 수정
            </button>
            <button
              className="btn small"
              onClick={() => exportPlaylist(playlist)}
              title="이 플리의 모든 정보를 파일 하나로 저장 — 다른 곳에서 가져오기로 복원"
            >
              파일로 내보내기
            </button>
            <button className="btn small danger" onClick={onDelete}>
              삭제
            </button>
          </div>
        </div>
      </header>

      {trackForm && (
        <TrackForm
          initial={trackForm === 'new' ? null : trackForm}
          media={media}
          onRefresh={refreshMedia}
          onOpenFolder={onOpenFolder}
          envMode={envMode}
          onSubmit={submitTrack}
          onCancel={() => setTrackForm(null)}
        />
      )}

      <div className="detail-columns">
        <div className="track-col">
      {playlist.tracks.length === 0 && !trackForm ? (
        <div className="empty-state">
          <div className="empty-mark">♬</div>
          <p className="muted">아직 곡이 없어요.</p>
          <button className="btn primary" onClick={() => setTrackForm('new')}>
            첫 곡 추가하기
          </button>
        </div>
      ) : (
        <div className="track-list">
          <div className="track-row custom head">
            <span />
            <span>제목</span>
            <span>원본 제목</span>
            <span>설명</span>
            <span>매체</span>
            <span />
          </div>
          {rows.map((t, i) => {
            const active = t.id === currentTrackId
            const isDragging = dragOrder && dragIndexRef.current === i
            return (
              <div
                className={`track-row custom ${active ? 'playing' : ''} ${isDragging ? 'dragging' : ''}`}
                key={t.id}
                draggable
                onDragStart={(e) => {
                  dragIndexRef.current = i
                  setDragOrder(playlist.tracks)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnter={() => {
                  const from = dragIndexRef.current
                  if (from == null || from === i || !dragOrder) return
                  setDragOrder((prev) => {
                    const arr = [...prev]
                    const [moved] = arr.splice(from, 1)
                    arr.splice(i, 0, moved)
                    return arr
                  })
                  dragIndexRef.current = i
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={commitDrag}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({ x: e.clientX, y: e.clientY, track: t, confirming: false })
                }}
              >
                <button className="row-play" onClick={() => onPlay(i)} title="재생">
                  {active && isPlaying ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
                </button>
                <span className="track-title">
                  <b>{t.title}</b>
                  <span className="muted">
                    {[t.originalArtist, t.coverArtist && `커버: ${t.coverArtist}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="muted ellipsis">{t.originalTitle}</span>
                <span className="muted ellipsis" title={t.description}>
                  {t.description}
                </span>
                <span className="media-badges">
                  {t.audioFile && (
                    <span className="badge" title={t.audioFile}>
                      ♪
                    </span>
                  )}
                  {t.videoFile && (
                    <span className="badge" title={t.videoFile}>
                      <VideoIcon size={12} />
                    </span>
                  )}
                  {t.youtubeUrl && (
                    <span className="badge" title="유튜브 재생">
                      <YouTubeIcon size={12} />
                    </span>
                  )}
                </span>
                <span className="row-actions">
                  <button onClick={() => setTrackForm(t)} title="수정">
                    ✎
                  </button>
                  <span className="drag-grip" title="드래그로 순서 변경">
                    ⠿
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
        </div>

        <aside className="now-col">
          <CustomLyricsPanel
            track={currentTrack}
            time={time}
            onSeek={onSeek}
            maxLines={lyricsMaxLines}
          />
        </aside>
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {menu && (
        <>
          <div
            className="context-overlay"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu(null)
            }}
          />
          <div
            className="context-menu"
            style={{
              left: Math.min(menu.x, window.innerWidth - 210),
              top: Math.min(menu.y, window.innerHeight - 130),
            }}
          >
            {menu.confirming ? (
              <div className="confirm-box">
                <div className="confirm-text">
                  <b>{menu.track.title}</b>
                  <br />이 곡을 정말 삭제할까요?
                </div>
                <div className="confirm-actions">
                  <button className="btn small danger" onClick={() => deleteTrack(menu.track.id)}>
                    삭제
                  </button>
                  <button className="btn small" onClick={() => setMenu(null)}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  className="menu-item"
                  onClick={() => {
                    setTrackForm(menu.track)
                    setMenu(null)
                  }}
                >
                  곡 정보 수정
                </button>
                <button
                  className="menu-item danger"
                  onClick={() => setMenu({ ...menu, confirming: true })}
                >
                  곡 삭제…
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
