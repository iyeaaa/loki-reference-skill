/**
 * Lead Discovery Logger
 * Docker-style compact logging
 */

import { logger as baseLogger } from "../../utils/logger"

const CTX = "lead-discovery"

// Format duration
const dur = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`

// Truncate string
const trunc = (s: string, len = 40): string => (s.length > len ? `${s.substring(0, len)}...` : s)

interface LeadDiscoveryLogger {
  // Session
  sessionStart: (id: string, ws: string, mode: string) => void
  sessionEnd: (id: string, duration: number, ok: boolean, count?: number) => void
  // Nodes
  nodeStart: (node: string, ctx?: Record<string, unknown>) => void
  nodeSuccess: (node: string, duration: number, ctx?: Record<string, unknown>) => void
  nodeError: (node: string, err: string, duration: number) => void
  nodeProgress: (node: string, pct: number, msg: string) => void
  // Routing
  route: (from: string, to: string, reason: string) => void
  routeDecision: (from: string, to: string, reason: string) => void
  // Mode
  modeDetected: (mode: string, confidence: number, indicators: string[]) => void
  // Website
  websiteStart: (url: string) => void
  websiteDone: (url: string, duration: number, company?: string) => void
  websiteAnalysisStart: (url: string) => void
  websiteAnalysisComplete: (url: string, duration: number, company?: string) => void
  websiteAnalysisProgress: (stage: string, pct: number) => void
  // Recommendations
  recommendations: (recs: Array<{ country: string; industry: string }>) => void
  recommendationsGenerated: (
    count: number,
    recs: Array<{ country: string; industry: string }>,
  ) => void
  selected: (country: string, industry: string) => void
  recommendationSelected: (r: { country: string; industry: string; reasoning: string }) => void
  // BigQuery
  bqParams: (params: Record<string, unknown>) => void
  bigQueryParamsGenerated: (params: Record<string, unknown>) => void
  bqStart: (query: string) => void
  bigQueryExecutionStart: (query: string) => void
  bqDone: (duration: number, count: number, total: number) => void
  bigQueryExecutionComplete: (duration: number, count: number, total: number) => void
  bqError: (err: string) => void
  bigQueryExecutionError: (err: string) => void
  // Human-in-the-loop
  waitSelection: (options: string[]) => void
  waitingForUserSelection: (options: string[]) => void
  userSelected: (sel: string) => void
  userSelectionReceived: (sel: string) => void
  // General
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string, ctx?: Record<string, unknown>) => void
  debug: (msg: string, data?: unknown) => void
}

export const leadDiscoveryLogger: LeadDiscoveryLogger = {
  // Session
  sessionStart: (id, ws, mode) => {
    baseLogger.info(`[${CTX}] session=${id.slice(0, 8)} workspace=${ws.slice(0, 8)} mode=${mode}`)
  },
  sessionEnd: (id, duration, ok, count) => {
    const status = ok ? "OK" : "FAIL"
    const results = count !== undefined ? ` results=${count}` : ""
    baseLogger.info(
      `[${CTX}] session=${id.slice(0, 8)} status=${status} duration=${dur(duration)}${results}`,
    )
  },

  // Nodes
  nodeStart: (node, ctx) => {
    const extra = ctx
      ? " " +
        Object.entries(ctx)
          .map(([k, v]) => `${k}=${trunc(String(v))}`)
          .join(" ")
      : ""
    baseLogger.info(`[${CTX}] node=${node} state=start${extra}`)
  },
  nodeSuccess: (node, duration, ctx) => {
    const extra = ctx
      ? " " +
        Object.entries(ctx)
          .map(([k, v]) => `${k}=${trunc(String(v))}`)
          .join(" ")
      : ""
    baseLogger.info(`[${CTX}] node=${node} state=done duration=${dur(duration)}${extra}`)
  },
  nodeError: (node, err, duration) => {
    baseLogger.error(
      `[${CTX}] node=${node} state=error duration=${dur(duration)} error="${trunc(err, 60)}"`,
    )
  },
  nodeProgress: (node, pct, msg) => {
    baseLogger.debug(`[${CTX}] node=${node} progress=${pct}% msg="${trunc(msg)}"`)
  },

  // Routing
  route: (from, to, reason) => {
    baseLogger.info(`[${CTX}] route=${from}->${to} reason="${trunc(reason)}"`)
  },
  routeDecision: (from, to, reason) => {
    baseLogger.info(`[${CTX}] route=${from}->${to} reason="${trunc(reason)}"`)
  },

  // Mode
  modeDetected: (mode, confidence, indicators) => {
    baseLogger.info(
      `[${CTX}] mode=${mode} confidence=${confidence}% indicators=[${indicators.slice(0, 3).join(",")}]`,
    )
  },

  // Website
  websiteStart: (url) => {
    baseLogger.info(`[${CTX}] action=crawl url=${trunc(url, 50)}`)
  },
  websiteDone: (_url, duration, company) => {
    const extra = company ? ` company="${trunc(company)}"` : ""
    baseLogger.info(`[${CTX}] action=crawl status=done duration=${dur(duration)}${extra}`)
  },
  websiteAnalysisStart: (url) => {
    baseLogger.info(`[${CTX}] action=crawl url=${trunc(url, 50)}`)
  },
  websiteAnalysisComplete: (_url, duration, company) => {
    const extra = company ? ` company="${trunc(company)}"` : ""
    baseLogger.info(`[${CTX}] action=crawl status=done duration=${dur(duration)}${extra}`)
  },
  websiteAnalysisProgress: (stage, pct) => {
    baseLogger.debug(`[${CTX}] node=analyzeWebsite progress=${pct}% msg="${trunc(stage)}"`)
  },

  // Recommendations
  recommendations: (recs) => {
    const summary = recs.map((r) => `${r.country}/${r.industry}`).join(", ")
    baseLogger.info(`[${CTX}] action=recommend count=${recs.length} targets=[${summary}]`)
  },
  recommendationsGenerated: (_count, recs) => {
    const summary = recs.map((r) => `${r.country}/${r.industry}`).join(", ")
    baseLogger.info(`[${CTX}] action=recommend count=${recs.length} targets=[${summary}]`)
  },
  selected: (country, industry) => {
    baseLogger.info(`[${CTX}] action=select target=${country}/${industry}`)
  },
  recommendationSelected: (r) => {
    baseLogger.info(`[${CTX}] action=select target=${r.country}/${r.industry}`)
  },

  // BigQuery
  bqParams: (params) => {
    const keys = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${trunc(String(v), 30)}`)
      .join(" ")
    baseLogger.info(`[${CTX}] action=bq-params ${keys}`)
  },
  bigQueryParamsGenerated: (params) => {
    const keys = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${trunc(String(v), 30)}`)
      .join(" ")
    baseLogger.info(`[${CTX}] action=bq-params ${keys}`)
  },
  bqStart: (query) => {
    baseLogger.info(`[${CTX}] action=bq-exec query="${trunc(query, 50)}"`)
  },
  bigQueryExecutionStart: (query) => {
    baseLogger.info(`[${CTX}] action=bq-exec query="${trunc(query, 50)}"`)
  },
  bqDone: (duration, count, total) => {
    baseLogger.info(
      `[${CTX}] action=bq-exec status=done duration=${dur(duration)} results=${count}/${total}`,
    )
  },
  bigQueryExecutionComplete: (duration, count, total) => {
    baseLogger.info(
      `[${CTX}] action=bq-exec status=done duration=${dur(duration)} results=${count}/${total}`,
    )
  },
  bqError: (err) => {
    baseLogger.error(`[${CTX}] action=bq-exec status=error error="${trunc(err, 60)}"`)
  },
  bigQueryExecutionError: (err) => {
    baseLogger.error(`[${CTX}] action=bq-exec status=error error="${trunc(err, 60)}"`)
  },

  // Human-in-the-loop
  waitSelection: (options) => {
    baseLogger.info(`[${CTX}] action=wait-select options=[${options.slice(0, 3).join(",")}]`)
  },
  waitingForUserSelection: (options) => {
    baseLogger.info(`[${CTX}] action=wait-select options=[${options.slice(0, 3).join(",")}]`)
  },
  userSelected: (sel) => {
    baseLogger.info(`[${CTX}] action=user-select value="${trunc(sel)}"`)
  },
  userSelectionReceived: (sel) => {
    baseLogger.info(`[${CTX}] action=user-select value="${trunc(sel)}"`)
  },

  // General
  info: (msg) => baseLogger.info(`[${CTX}] ${msg}`),
  warn: (msg) => baseLogger.warn(`[${CTX}] ${msg}`),
  error: (msg, ctx) => {
    const extra = ctx
      ? " " +
        Object.entries(ctx)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")
      : ""
    baseLogger.error(`[${CTX}] error="${msg}"${extra}`)
  },
  debug: (msg, data) => {
    if (data) baseLogger.debug({ data }, `[${CTX}] ${msg}`)
    else baseLogger.debug(`[${CTX}] ${msg}`)
  },
}

export default leadDiscoveryLogger
