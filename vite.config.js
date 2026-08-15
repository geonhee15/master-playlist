import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import libraryPlugin from './server/library-plugin.js'

// Spotify 리다이렉트 URI가 http://127.0.0.1:5173/callback 로 고정되어 있으므로
// host/port를 고정한다. (Spotify는 localhost 대신 127.0.0.1만 허용)
export default defineConfig({
  plugins: [react(), libraryPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      // 미디어 파일 추가/데이터 저장 때 페이지가 리로드되어 재생이 끊기지 않도록
      ignored: ['**/public/media/**', '**/data/**'],
    },
  },
})
