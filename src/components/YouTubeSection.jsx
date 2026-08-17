import { useEffect, useRef, useState } from 'react'
import {
  getApiKey,
  setApiKey,
  getYouTubeAPI,
  parsePlaylistId,
  getPlaylistsInfo,
  getPlaylistItems,
  getSavedPlaylistIds,
  setSavedPlaylistIds,
} from '../youtube.js'
import { getVolume, onVolumeChange } from '../volume.js'
import { PlayIcon } from './Icons.jsx'

function YtSetupCard({ onSaved }) {
  const [value, setValue] = useState(getApiKey())

  const save = () => {
    if (!value.trim()) return
    setApiKey(value)
    onSaved()
  }

  return (
    <div className="card setup-card">
      <h2>YouTube 연동 설정</h2>
      <p className="muted">
        플레이리스트 정보를 가져오려면 YouTube Data API 키가 하나 필요해요. 무료이고 한 번만 하면
        됩니다 (약 3분).
      </p>
      <ol className="steps">
        <li>
          <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">
            console.cloud.google.com
          </a>
          에 구글 계정으로 로그인
        </li>
        <li>
          화면 <b>왼쪽 위 Google Cloud 로고 옆의 프로젝트 선택 드롭다운</b> 클릭 → 뜨는 창의{' '}
          <b>오른쪽 위 "새 프로젝트"</b> → 이름 아무거나 (예: MasterPlaylist) → <b>만들기</b> →
          잠시 후 알림에서 <b>"프로젝트 선택"</b>을 눌러 방금 만든 프로젝트로 전환됐는지 확인
        </li>
        <li>
          왼쪽 위 <b>햄버거 메뉴(≡) → "API 및 서비스" → "라이브러리"</b> → 검색창에{' '}
          <b>YouTube Data API v3</b> 입력 → 결과 클릭 → 파란 <b>"사용" 버튼</b> 클릭
        </li>
        <li>
          왼쪽 메뉴 <b>"사용자 인증 정보"</b> → 상단의 <b>"+ 사용자 인증 정보 만들기" → "API 키"</b>{' '}
          → 키가 바로 생성돼요 (나중에 목록에서 <b>"키 표시"</b>로 다시 볼 수 있음)
        </li>
        <li>키를 복사해 아래에 붙여넣고 저장</li>
      </ol>
      <p className="hint">
        <b>필수 체크:</b> OAuth 동의 화면·결제 등록은 필요 없어요 — API 키만으로 동작합니다.
        <br />
        <b>(권장) 키 보안 설정:</b> 만든 키 클릭 → <b>"API 제한사항" → "키 제한" → YouTube Data
        API v3만 체크</b> 후 저장. "애플리케이션 제한사항"을 <b>웹사이트</b>로 걸 거면{' '}
        <code>https://masterplaylist.net/*</code> 와 (로컬에서도 쓰면){' '}
        <code>http://127.0.0.1:5173/*</code> 를 둘 다 추가하세요 — 제한 변경은 적용까지 5분쯤
        걸립니다.
      </p>
      <div className="client-id-row">
        <input
          className="input"
          placeholder="API 키 붙여넣기"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button className="btn primary" onClick={save} disabled={!value.trim()}>
          저장
        </button>
      </div>
      <p className="hint">공개 데이터 조회 전용 키라 과금 없이 무료 할당량으로 충분해요.</p>
    </div>
  )
}

