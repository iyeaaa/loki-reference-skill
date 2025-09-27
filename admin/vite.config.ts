import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // React 관련
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor'
            }
            // UI 라이브러리
            if (id.includes('@radix-ui') || id.includes('cmdk') || id.includes('class-variance-authority')) {
              return 'ui-vendor'
            }
            // 차트 및 시각화
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts'
            }
            // 폼 관련
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
              return 'form-vendor'
            }
            // 기타 유틸리티
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind')) {
              return 'utils'
            }
            // 나머지 vendor
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600, // 경고 임계값을 600KB로 증가
  },
})
