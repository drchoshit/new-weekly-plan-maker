import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ✅ Electron에서 file:// 프로토콜로 로드 시 상대경로 사용
export default defineConfig({
  plugins: [react()],
  base: './', // ✅ 중요: /assets/... 대신 ./assets/... 경로로 빌드됨
})
