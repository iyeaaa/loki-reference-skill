import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import { cleanLoggerPlugin } from "./vite-plugins/clean-logger";

export default defineConfig({
  plugins: [react(), tailwindcss(), cleanLoggerPlugin()],
  // Optimize dependency pre-bundling 
  optimizeDeps: {
    // Exclude heavy packages from pre-bundling to allow dynamic imports
    exclude: ["shiki", "mermaid"],
  },
  customLogger: {
    info: (msg) => {
      // Filter out verbose vite messages
      if (msg.includes("vite:react-swc") || msg.includes("ROLLDOWN-VITE")) {
        return;
      }
      console.log(msg);
    },
    warn: (msg) => {
      // Only show important warnings
      if (msg.includes("vite:react-swc")) {
        return; // Suppress react-swc plugin recommendation
      }
      console.warn(msg);
    },
    error: (msg) => {
      console.error(msg);
    },
    clearScreen: () => {
      // Disable default clear screen
    },
    hasErrorLogged: () => false,
    hasWarned: false,
    warnOnce: () => {},
  },
  server: {
    host: true, // 모든 호스트 허용
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "002e3587c626.ngrok-free.app", // ngrok 호스트 허용
      ".ngrok-free.app", // 모든 ngrok 호스트 허용
      ".ngrok.io", // 기존 ngrok 도메인도 허용
    ],
    // monorepo 루트(node_modules/.bun 등)에서 참조되는 파일(폰트/CSS)을 Vite가 서빙할 수 있게 허용
    // Step2에서 사용하는 @uiw/react-md-editor 동적 로드 시 "outside of Vite serving allow list" 오류 방지
    fs: {
      // searchForWorkspaceRoot는 현재 repo에서 admin 디렉토리를 반환하므로,
      // 실제 모노레포 루트(../)도 함께 허용해야 함.
      allow: [searchForWorkspaceRoot(process.cwd()), path.resolve(process.cwd(), "..")],
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 청크 크기 경고 제한 설정 (500KB → 1100KB)
    // MDEditor 같은 큰 라이브러리는 별도 청크로 분리되어 필요할 때만 로드됨
    chunkSizeWarningLimit: 1100,
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
          if (id.includes("node_modules")) {
            // ===== 최우선: 거대 라이브러리 분리 (10MB+ 문제 해결) =====

            // Shiki - 구문 강조 (언어/테마 포함, ~8MB)
            // streamdown이 shiki를 사용하므로 함께 묶음
            if (id.includes("shiki") || id.includes("@shikijs")) {
              return "shiki-vendor";
            }

            // Mermaid - 다이어그램 렌더링 (~2MB)
            if (id.includes("mermaid")) {
              return "mermaid-vendor";
            }

            // Streamdown - 마크다운 스트리밍 (shiki/mermaid 의존)
            if (id.includes("streamdown")) {
              return "streamdown-vendor";
            }

            // ===== 큰 라이브러리 분리 =====

            // MDEditor 및 관련 패키지 (CodeMirror 포함)
            if (
              id.includes("@uiw/react-md-editor") ||
              id.includes("codemirror") ||
              id.includes("@codemirror")
            ) {
              return "md-editor-vendor";
            }

            // Monaco Editor
            if (id.includes("@monaco-editor") || id.includes("monaco-editor")) {
              return "monaco-vendor";
            }

            // Flow 차트 (ReactFlow + elkjs)
            if (id.includes("@xyflow/react") || id.includes("elkjs")) {
              return "flow-vendor";
            }

            // ===== React 생태계 =====

            // Radix UI를 먼저 체크 (React보다 우선)
            if (id.includes("@radix-ui")) {
              return "ui-vendor";
            }

            // React 코어
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("react-router") ||
              id.includes("scheduler")
            ) {
              return "react-vendor";
            }

            // React 유틸리티 (react-xxx 패키지들)
            if (
              id.includes("react-hot-toast") ||
              id.includes("react-resizable-panels") ||
              id.includes("react-day-picker")
            ) {
              return "react-utils-vendor";
            }

            // ===== 폼 및 데이터 관리 =====

            // 폼 관련
            if (
              id.includes("react-hook-form") ||
              id.includes("@hookform") ||
              id.includes("zod")
            ) {
              return "form-vendor";
            }

            // TanStack (React Query + Table)
            if (id.includes("@tanstack")) {
              return "tanstack-vendor";
            }

            // ===== 시각화 =====

            // 차트 (Recharts + D3)
            if (id.includes("recharts") || id.includes("d3-")) {
              return "chart-vendor";
            }

            // ===== 마크다운 (shiki 제외) =====

            // 일반 마크다운 파서
            if (
              id.includes("marked") ||
              id.includes("react-markdown") ||
              id.includes("remark") ||
              id.includes("rehype") ||
              id.includes("unified") ||
              id.includes("micromark") ||
              id.includes("mdast") ||
              id.includes("hast")
            ) {
              return "markdown-vendor";
            }

            // 구문 강조 (shiki 외)
            if (
              id.includes("react-syntax-highlighter") ||
              id.includes("highlight.js") ||
              id.includes("prism")
            ) {
              return "syntax-vendor";
            }

            // ===== 기타 유틸리티 =====

            // 엑셀 라이브러리
            if (id.includes("xlsx") || id.includes("papaparse")) {
              return "excel-vendor";
            }

            // 애니메이션
            if (id.includes("framer-motion")) {
              return "animation-vendor";
            }

            // 국제화
            if (id.includes("i18next") || id.includes("react-i18next")) {
              return "i18n-vendor";
            }

            // AI/OpenAI
            if (id.includes("openai")) {
              return "ai-vendor";
            }

            // Date 관련
            if (id.includes("date-fns")) {
              return "date-vendor";
            }

            // 캐러셀
            if (id.includes("embla-carousel")) {
              return "carousel-vendor";
            }

            // 아이콘
            if (id.includes("lucide-react")) {
              return "icon-vendor";
            }

            // 상태 관리 (jotai, nuqs)
            if (id.includes("jotai") || id.includes("nuqs")) {
              return "state-vendor";
            }

            // 기타 유틸리티
            if (
              id.includes("clsx") ||
              id.includes("class-variance-authority") ||
              id.includes("tailwind-merge") ||
              id.includes("dompurify") ||
              id.includes("encoding-japanese") ||
              id.includes("utf8")
            ) {
              return "utils-vendor";
            }

            // 나머지 node_modules는 vendor로
            return "vendor";
          }

          // 페이지별 청크 분리
          if (id.includes("src/pages/")) {
            if (id.includes("src/pages/sequences/designer")) {
              return "page-sequence-designer";
            }
            if (id.includes("src/pages/sequences")) {
              return "page-sequences";
            }
            if (id.includes("src/pages/leads")) {
              return "page-leads";
            }
            if (id.includes("src/pages/customer-groups")) {
              return "page-customer-groups";
            }
            if (id.includes("src/pages/email-templates")) {
              return "page-email-templates";
            }
            if (id.includes("src/pages/workspaces")) {
              return "page-workspaces";
            }
            if (id.includes("src/pages/users")) {
              return "page-users";
            }
          }
        },
      },
    },
    // 매니페스트 파일 생성 (선택적)
    manifest: true,
  },
});
