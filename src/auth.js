// Firebase Authentication 래퍼 — 이메일/비번 + 구글 로그인, 계정 상호 연동
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  signOut,
} from 'firebase/auth'
import { firebaseConfig, hasAuthConfig } from './firebaseConfig.js'

let app = null
let auth = null

export const authEnabled = () => hasAuthConfig()

export function getFirebaseApp() {
  if (!app && hasAuthConfig()) app = initializeApp(firebaseConfig)
  return app
}

function getAuthInstance() {
  if (!auth && hasAuthConfig()) auth = getAuth(getFirebaseApp())
  return auth
}

// user 변화 구독 — 인증 비활성이면 즉시 null
export function watchUser(fn) {
  if (!authEnabled()) {
    fn(null)
    return () => {}
  }
  return onAuthStateChanged(getAuthInstance(), fn)
}

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(getAuthInstance(), email, password)

export const signupWithEmail = (email, password) =>
  createUserWithEmailAndPassword(getAuthInstance(), email, password)

export const loginWithGoogle = () => signInWithPopup(getAuthInstance(), new GoogleAuthProvider())

// 계정 연동: 현재 로그인된 계정에 구글/비밀번호 자격을 추가
export const linkGoogle = () =>
  linkWithPopup(getAuthInstance().currentUser, new GoogleAuthProvider())

export const linkPassword = (password) => {
  const user = getAuthInstance().currentUser
  return linkWithCredential(user, EmailAuthProvider.credential(user.email, password))
}

export const logoutAuth = () => signOut(getAuthInstance())

export const hasProvider = (user, providerId) =>
  !!user?.providerData?.some((p) => p.providerId === providerId)

// 자주 나오는 오류를 한국어로
export function authErrorMessage(err) {
  const code = err?.code || ''
  const map = {
    'auth/invalid-email': '이메일 형식이 올바르지 않아요.',
    'auth/user-not-found': '등록되지 않은 이메일이에요. 회원가입을 먼저 해주세요.',
    'auth/wrong-password': '비밀번호가 틀렸어요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않아요.',
    'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인으로 시도해보세요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
    'auth/popup-closed-by-user': '구글 로그인 창이 닫혔어요. 다시 시도해주세요.',
    'auth/credential-already-in-use': '이 구글 계정은 이미 다른 계정에 연동돼 있어요.',
    'auth/provider-already-linked': '이미 연동돼 있어요.',
    'auth/requires-recent-login': '보안을 위해 로그아웃 후 다시 로그인한 뒤 시도해주세요.',
    'auth/too-many-requests': '시도가 너무 많았어요. 잠시 후 다시 해주세요.',
  }
  return map[code] || `오류가 발생했어요 (${code || err?.message || '알 수 없음'})`
}
