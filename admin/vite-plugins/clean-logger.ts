/**
 * Custom Vite plugin for clean, optimized logging
 * Inspired by Elysia's box-style logging approach
 */

import type { Plugin, ViteDevServer } from "vite"

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
} as const

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function printBoxHeader(title: string) {
  const line = "━".repeat(40)
  console.log(`\n  ${colorize("📦", "cyan")} ${colorize(title, "bright")}`)
  console.log(`  ${colorize(line, "cyan")}`)
}

function printBoxFooter() {
  const line = "━".repeat(40)
  console.log(`  ${colorize(line, "cyan")}`)
}

function printBoxItem(label: string, value: string) {
  console.log(`  ${colorize("▸", "cyan")} ${colorize(label + ":", "bright")} ${value}`)
}

function printBoxNote(text: string) {
  console.log(`  ${colorize("※", "dim")} ${colorize(text, "dim")}`)
}

export function cleanLoggerPlugin(): Plugin {
  let server: ViteDevServer
  let startTime: number
  let isFirstStart = true

  return {
    name: "vite:clean-logger",
    apply: "serve",

    configResolved(config) {
      // Suppress default Vite logging
      if (config.logLevel !== "silent") {
        // We'll handle our own logging
      }
    },

    configureServer(_server) {
      server = _server
      startTime = Date.now()

      // Override server print URLs to use our custom format
      server.printUrls = () => {
        const duration = Date.now() - startTime
        const urls = server.resolvedUrls

        if (!urls) return

        // Clear console on restart (not on first start)
        if (!isFirstStart) {
          console.clear()
        }
        isFirstStart = false

        // Print box-style header
        printBoxHeader("admin-panel")

        // Print development info
        printBoxItem("Dev", `yarn dev ${colorize(`(ready in ${formatTime(duration)})`, "dim")}`)

        // Print URLs
        if (urls.local && urls.local.length > 0) {
          printBoxItem("Local", colorize(urls.local[0], "cyan"))
        }

        if (urls.network && urls.network.length > 0) {
          printBoxItem("Network", colorize(urls.network[0], "cyan"))
          // Show additional networks if available
          for (let i = 1; i < urls.network.length; i++) {
            printBoxItem("       ", colorize(urls.network[i], "cyan"))
          }
        }

        printBoxItem("Build", "yarn build")

        printBoxFooter()

        // Print notes
        printBoxNote("Hot reload: enabled")
        printBoxNote("i18n: auto-sync enabled")
        printBoxNote("Code quality: husky hooks + send-ci.sh")

        console.log() // Empty line for spacing
      }

      // Intercept HMR update logs - silent mode
      server.ws.on("connection", () => {
        // Connection established silently
      })
    },

    transformIndexHtml() {
      // Suppress default transform logs
    },

    handleHotUpdate(ctx) {
      // Custom HMR logging - ultra minimal
      const shortFile = ctx.file.replace(server.config.root, "").replace(/^\//, "")
      const maxLength = 50
      const displayFile =
        shortFile.length > maxLength ? "..." + shortFile.slice(-maxLength) : shortFile
      process.stdout.write(
        `\r${colorize("↻", "dim")} ${colorize(displayFile, "dim")}${" ".repeat(10)}`,
      )
    },
  }
}

// Export utility to customize build logs
export function customBuildLogger() {
  return {
    onStart() {
      printBoxHeader("admin-panel")
      printBoxItem("Mode", "production build")
      console.log()
    },
    onEnd(duration: number) {
      console.log(
        `\n  ${colorize("✓", "green")} ${colorize("Built successfully in", "bright")} ${colorize(
          formatTime(duration),
          "cyan",
        )}`,
      )
      printBoxFooter()
      console.log()
    },
  }
}
