/**
 * Optimized logger utility for clean, docker-style logs
 * Inspired by Elysia's logging style
 */

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Text colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Background colors
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgCyan: "\x1b[46m",
} as const

// Log symbols
const symbols = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  arrow: "→",
  dot: "•",
} as const

type LogLevel = "success" | "error" | "warning" | "info" | "debug"

interface LogOptions {
  prefix?: string
  timestamp?: boolean
  inline?: boolean
}

class Logger {
  private prefix: string

  constructor(prefix = "") {
    this.prefix = prefix
  }

  private colorize(text: string, color: keyof typeof colors): string {
    return `${colors[color]}${text}${colors.reset}`
  }

  private formatPrefix(level: LogLevel): string {
    const prefixText = this.prefix ? ` ${this.prefix}` : ""

    switch (level) {
      case "success":
        return this.colorize(`${symbols.success}${prefixText}`, "green")
      case "error":
        return this.colorize(`${symbols.error}${prefixText}`, "red")
      case "warning":
        return this.colorize(`${symbols.warning}${prefixText}`, "yellow")
      case "info":
        return this.colorize(`${symbols.info}${prefixText}`, "cyan")
      case "debug":
        return this.colorize(`${symbols.dot}${prefixText}`, "gray")
      default:
        return prefixText
    }
  }

  private log(level: LogLevel, message: string, options: LogOptions = {}) {
    const prefix = options.prefix || this.formatPrefix(level)
    const output = `${prefix} ${message}`

    if (options.inline) {
      process.stdout.write(output)
    } else {
      console.log(output)
    }
  }

  success(message: string, options?: LogOptions) {
    this.log("success", message, options)
  }

  error(message: string, options?: LogOptions) {
    this.log("error", message, options)
  }

  warning(message: string, options?: LogOptions) {
    this.log("warning", message, options)
  }

  info(message: string, options?: LogOptions) {
    this.log("info", message, options)
  }

  debug(message: string, options?: LogOptions) {
    this.log("debug", message, options)
  }

  // Special methods for compact output
  group(title: string) {
    console.log(this.colorize(`\n${symbols.arrow} ${title}`, "cyan"))
  }

  item(message: string, indent = 2) {
    const spacing = " ".repeat(indent)
    console.log(`${spacing}${this.colorize(symbols.dot, "gray")} ${message}`)
  }

  divider() {
    console.log(this.colorize("─".repeat(50), "gray"))
  }

  // Utility methods
  colorize(text: string, color: keyof typeof colors): string {
    return `${colors[color]}${text}${colors.reset}`
  }

  dim(text: string): string {
    return this.colorize(text, "dim")
  }

  bright(text: string): string {
    return this.colorize(text, "bright")
  }
}

// Export singleton instance
export const logger = new Logger()

// Export factory for creating loggers with custom prefix
export function createLogger(prefix: string): Logger {
  return new Logger(prefix)
}

// Export colors and symbols for direct use
export { colors, symbols }
