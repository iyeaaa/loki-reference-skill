/**
 * Lead Discovery Service
 * AI-powered lead discovery using LangGraph
 *
 * Modes:
 * - Basic (Website): Analyze company website → Generate buyer recommendations → User selects → BigQuery search
 * - Advanced (Direct): Natural language search → BigQuery execution
 *
 * Features:
 * - Automatic mode detection (website URL vs direct query)
 * - Website crawling and AI analysis
 * - AI-generated buyer country/industry recommendations
 * - Human-in-the-loop selection for basic mode
 * - BigQuery NL-to-SQL conversion
 * - Docker-style comprehensive logging
 * - SSE streaming for real-time updates
 */

// Graph
export {
  clearCheckpoints,
  createLeadDiscoveryGraph,
  getSharedCheckpointer,
  NODE_NAMES,
} from "./graph"
// Logger
export { leadDiscoveryLogger } from "./logger"
export { executeBigQuery } from "./nodes/bigquery-executor"
export { generateBigQueryParams } from "./nodes/bigquery-param-generator"
export { recommendBuyers } from "./nodes/buyer-recommender"
// Nodes (for testing/extension)
export { routeMode } from "./nodes/mode-router"
export { analyzeWebsite } from "./nodes/website-analyzer"
// State
export type {
  BigQueryResult,
  BigQuerySearchParams,
  BuyerRecommendation,
  LeadDiscoveryMessage,
  LeadDiscoveryState,
  SearchMode,
  WebsiteAnalysis,
} from "./state"
export { LeadDiscoveryStateAnnotation } from "./state"
