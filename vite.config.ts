import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Engedélyezi a fájlok elérését a munkakönyvtáron kívül is, 
      // ha a backend és frontend külön mappában van
      allow: ['..']
    }
  }
})