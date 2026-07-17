import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/Passport-ID-Photo-Maker-Web-App/',
  plugins: [react(), tailwindcss()],
})
