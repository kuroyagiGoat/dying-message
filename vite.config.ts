import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHubのリポジトリ名が "dying-message" の場合
  base: '/dying-message/',
})
