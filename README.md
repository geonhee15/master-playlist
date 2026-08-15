# 마스터 플레이리스트

나만의 플레이리스트 모음 웹사이트. 섹션별로 여러 소스의 플레이리스트를 모아서 본다.

## 실행

```bash
npm run dev
```

→ **http://127.0.0.1:5173** 으로 접속 (localhost 불가 — Spotify 인증이 127.0.0.1만 허용)

## 섹션

- **Spotify** — 내 Spotify 플레이리스트 + 좋아요 표시한 곡을 그대로 가져와서 보기.
  처음 한 번만 [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)에서
  앱을 만들고 Client ID를 입력하면 됨 (화면에 단계별 안내 있음).
  - Redirect URI: `http://127.0.0.1:5173/callback`
  - 인증 방식: Authorization Code + PKCE (서버·시크릿 불필요, 토큰 자동 갱신)
  - Spotify가 직접 만든 플레이리스트(Discover Weekly 등)는 정책상 트랙 목록 API가 막혀 있음
    (임베드 플레이어로는 재생 가능)
  - 플리 상세에서 트랙을 클릭하면 임베드로 재생되고, 옆 패널에 **싱크 가사**가 노래를 따라
    내려감 (가사 출처: [LRCLIB](https://lrclib.net) — Spotify 공식 API는 가사 미제공.
    재생 위치는 Spotify iFrame Embed API의 playback_update 이벤트 사용)
  - 브라우저에 Spotify 로그인이 안 되어 있으면 임베드가 30초 미리듣기로만 재생됨
- **커스텀** — 정식 발매되지 않은 곡(커버곡, 밈 노래 등)을 직접 플레이리스트로 관리.
  - 미디어 파일은 **`public/media/`** 폴더에 넣기 (mp3, m4a, wav, flac, ogg / mp4, webm, mov …)
  - 곡 정보: 제목, 원곡자, 커버 가수, 원본 제목, 설명, 가사 + 오디오/영상 파일 선택
  - 가사: `[mm:ss.xx]` 타임스탬프(LRC)로 싱크 하이라이트, `##가수이름` 줄로 파트별 가수 표시
  - 하단 플레이어로 재생, 오디오·영상이 둘 다 있으면 **재생 위치를 유지한 채 전환** 가능
  - 데이터는 `data/library.json`에 저장 (브라우저와 무관하게 파일로 보존)
- 새 섹션 (예정)

## UI 규칙

- 컬러 이모지 사용 금지. 단색 글리프(♪ ♬ ♥ ✕ ✎ ↑ ↓)와 `src/components/Icons.jsx`의
  SVG 아이콘만 사용.

## 구조

```
data/library.json          # 커스텀 섹션 데이터 (플레이리스트 + 곡 정보)
public/media/              # 커스텀 섹션 미디어 파일 넣는 곳
server/
  library-plugin.js        # 로컬 API (라이브러리 저장/파일 목록/미디어 스트리밍)
src/
  spotify.js               # PKCE 인증 + Spotify Web API 호출
  library.js               # 커스텀 섹션 API 클라이언트
  App.jsx                  # 레이아웃 + /callback 처리
  components/
    Sidebar.jsx            # 섹션 내비게이션
    SpotifySection.jsx     # 설정 → 연결 → 플레이리스트 그리드 → 상세
    SetupCard.jsx          # Client ID 설정 가이드
    PlaylistDetail.jsx     # Spotify 트랙 목록 + 임베드 플레이어
    CustomSection.jsx      # 커스텀 플리 목록/생성 + 재생 큐 관리
    CustomPlaylistDetail.jsx  # 커스텀 곡 목록 (추가/수정/삭제/순서 변경)
    TrackForm.jsx          # 곡 정보 입력 폼
    PlayerDock.jsx         # 하단 플레이어 (오디오/영상 전환)
```
