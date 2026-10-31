import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
  test: {
    // As telas dos jogos com 15 jogadores levam 1–2 s para desenhar; com a
    // suíte inteira rodando em paralelo, o limite padrão de 5 s estoura à toa.
    testTimeout: 30_000,
  },
})
