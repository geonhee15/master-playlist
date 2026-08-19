import { useState } from 'react'
import { parseVideoId } from '../youtube.js'
import { cloudFileUrl, cloudNameFromUrl } from '../library.js'

// 파일 소스 선택값: '' | 'file:<이름>'(이 기기) | 'url:<주소>'(클라우드)
const sourceValue = (file, url) => (file ? `file:${file}` : url ? `url:${url}` : '')

function SourceSelect({ label, value, localFiles, cloudFiles, onChange }) {
  const [file, url] = value
  const selected = sourceValue(file, url)
  const cloudValues = cloudFiles.map((n) => `url:${cloudFileUrl(n)}`)

  return (
    <label className="field">
      <span>{label}</span>
      <select
        className="input"
        value={selected}
        onChange={(e) => {
          const v = e.target.value
          if (v.startsWith('file:')) onChange([v.slice(5), ''])
          else if (v.startsWith('url:')) onChange(['', v.slice(4)])
          else onChange(['', ''])
        }}
      >
        <option value="">없음</option>
        {file && !localFiles.includes(file) && (
          <option value={`file:${file}`}>{file} (폴더에 없음)</option>
        )}
        {url && !cloudValues.includes(`url:${url}`) && (
          <option value={`url:${url}`}>{cloudNameFromUrl(url) || '외부 URL'}</option>
        )}
        {localFiles.length > 0 && (
          <optgroup label="이 기기 (미디어 폴더)">
            {localFiles.map((name) => (
              <option key={name} value={`file:${name}`}>
                {name}
              </option>
            ))}
          </optgroup>
        )}
        {cloudFiles.length > 0 && (
          <optgroup label="클라우드 (어느 기기서나 재생)">
            {cloudFiles.map((name) => (
              <option key={name} value={`url:${cloudFileUrl(name)}`}>
                {name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}

export default function TrackForm({
  initial,
  media,
  cloudMedia = { audio: [], video: [], image: [] },
  onRefresh,
  onOpenFolder,
  envMode,
  onSubmit,
  onCancel,
}) {
  const [f, setF] = useState({
    title: initial?.title || '',
    originalArtist: initial?.originalArtist || '',
    coverArtist: initial?.coverArtist || '',
    originalTitle: initial?.originalTitle || '',
    description: initial?.description || '',
    lyrics: initial?.lyrics || '',
    audioFile: initial?.audioFile || '',
    videoFile: initial?.videoFile || '',
    audioUrl: initial?.audioUrl || '',
    videoUrl: initial?.videoUrl || '',
    youtubeUrl: initial?.youtubeUrl || '',
  })
  const set = (key) => (e) => setF({ ...f, [key]: e.target.value })
  const youtubeOk = !f.youtubeUrl || !!parseVideoId(f.youtubeUrl)
  const valid =
    f.title.trim() &&
    (f.audioFile || f.videoFile || f.audioUrl || f.videoUrl || parseVideoId(f.youtubeUrl))

  return (
    <div className="card form-card">
      <div className="form-head">
        <h3>{initial ? '곡 수정' : '곡 추가'}</h3>
        <div className="form-head-actions">
          <button className="btn small" onClick={onRefresh}>
            파일 목록 새로고침
          </button>
          <button className="btn small" onClick={onOpenFolder}>
            {envMode === 'visitor' ? '폴더 선택/변경' : '미디어 폴더 열기'}
          </button>
        </div>
      </div>
      <p className="hint">
        {envMode === 'visitor' ? (
          <>선택한 폴더의 음악/영상 파일이 아래 목록에 떠요. 유튜브 링크만으로도 추가할 수 있어요.</>
        ) : (
          <>
            음악/영상 파일을 <code>public/media</code> 폴더에 넣은 뒤 아래에서 선택하세요.
          </>
        )}
      </p>

      <div className="form-grid">
        <label className="field">
          <span>제목 *</span>
          <input className="input" value={f.title} onChange={set('title')} placeholder="예: 밤편지 (piano cover)" />
        </label>
        <label className="field">
          <span>원곡자</span>
          <input className="input" value={f.originalArtist} onChange={set('originalArtist')} placeholder="예: 아이유" />
        </label>
        <label className="field">
          <span>커버 가수</span>
          <input className="input" value={f.coverArtist} onChange={set('coverArtist')} placeholder="있다면 입력" />
        </label>
        <label className="field">
          <span>원본 제목</span>
          <input className="input" value={f.originalTitle} onChange={set('originalTitle')} placeholder="예: 밤편지" />
        </label>
        <SourceSelect
          label="오디오 파일"
          value={[f.audioFile, f.audioUrl]}
          localFiles={media.audio}
          cloudFiles={cloudMedia.audio}
          onChange={([file, url]) => setF({ ...f, audioFile: file, audioUrl: url })}
        />
        <SourceSelect
          label="영상 파일 (선택)"
          value={[f.videoFile, f.videoUrl]}
          localFiles={media.video}
          cloudFiles={cloudMedia.video}
          onChange={([file, url]) => setF({ ...f, videoFile: file, videoUrl: url })}
        />
      </div>

      <label className="field">
        <span>유튜브 링크 (선택)</span>
        <input
          className="input"
          value={f.youtubeUrl}
          onChange={set('youtubeUrl')}
          placeholder="https://www.youtube.com/watch?v=… — 파일 없이 유튜브 임베드로 재생"
        />
        {!youtubeOk && (
          <span className="field-error">유튜브 영상 주소를 인식하지 못했어요.</span>
        )}
      </label>

      <label className="field">
        <span>설명</span>
        <textarea
          className="input"
          rows={3}
          value={f.description}
          onChange={set('description')}
          placeholder="이 곡에 대한 메모 (어디서 찾았는지, 왜 좋은지 등)"
        />
      </label>

      <label className="field">
        <span>가사 (선택)</span>
        <textarea
          className="input"
          rows={6}
          value={f.lyrics}
          onChange={set('lyrics')}
          placeholder={
            '가사를 붙여넣으세요. 재생 중 옆 패널에 표시돼요.\n' +
            '[mm:ss.xx] 타임스탬프(LRC 형식)를 붙이면 노래에 맞춰 자동 하이라이트됩니다.\n' +
            '##가수이름 줄을 넣으면 다음 ##가 나올 때까지 그 가수가 부르는 파트로 표시돼요.\n' +
            '*[mm:ss.xx] 오! 처럼 줄 앞에 *를 붙이면 추임새 — 본 가사 대신 추임새 패널에 떠요.'
          }
        />
      </label>

      {!valid && (
        <p className="hint">제목과, 오디오/영상 파일 또는 유튜브 링크 중 하나 이상이 필요해요.</p>
      )}

      <div className="form-actions">
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => onSubmit({ id: initial?.id || crypto.randomUUID(), ...f, title: f.title.trim() })}
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
