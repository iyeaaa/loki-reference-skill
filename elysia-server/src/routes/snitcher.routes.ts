/**
 * IP Intelligence API Routes
 *
 * Public test endpoints for IP to Company feature.
 * Supports multiple providers: Snitcher, ipapi.is
 * @see https://docs.snitcher.com/ip2company
 * @see https://ipapi.is/developers.html
 */

import { Elysia, t } from "elysia"
import { config } from "../config"
import { lookupIp as ipapiLookup } from "../services/ipapi.service"
import { findCompanyByIp, getUsage } from "../services/snitcher.service"
import logger from "../utils/logger"

/**
 * Snitcher API routes (public - for testing page)
 * Uses server-configured API key for security
 */
export const snitcherTestRoutes = new Elysia({ prefix: "/api/v1/snitcher" })
  /**
   * Check if Snitcher API is configured
   * GET /api/v1/snitcher/status
   */
  .get(
    "/status",
    () => {
      const isConfigured = Boolean(config.snitcher.apiKey)
      return {
        success: true,
        configured: isConfigured,
        message: isConfigured ? "Snitcher API is configured" : "Snitcher API key not configured",
      }
    },
    {
      detail: {
        tags: ["snitcher"],
        summary: "Check API configuration status",
        description: "Returns whether Snitcher API key is configured on the server.",
      },
    },
  )

  /**
   * Find company by IP address
   * POST /api/v1/snitcher/find-company
   */
  .post(
    "/find-company",
    async ({ body, set }) => {
      const { ip } = body

      if (!ip) {
        set.status = 400
        return {
          success: false,
          error: "IP address is required",
        }
      }

      // Use server-configured API key
      const apiKey = config.snitcher.apiKey
      if (!apiKey) {
        set.status = 500
        return {
          success: false,
          error: "Snitcher API key not configured on server",
        }
      }

      // Validate IP format (IPv4 and IPv6)
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?!$)|$)){4}$/
      const ipv6Regex = /^([a-fA-F0-9:]+)$/
      if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
        set.status = 400
        return {
          success: false,
          error: "Invalid IP address format",
        }
      }

      logger.info({ ip }, "[Snitcher] Find company request")

      const result = await findCompanyByIp(ip, apiKey)

      if (!result.success && result.statusCode !== 200) {
        set.status = result.statusCode
      }

      return result
    },
    {
      body: t.Object({
        ip: t.String({ description: "IP address to lookup" }),
      }),
      detail: {
        tags: ["snitcher"],
        summary: "Find company by IP address",
        description:
          "Uses Snitcher IP to Company API to identify the company behind an IP address. Rate limit: 600 req/min.",
      },
    },
  )

  /**
   * Get API usage statistics
   * GET /api/v1/snitcher/usage
   */
  .get(
    "/usage",
    async ({ set }) => {
      const apiKey = config.snitcher.apiKey
      if (!apiKey) {
        set.status = 500
        return {
          success: false,
          error: "Snitcher API key not configured on server",
        }
      }

      logger.info("[Snitcher] Usage request")

      const result = await getUsage(apiKey)

      if (!result.success) {
        set.status = result.statusCode
      }

      return result
    },
    {
      detail: {
        tags: ["snitcher"],
        summary: "Get API usage statistics",
        description: "Returns credit usage, remaining credits, and billing cycle information.",
      },
    },
  )

/**
 * ipapi.is API routes (public - for testing page)
 * @see https://ipapi.is/developers.html
 */
export const ipapiTestRoutes = new Elysia({ prefix: "/api/v1/ipapi" })
  /**
   * Check if ipapi.is API is configured
   * GET /api/v1/ipapi/status
   */
  .get(
    "/status",
    () => {
      const isConfigured = Boolean(config.ipapi.apiKey)
      return {
        success: true,
        configured: isConfigured,
        // ipapi.is works without API key (free tier: 1000 req/day)
        message: isConfigured
          ? "ipapi.is API key configured (premium)"
          : "ipapi.is API available (free tier: 1000 req/day)",
      }
    },
    {
      detail: {
        tags: ["ipapi"],
        summary: "Check API configuration status",
        description: "Returns whether ipapi.is API key is configured on the server.",
      },
    },
  )

  /**
   * Lookup IP address
   * POST /api/v1/ipapi/lookup
   */
  .post(
    "/lookup",
    async ({ body, set }) => {
      const { ip } = body

      if (!ip) {
        set.status = 400
        return {
          success: false,
          error: "IP address is required",
        }
      }

      // Validate IP format (IPv4 and IPv6)
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?!$)|$)){4}$/
      const ipv6Regex = /^([a-fA-F0-9:]+)$/
      if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
        set.status = 400
        return {
          success: false,
          error: "Invalid IP address format",
        }
      }

      logger.info({ ip }, "[ipapi.is] Lookup request")

      // Use API key if configured, otherwise use free tier
      const apiKey = config.ipapi.apiKey || undefined
      const result = await ipapiLookup(ip, apiKey)

      if (!result.success && result.statusCode !== 200) {
        set.status = result.statusCode
      }

      return result
    },
    {
      body: t.Object({
        ip: t.String({ description: "IP address to lookup" }),
      }),
      detail: {
        tags: ["ipapi"],
        summary: "Lookup IP address",
        description:
          "Uses ipapi.is API to get IP intelligence data including company, location, VPN/proxy detection. Free tier: 1000 req/day.",
      },
    },
  )
