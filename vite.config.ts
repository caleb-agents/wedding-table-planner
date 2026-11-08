import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: '/wedding-table-planner/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
