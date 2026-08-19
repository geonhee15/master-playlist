// Firebase 프로젝트 설정 — console.firebase.google.com → 프로젝트 설정(⚙) → 일반 → 내 앱(웹)의
// firebaseConfig 값을 여기에 붙여넣으면 사이트에 로그인 게이트가 켜진다.
// 비워두면 로그인 없이 동작한다. (apiKey는 공개되어도 되는 클라이언트 식별자)
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
}

export const hasAuthConfig = () => !!firebaseConfig.apiKey
