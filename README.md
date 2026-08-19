# 마스터 플레이리스트

나만의 플레이리스트 모음 웹사이트. 섹션별로 여러 소스의 플레이리스트를 모아서 본다.
로컬 개발 서버로 편집하고, Cloudflare Pages(masterplaylist.net)로 배포해서 본다.

## 실행

```bash
npm run dev
```

→ **http://127.0.0.1:5173** 으로 접속 (localhost 불가 — Spotify 인증이 127.0.0.1만 허용)

## 섹션

- **Spotify** — 내 Spotify 플레이리스트 + 좋아요 표시한 곡을 그대로 가져와서 보기.
  처음 한 번만 [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)에서
  앱을 만들고 Client ID를 입력하면 됨 (화면에 단계별 안내 있음).
  **개발자 앱 생성은 Spotify 프리미엄 구독 계정만 가능** (베이직/학생 등 가장 저렴한 플랜이면 충분).
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
  - 가사: `[mm:ss.xx]` 타임스탬프(LRC)로 싱크 하이라이트, `##가수이름` 줄로 파트별 가수 표시,
    `*[mm:ss.xx] 오!` 처럼 줄 앞에 `*`를 붙이면 추임새 — 가사 패널 아래 추임새 패널에 타이밍 맞춰 표시
  - 하단 플레이어로 재생, 오디오·영상이 둘 다 있으면 **재생 위치를 유지한 채 전환** 가능
  - 데이터는 `data/library.json`에 저장 (브라우저와 무관하게 파일로 보존)
- 새 섹션 (예정)

## 섹션 추가 메모

- **YouTube 섹션**: YouTube Data API 키(localStorage)로 플레이리스트 목록/영상을 가져오고,
  IFrame Player로 재생 (마지막 영상 후 처음부터 반복)
- **커스텀 곡의 유튜브 링크**: 파일 없이 `youtubeUrl`만 있으면 유튜브 임베드로 재생.
  임베드를 막아둔 영상(일부 방송사 등)은 재생 불가 — "동영상을 재생할 수 없음"이 뜨면 그 경우
- **음량 슬라이더**: 우상단 고정, 파일/유튜브 재생 모두에 적용 (Spotify 임베드는 API가 없어 미적용)

## 배포 (Cloudflare Pages)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages →
   Connect to Git** → `geonhee15/master-playlist` 선택
2. 빌드 설정: Framework preset **Vite** (Build command `npm run build`, Output `dist`)
3. 배포 후 **Custom domains**에서 `masterplaylist.net` 연결 (도메인이 같은 계정에 있으면 클릭 몇 번)
4. Spotify 로그인용: [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   앱 Settings → Redirect URIs에 `https://masterplaylist.net/callback` 추가
5. `main`에 푸시할 때마다 자동 재배포

배포 환경 동작 방식:

- 배포는 **Cloudflare Worker(정적 에셋)** 방식 — `wrangler.jsonc` + `worker/index.js`가
  `/api/lyrics`(가사)와 `/api/playlist-tracks`(Spotify 우회)를 처리하고 나머지는 정적 서빙
- **커스텀 섹션은 방문자 모드**: 개인 라이브러리(`data/`)와 미디어는 배포에 포함되지 않고,
  방문자는 자기 컴퓨터의 폴더를 선택(File System Access API)해 자기만의 플리를 만든다
  (localStorage 저장, 파일 업로드 없음). 주인의 플리는 로컬 개발 서버에서만 보임
- 가사는 프록시가 없어도 브라우저에서 LRCLIB로 직접 폴백

## 로그인 (Firebase Authentication)

자체 로그인 화면(이메일/비번 + Google, 계정 상호 연동)은 Firebase Auth를 쓴다:

1. [console.firebase.google.com](https://console.firebase.google.com) → 프로젝트 추가
2. **Authentication → 시작하기 → Sign-in method**에서 **이메일/비밀번호**와 **Google** 사용 설정
3. **Authentication → Settings → 승인된 도메인**에 `masterplaylist.net` 추가
4. 프로젝트 설정(⚙) → 일반 → 내 앱 → 웹 앱(</>) 등록 → `firebaseConfig` 값을
   `src/firebaseConfig.js`에 붙여넣고 커밋 (apiKey는 공개용 클라이언트 식별자)
5. config가 채워지면 사이트에 로그인 게이트가 자동으로 켜진다.
   `?login-preview` 쿼리로 화면 디자인만 미리 볼 수 있다.
6. 계정 연동: 설정(우상단 톱니) → 계정에서 **구글 연동** / **아이디·비번 연동** 양방향 지원
7. **기기 간 설정 동기화(Firestore)**: 콘솔 → **Firestore Database → 데이터베이스 만들기**
   (프로덕션 모드, 리전 아무거나) → **규칙** 탭에 아래 붙여넣고 게시:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   동기화 대상: 닉네임, Spotify Client ID, YouTube API 키·추가한 플리 목록,
   **커스텀 플레이리스트 전체**(users/{uid}/playlists — 최신 updatedAt 우선 병합, 삭제는 톰스톤).
   Spotify 재생 연결(토큰)은 기기마다 "연결하기" 한 번씩 필요 (토큰 회전 문제로 비동기화).
   커스텀 곡의 파일 재생은 그 기기에 같은 파일이 있어야 하고(폴더 연결), 유튜브 곡은 어디서나 재생됨

(기존 Cloudflare Access 게이트를 쓰고 있었다면 Zero Trust에서 앱을 삭제해 이중 로그인을 피한다)

## UI 규칙

- 컬러 이모지 사용 금지. 단색 글리프(♪ ♬ ♥ ✕ ✎ ↑ ↓)와 `src/components/Icons.jsx`의
  SVG 아이콘만 사용.

## 구조

```
data/library.json          # 커스텀 섹션 데이터 (로컬 전용, 커밋 안 됨)
public/media/              # 커스텀 섹션 미디어 파일 넣는 곳 (커밋 안 됨)
wrangler.jsonc, worker/    # Cloudflare Workers 배포 (정적 에셋 + API 프록시)
functions/api/             # Pages 방식으로 배포할 경우용 동일 프록시
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
