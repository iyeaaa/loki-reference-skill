import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 파일 해시를 사용하여 캐시 무효화
    rollupOptions: {
      output: {
        // 청크 파일명에 해시 포함
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
        // 코드 스플리팅을 위한 manualChunks 설정
        manualChunks(id) {
          // node_modules에 있는 패키지들만 처리
          if (id.includes('node_modules')) {
            // Radix UI를 먼저 체크 (React보다 우선)
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }

            // React 관련 라이브러리
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }

            // 폼 관련
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'form-vendor';
            }

            // 데이터 페칭
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }

            // Flow 차트 관련 (큰 라이브러리)
            if (id.includes('@xyflow/react') || id.includes('elkjs')) {
              return 'flow-vendor';
            }

            // 기타 유틸리티
            if (id.includes('clsx') || id.includes('class-variance-authority') ||
                id.includes('tailwind-merge') || id.includes('lucide-react')) {
              return 'utils-vendor';
            }

            // 나머지 node_modules는 vendor로
            return 'vendor';
          }

          // 페이지별 청크 분리
          if (id.includes('src/pages/')) {
            if (id.includes('src/pages/sequences/designer')) {
              return 'page-sequence-designer';
            }
            if (id.includes('src/pages/sequences')) {
              return 'page-sequences';
            }
            if (id.includes('src/pages/leads')) {
              return 'page-leads';
            }
            if (id.includes('src/pages/customer-groups')) {
              return 'page-customer-groups';
            }
            if (id.includes('src/pages/email-templates')) {
              return 'page-email-templates';
            }
            if (id.includes('src/pages/workspaces')) {
              return 'page-workspaces';
            }
            if (id.includes('src/pages/users')) {
              return 'page-users';
            }
          }
        },
      },
    },
    // 매니페스트 파일 생성 (선택적)
    manifest: true,
  },
});
