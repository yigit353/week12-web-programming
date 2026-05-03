import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // No proxy: v2 talks to the backend via absolute URL (VITE_API_URL in
  // .env.local). A proxy would match /books/new as an API call instead of
  // a client route. The backend allows localhost:5173 via CORS already.
})
