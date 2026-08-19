// Firebase 프로젝트 설정 — 로그인 게이트에 사용 (apiKey는 공개용 클라이언트 식별자)
export const firebaseConfig = {
  apiKey: 'AIzaSyA_S3sBl-Ax60UJ9h__To8UwcimuZhOqpU',
  authDomain: 'master-playlist-c094a.firebaseapp.com',
  projectId: 'master-playlist-c094a',
  storageBucket: 'master-playlist-c094a.firebasestorage.app',
  messagingSenderId: '220352259869',
  appId: '1:220352259869:web:30b3e3a8df2cec9490e3f4',
}

export const hasAuthConfig = () => !!firebaseConfig.apiKey