function YtPlaylistDetail({ playlist, onBack }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [filter, setFilter] = useState('') // 플리 내 영상 검색
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const playerPromise = useRef(null)

  useEffect(() => {
    getPlaylistItems(playlist.id)
      .then(setItems)
      .catch((e) => setError(e.message))
  }, [playlist.id])

  const ensurePlayer = () => {
    if (!playerPromise.current) {
      playerPromise.current = getYouTubeAPI().then(
        (YT) =>
          new Promise((resolve) => {
            const mount = document.createElement('div')
            mountRef.current.appendChild(mount)
            const p = new YT.Player(mount, {
              width: '100%',
              height: '100%',
              playerVars: { playsinline: 1, rel: 0 },
              events: {
                onReady: () => {
                  p.setVolume(Math.round(getVolume() * 100))
                  resolve(p)
                },
              },
            })
            playerRef.current = p
          }),
      )
    }
    return playerPromise.current
  }

  const playIndex = async (index) => {
    setCurrentIndex(index)
    const player = await ensurePlayer()
    player.loadPlaylist({ listType: 'playlist', list: playlist.id, index })
    player.setLoop(true) // 마지막 영상이 끝나면 처음부터
  }

  // 유튜브 플레이어가 자동으로 다음 영상으로 넘어가므로, 현재 인덱스를 폴링해서 하이라이트
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current
      if (!p?.getPlaylistIndex) return
      const i = p.getPlaylistIndex()
      if (typeof i === 'number' && i >= 0) setCurrentIndex((prev) => (prev === i ? prev : i))
    }, 800)
    return () => clearInterval(id)
  }, [])

  useEffect(() => onVolumeChange((v) => playerRef.current?.setVolume?.(Math.round(v * 100))), [])
  useEffect(() => () => playerRef.current?.destroy?.(), [])

  const thumb = playlist.snippet?.thumbnails?.medium?.url

  return (
    <div className="detail">
      <button className="btn small back" onClick={onBack}>
        ← 목록으로
      </button>

      <header className="detail-header">
        {thumb ? (
          <img className="detail-cover" src={thumb} alt="" />
        ) : (
          <div className="detail-cover placeholder">▶</div>
        )}
        <div>
          <h2>{playlist.snippet?.title}</h2>
          <p className="muted small-text">
            {playlist.contentDetails?.itemCount ?? 0}개 영상 · {playlist.snippet?.channelTitle}
          </p>
          <a
            className="btn small"
            href={`https://www.youtube.com/playlist?list=${playlist.id}`}
            target="_blank"
            rel="noreferrer"
          >
            YouTube에서 열기 ↗
          </a>
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      <div className="detail-columns">
        <div className="track-col">
          {!items ? (
            <div className="loading-row">
              <div className="spinner" />
              <span className="muted">영상 목록 불러오는 중…</span>
            </div>
          ) : (
            <>
            <input
              className="input filter-input"
              placeholder="이 플리에서 영상 찾기"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="track-list">
              {items
                .map((it, i) => ({ it, i }))
                .filter(({ it }) => {
                  if (!filter.trim()) return true
                  const q = filter.toLowerCase()
                  return (
                    it.snippet?.title?.toLowerCase().includes(q) ||
                    it.snippet?.videoOwnerChannelTitle?.toLowerCase().includes(q)
                  )
                })
                .map(({ it, i }) => {
                const active = i === currentIndex
                return (
                  <div
                    className={`track-row yt clickable ${active ? 'playing' : ''}`}
                    key={it.id}
                    onClick={() => playIndex(i)}
                  >
                    <span className="row-num muted">
                      {active ? (
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
                    {it.snippet?.thumbnails?.default?.url ? (
                      <img src={it.snippet.thumbnails.default.url} alt="" className="yt-thumb" />
                    ) : (
                      <span className="yt-thumb placeholder-sm">▶</span>
                    )}
                    <span className="track-title">
                      <b>{it.snippet?.title}</b>
                      <span className="muted">{it.snippet?.videoOwnerChannelTitle}</span>
                    </span>
                  </div>
                )
              })}
            </div>
            </>
          )}
        </div>

        <aside className="now-col">
          <div className="yt-embed" ref={mountRef} />
          {currentIndex < 0 && (
            <p className="muted small-text" style={{ marginTop: 10 }}>
              왼쪽에서 영상을 클릭하면 여기서 재생돼요. 끝나면 자동으로 다음 영상으로 넘어갑니다.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

export default function YouTubeSection() {
  const [hasKey, setHasKey] = useState(!!getApiKey())
  const [editingKey, setEditingKey] = useState(false)
  const [ids, setIds] = useState(getSavedPlaylistIds())
  const [playlists, setPlaylists] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [addUrl, setAddUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasKey) return
    if (!ids.length) {
      setPlaylists([])
      return
    }
    getPlaylistsInfo(ids)
      .then(setPlaylists)
      .catch((e) => setError(e.message))
  }, [hasKey, ids.join(',')])

  // 전역 검색에서 유튜브 플리 클릭 → 해당 플리 열기
  useEffect(() => {
    const onNavigate = (e) => {
      if (e.detail?.section !== 'youtube') return
      setSelectedId(e.detail.playlistId)
    }
    window.addEventListener('mp:navigate', onNavigate)
    return () => window.removeEventListener('mp:navigate', onNavigate)
  }, [])

  const addPlaylist = () => {
    const id = parsePlaylistId(addUrl)
    if (!id) {
      setError('플레이리스트 주소를 인식하지 못했어요. "…list=PL…" 형태의 링크를 붙여넣어 주세요.')
      return
    }
    setError('')
    if (!ids.includes(id)) {
      const next = [...ids, id]
      setIds(next)
      setSavedPlaylistIds(next)
    }
    setAddUrl('')
  }

  const removePlaylist = (id) => {
    if (!confirm('이 플레이리스트를 목록에서 뺄까요? (유튜브에서 삭제되지는 않아요)')) return
    const next = ids.filter((x) => x !== id)
    setIds(next)
    setSavedPlaylistIds(next)
    if (selectedId === id) setSelectedId(null)
  }

  if (!hasKey || editingKey) {
    return (
      <section>
        <h1 className="section-title">YouTube</h1>
        <YtSetupCard
          onSaved={() => {
            setHasKey(true)
            setEditingKey(false)
          }}
        />
      </section>
    )
  }

  const selected = playlists?.find((p) => p.id === selectedId)
  if (selected) {
    return (
      <section>
        <h1 className="section-title">YouTube</h1>
        <YtPlaylistDetail playlist={selected} onBack={() => setSelectedId(null)} />
      </section>
    )
  }

  return (
    <section>
      <div className="section-head">
        <h1 className="section-title">YouTube</h1>
        <button className="btn small" onClick={() => setEditingKey(true)}>
          API 키 변경
        </button>
      </div>

      <div className="add-playlist-row">
        <input
          className="input"
          placeholder="유튜브 플레이리스트 링크 붙여넣기 (https://www.youtube.com/playlist?list=…)"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPlaylist()}
        />
        <button className="btn primary" onClick={addPlaylist} disabled={!addUrl.trim()}>
          추가
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {!playlists ? (
        <div className="loading-row">
          <div className="spinner" />
          <span className="muted">불러오는 중…</span>
        </div>
      ) : playlists.length === 0 ? (
        <div className="empty-state">
          <div className="empty-mark">▶</div>
          <p className="muted">위에 유튜브 플레이리스트 링크를 붙여넣어 추가해보세요.</p>
        </div>
      ) : (
        <div className="grid">
          {playlists.map((p) => (
            <div className="card playlist-card yt-card" key={p.id}>
              <button className="yt-card-body" onClick={() => setSelectedId(p.id)}>
                {p.snippet?.thumbnails?.medium?.url ? (
                  <img className="cover" src={p.snippet.thumbnails.medium.url} alt="" loading="lazy" />
                ) : (
                  <div className="cover placeholder">▶</div>
                )}
                <div className="playlist-name">{p.snippet?.title}</div>
                <div className="muted small-text">
                  {p.contentDetails?.itemCount ?? 0}개 영상 · {p.snippet?.channelTitle}
                </div>
              </button>
              <button className="yt-card-remove" onClick={() => removePlaylist(p.id)} title="목록에서 빼기">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
