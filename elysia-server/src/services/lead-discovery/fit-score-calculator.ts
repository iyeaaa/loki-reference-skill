/**
 * Fit Score Calculator
 * AI-based lead fit score calculation service
 */

import { createHash } from "node:crypto"
import { ChatOpenAI } from "@langchain/openai"
import { getDefaultFitScoreRedisCache } from "./fit-score-redis-cache"
import { leadDiscoveryLogger } from "./logger"

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
})

export interface LeadForScoring {
  id: string
  company_name?: string
  description?: string
  company_type?: string
  email?: string
  phone?: string
  web_address?: string
  http_status?: number | null
  verified?: boolean
  country?: string
  industry?: string
  sub_industry?: string
  employee?: string
  revenue?: string
  title?: string
}

export interface WebsiteAnalysisContext {
  companyName?: string
  description?: string
  industry?: string
  products?: string[]
  targetMarkets?: string[]
  businessModel?: string
}

export interface FitScoreResult {
  leadId: string
  score: number
  reason?: string
}

type FitScoreCacheValue = {
  score: number
  reason?: string
  expiresAt: number
}

class LruTtlCache {
  private readonly maxEntries: number
  private readonly defaultTtlMs: number
  private readonly map = new Map<string, FitScoreCacheValue>()

  constructor(options: { maxEntries: number; defaultTtlMs: number }) {
    this.maxEntries = options.maxEntries
    this.defaultTtlMs = options.defaultTtlMs
  }

  get(key: string): FitScoreCacheValue | null {
    const value = this.map.get(key)
    if (!value) return null
    if (Date.now() >= value.expiresAt) {
      this.map.delete(key)
      return null
    }
    // LRU: refresh insertion order
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: string, value: Omit<FitScoreCacheValue, "expiresAt"> & { ttlMs?: number }): void {
    const ttlMs = value.ttlMs ?? this.defaultTtlMs
    const payload: FitScoreCacheValue = {
      score: value.score,
      reason: value.reason,
      expiresAt: Date.now() + ttlMs,
    }

    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, payload)

    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as string | undefined
      if (!oldestKey) break
      this.map.delete(oldestKey)
    }
  }
}

const FIT_SCORE_CACHE = new LruTtlCache({
  // Memory cache: Prevents re-evaluation of identical input (lead + query + target/seller context)
  maxEntries: Number.parseInt(process.env.LEAD_DISCOVERY_FIT_SCORE_CACHE_MAX || "20000", 10),
  defaultTtlMs:
    Number.parseInt(
      process.env.LEAD_DISCOVERY_FIT_SCORE_CACHE_TTL_MS || `${6 * 60 * 60 * 1000}`,
      10,
    ) || 6 * 60 * 60 * 1000,
})

const FIT_SCORE_REDIS_CACHE = getDefaultFitScoreRedisCache()

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase()
}

function makeFitScoreCacheKey(params: {
  lead: LeadForScoring
  websiteAnalysis: WebsiteAnalysisContext
  selectedTarget: { country: string; industry: string }
  userQuery?: string
  workspaceId?: string
}): string {
  const { lead, websiteAnalysis, selectedTarget, userQuery, workspaceId } = params
  const raw = JSON.stringify({
    v: 2,
    workspaceId: workspaceId ?? null,
    userQuery: userQuery ?? null,
    selectedTarget,
    websiteAnalysis: userQuery
      ? // For userQuery-based scoring, seller info has low impact so reduce key size
        { companyName: websiteAnalysis.companyName ?? null }
      : {
          companyName: websiteAnalysis.companyName ?? null,
          description: websiteAnalysis.description ?? null,
          industry: websiteAnalysis.industry ?? null,
          products: websiteAnalysis.products ?? null,
          targetMarkets: websiteAnalysis.targetMarkets ?? null,
          businessModel: websiteAnalysis.businessModel ?? null,
        },
    lead: {
      id: lead.id,
      company_name: lead.company_name ?? null,
      description: lead.description ?? null,
      company_type: lead.company_type ?? null,
      http_status: lead.http_status ?? null,
      verified: Boolean(lead.verified),
      country: lead.country ?? null,
      industry: lead.industry ?? null,
      sub_industry: lead.sub_industry ?? null,
      title: lead.title ?? null,
      employee: lead.employee ?? null,
      revenue: lead.revenue ?? null,
      email: Boolean(lead.email),
      phone: Boolean(lead.phone),
      web_address: Boolean(lead.web_address),
    },
  })

  return createHash("sha256").update(raw).digest("hex")
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.min(100, Math.max(0, Math.round(score)))
}

function isLikelyValidEmail(value?: string): boolean {
  const v = normalizeText(value)
  return Boolean(v?.includes("@") && !v.includes("noreply"))
}

function isWebsiteUnreachable(httpStatus?: number | null): boolean {
  if (httpStatus === null || httpStatus === undefined) return false
  // 4xx/5xx: Considered as access failure
  return httpStatus >= 400
}

function toHttpUrl(raw?: string | null): string | null {
  const value = (raw ?? "").trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

async function probeWebsiteHttpStatus(
  url: string,
  timeoutMs: number,
): Promise<{ status: number; finalUrl?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    // 1) Try HEAD first
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    })
    return { status: head.status, finalUrl: head.url }
  } catch {
    // 2) Many sites block HEAD, so fallback to GET
    const controller2 = new AbortController()
    const timer2 = setTimeout(() => controller2.abort(), timeoutMs)
    try {
      const get = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller2.signal,
        headers: {
          // Mitigate cases where some servers block requests without UA
          "User-Agent": "Mozilla/5.0 (compatible; LeadDiscoveryBot/1.0)",
        },
      })
      return { status: get.status, finalUrl: get.url }
    } finally {
      clearTimeout(timer2)
    }
  } finally {
    clearTimeout(timer)
  }
}

async function hydrateMissingHttpStatus(leads: LeadForScoring[]): Promise<LeadForScoring[]> {
  const enabled =
    (process.env.LEAD_DISCOVERY_FIT_SCORE_WEBSITE_PROBE_ENABLED ?? "true").toLowerCase().trim() ===
    "true"
  if (!enabled) return leads

  const timeoutMs = parsePositiveInt(
    process.env.LEAD_DISCOVERY_FIT_SCORE_WEBSITE_PROBE_TIMEOUT_MS,
    2500,
  )
  const concurrency = parsePositiveInt(
    process.env.LEAD_DISCOVERY_FIT_SCORE_WEBSITE_PROBE_CONCURRENCY,
    10,
  )

  const tasks: Array<() => Promise<void>> = []
  const statusById = new Map<string, number>()

  for (const lead of leads) {
    if (lead.http_status !== null && lead.http_status !== undefined) continue
    const url = toHttpUrl(lead.web_address)
    if (!url) continue

    tasks.push(async () => {
      try {
        const { status } = await probeWebsiteHttpStatus(url, timeoutMs)
        statusById.set(lead.id, status)
      } catch (error) {
        // Network/timeout etc: Treat as access failure to apply strong penalty
        leadDiscoveryLogger.debug?.(
          `[fit-score] website probe failed leadId=${lead.id} url=${url}: ${String(error)}`,
        )
        statusById.set(lead.id, 599)
      }
    })
  }

  if (tasks.length === 0) return leads

  // Simple worker pool (without dependencies)
  let idx = 0
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, tasks.length)) },
    async () => {
      while (true) {
        const current = idx
        idx++
        const task = tasks[current]
        if (!task) break
        await task()
      }
    },
  )
  await Promise.all(workers)

  return leads.map((lead) => {
    const status = statusById.get(lead.id)
    if (status === undefined) return lead
    return { ...lead, http_status: status }
  })
}

function applyFitScorePolicy(params: {
  lead: LeadForScoring
  base: FitScoreResult
}): FitScoreResult {
  const { lead, base } = params
  let score = base.score

  const hasWebsite = Boolean(normalizeText(lead.web_address))
  const hasEmail = isLikelyValidEmail(lead.email)
  const hasPhone = Boolean(normalizeText(lead.phone))
  const websiteUnreachable = isWebsiteUnreachable(lead.http_status)

  const missingSignals: string[] = []
  if (!normalizeText(lead.company_name)) missingSignals.push("company_name")
  if (!normalizeText(lead.country)) missingSignals.push("country")
  if (!normalizeText(lead.industry) && !normalizeText(lead.sub_industry))
    missingSignals.push("industry")
  if (!normalizeText(lead.description)) missingSignals.push("description")
  if (!hasWebsite) missingSignals.push("website")
  if (!hasEmail) missingSignals.push("email")
  if (!hasPhone) missingSignals.push("phone")

  // (1) Missing information penalty: Lower score as key information is missing
  // - Rather than completely overturning the "match" score, lower reliability based on missing info
  const missingPenalty = Math.min(35, missingSignals.length * 5)
  score -= missingPenalty

  // (2) Email bonus: Add points if company email exists
  if (hasEmail) score += 8

  // (3) Additional penalty if almost no contact info
  if (!hasEmail && !hasPhone) score -= 10

  // (4) Enhanced profile (verified) bonus: Slightly increase information reliability
  if (lead.verified) score += 5

  score = clampScore(score)

  // (5) Website access failure is reflected with "strong floor/ceiling" policy
  // - User requirement: If website is unreachable, score should be significantly lowered
  if (websiteUnreachable) {
    score = Math.min(score, 12)
  }

  // (6) If website doesn't exist at all, lower score ceiling (can't verify accessibility)
  if (!hasWebsite) {
    score = Math.min(score, 25)
  }

  const policyNotes: string[] = []
  if (websiteUnreachable) policyNotes.push(`Website access failed(http=${lead.http_status ?? "?"})`)
  if (!hasWebsite) policyNotes.push("No website")
  if (missingPenalty > 0) policyNotes.push(`Missing info(-${missingPenalty})`)
  if (hasEmail) policyNotes.push("Company email(+8)")
  if (!hasEmail && !hasPhone) policyNotes.push("Lack of contact(-10)")
  if (lead.verified) policyNotes.push("Enhanced profile(+5)")

  const mergedReason =
    policyNotes.length > 0
      ? [base.reason, `Policy: ${policyNotes.join(", ")}`].filter(Boolean).join(" | ")
      : base.reason

  return {
    ...base,
    score,
    reason: mergedReason,
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function truncateForPrompt(value: string | undefined | null, maxChars: number): string {
  const v = (value ?? "").toString().trim().replaceAll(/\s+/g, " ")
  if (!v) return ""
  if (v.length <= maxChars) return v
  return `${v.slice(0, maxChars)}…`
}

/**
 * "Ultra-compressed" lead representation for LLM prompts
 * - One line = One lead
 * - pipe(|) delimited fixed columns
 */
function formatLeadForPrompt(lead: LeadForScoring): string {
  const company = truncateForPrompt(lead.company_name, 40) || "N/A"
  const type = truncateForPrompt(lead.company_type, 24) || "N/A"
  const country = truncateForPrompt(lead.country, 24) || "N/A"
  const industry = truncateForPrompt(lead.industry, 28) || "N/A"
  const sub = truncateForPrompt(lead.sub_industry, 28) || "N/A"
  const title = truncateForPrompt(lead.title, 24) || "N/A"
  const employees = truncateForPrompt(lead.employee, 16) || "N/A"
  const desc = truncateForPrompt(lead.description, 90) || "N/A"
  const hasEmail = lead.email ? "1" : "0"
  const hasPhone = lead.phone ? "1" : "0"
  const hasWebsite = lead.web_address ? "1" : "0"
  const http = lead.http_status ?? -1
  const verified = lead.verified ? "1" : "0"

  // Columns:
  // id|company|type|country|industry|subIndustry|title|employees|hasEmail|hasPhone|hasWebsite|httpStatus|verified|desc
  return [
    lead.id,
    company,
    type,
    country,
    industry,
    sub,
    title,
    employees,
    hasEmail,
    hasPhone,
    hasWebsite,
    String(http),
    verified,
    desc,
  ].join("|")
}

function chunkLeadsForPrompt(
  leads: LeadForScoring[],
  options: { maxBatchSize: number; maxPromptChars: number },
): LeadForScoring[][] {
  const batches: LeadForScoring[][] = []
  const { maxBatchSize, maxPromptChars } = options

  let current: LeadForScoring[] = []
  let currentChars = 0

  for (const lead of leads) {
    const line = formatLeadForPrompt(lead)
    const nextChars = currentChars + line.length + 1 // + newline
    const wouldExceedChars = current.length > 0 && nextChars > maxPromptChars
    const wouldExceedCount = current.length >= maxBatchSize

    if (wouldExceedChars || wouldExceedCount) {
      batches.push(current)
      current = []
      currentChars = 0
    }

    current.push(lead)
    currentChars += line.length + 1
  }

  if (current.length > 0) {
    batches.push(current)
  }

  return batches
}

function isMaterialsSearchQuery(userQuery: string): boolean {
  return /building materials?|construction materials?|건축\s*자재|건자재|인테리어\s*자재|외장\s*자재|interior.*materials?|remodel.*materials?|flooring|tile|cabinet|lumber|concrete/i.test(
    userQuery,
  )
}

function isSalesSearchQuery(userQuery: string): boolean {
  return /wholesale|distributor|supplier|vendor|retailer|판매|도매|유통|공급/i.test(userQuery)
}

function leadCountryMatches(leadCountry: string | undefined, expectedCountry: string): boolean {
  const a = normalizeText(leadCountry)
  const b = normalizeText(expectedCountry)
  if (!a || !b) return false

  const synonyms: Record<string, string[]> = {
    "united states": ["us", "usa", "u.s.", "u.s.a", "america", "united states of america"],
    "united kingdom": ["uk", "u.k.", "britain", "great britain", "england"],
    "south korea": ["korea", "republic of korea", "kr", "korea, republic of"],
    japan: ["jp"],
  }

  const aExpanded = [a, ...(synonyms[a] ?? [])]
  const bExpanded = [b, ...(synonyms[b] ?? [])]

  for (const left of aExpanded) {
    for (const right of bExpanded) {
      if (!left || !right) continue
      if (left === right) return true
      if (left.includes(right) || right.includes(left)) return true
    }
  }
  return false
}

function tryRuleBasedScore(params: {
  lead: LeadForScoring
  selectedTarget: { country: string; industry: string }
  userQuery?: string
}): FitScoreResult | null {
  const { lead, selectedTarget, userQuery } = params

  const leadText = normalizeText(
    `${lead.company_name ?? ""} ${lead.industry ?? ""} ${lead.sub_industry ?? ""}`,
  )
  const extractedCountry = userQuery ? extractCountryFromQuery(userQuery) : null

  // (1) Country mismatch is a cheap, high-signal filter
  if (
    userQuery &&
    extractedCountry &&
    lead.country &&
    !leadCountryMatches(lead.country, extractedCountry)
  ) {
    return {
      leadId: lead.id,
      score: 5,
      reason: `Country mismatch(requested: ${extractedCountry}, lead: ${lead.country})`,
    }
  }
  if (!userQuery && lead.country && !leadCountryMatches(lead.country, selectedTarget.country)) {
    return {
      leadId: lead.id,
      score: 10,
      reason: `Target country mismatch(target: ${selectedTarget.country}, lead: ${lead.country})`,
    }
  }

  if (!userQuery) return null

  // (2) Query intent-aware cheap rules to avoid LLM on obvious cases
  const materials = isMaterialsSearchQuery(userQuery)
  const sales = isSalesSearchQuery(userQuery)
  const isMaterialsSearch = materials
  const isSalesSearch = !materials && sales

  if (isMaterialsSearch && !isSalesSearch) {
    const supplierKeywords = [
      "aggregates",
      "aggregate",
      "ready-mix",
      "ready mix",
      "stone",
      "gravel",
      "sand",
      "asphalt",
      "lumber",
      "timber",
      "wood products",
      "building materials",
      "construction materials",
      "building supplies",
      "construction supplies",
      "building components",
      "supplier",
      "distributor",
      "wholesale",
      "supply",
      "materials",
    ]

    const contractorKeywords = [
      "contractor",
      "contracting",
      "roofing",
      "fencing",
      "installation",
      "remodel",
      "renovat",
      "home builder",
      "construction company",
      "construction",
    ]

    const exclusionKeywords = [
      "architect",
      "architecture",
      "engineering",
      "engineer",
      "design studio",
      "interior design",
      "landscape",
      "urban planning",
      "real estate",
      "realtor",
      "insurance",
      "law",
      "accounting",
      "association",
      "software",
      "it",
      "government",
    ]

    if (exclusionKeywords.some((k) => leadText.includes(k))) {
      return {
        leadId: lead.id,
        score: 15,
        reason: "Clear exclusion(service/professional/unrelated)",
      }
    }

    if (supplierKeywords.some((k) => leadText.includes(k))) {
      return { leadId: lead.id, score: 90, reason: "Materials/distribution/supply keyword match" }
    }

    if (contractorKeywords.some((k) => leadText.includes(k))) {
      return {
        leadId: lead.id,
        score: 30,
        reason: "Construction/service nature(low probability of materials supplier)",
      }
    }
  }

  return null
}

// Check if it's a simple location/country search (no additional conditions like industry)
function isSimpleLocationSearch(query: string): boolean {
  // 1. Check "country: XX" or "region: XX" pattern
  const parts = query.split(",").map((p) => p.trim())
  const isLocationPrefixOnly = parts.every((part) => /^(국가|지역):/.test(part) || part === "")
  if (isLocationPrefixOnly) return true

  // 2. Check simple country/region + general noun patterns like "XX company", "XX corporation", "XX business"
  // Treat as simple location search if no industry keywords present
  const industryKeywords = [
    // English industries
    "cosmetic",
    "beauty",
    "pharmaceutical",
    "automotive",
    "electronics",
    "semiconductor",
    "software",
    "manufacturing",
    "retail",
    "wholesale",
    "distributor",
    "healthcare",
    "medical",
    "food",
    "beverage",
    "textile",
    "chemical",
    "energy",
    "construction",
    "real estate",
    "finance",
    "insurance",
    "logistics",
    "transportation",
    "agriculture",
    "mining",
    "telecom",
    "media",
    "entertainment",
    "hospitality",
    "education",
    "consulting",
    // Korean industries
    "화장품",
    "뷰티",
    "제약",
    "자동차",
    "전자",
    "반도체",
    "소프트웨어",
    "IT",
    "제조",
    "소매",
    "도매",
    "유통",
    "헬스케어",
    "의료",
    "식품",
    "음료",
    "섬유",
    "화학",
    "에너지",
    "건설",
    "부동산",
    "금융",
    "보험",
    "물류",
    "운송",
    "농업",
    "광업",
    "통신",
    "미디어",
    "엔터테인먼트",
    "호텔",
    "교육",
    "컨설팅",
    "바이오",
    "배터리",
    "태양광",
    "풍력",
  ]

  const lowerQuery = query.toLowerCase()
  const hasIndustryKeyword = industryKeywords.some((keyword) =>
    lowerQuery.includes(keyword.toLowerCase()),
  )

  // Simple location search if no industry keywords present
  return !hasIndustryKeyword
}

// Extract country name from Korean query
function extractCountryFromQuery(query: string): string | null {
  const countryMap: Record<string, string> = {
    미국: "United States",
    "미 ": "United States",
    인도네시아: "Indonesia",
    캐나다: "Canada",
    영국: "United Kingdom",
    호주: "Australia",
    독일: "Germany",
    프랑스: "France",
    일본: "Japan",
    중국: "China",
    싱가포르: "Singapore",
    말레이시아: "Malaysia",
    태국: "Thailand",
    베트남: "Vietnam",
    필리핀: "Philippines",
    인도: "India",
    브라질: "Brazil",
    멕시코: "Mexico",
    스페인: "Spain",
    이탈리아: "Italy",
    네덜란드: "Netherlands",
    스위스: "Switzerland",
    스웨덴: "Sweden",
    노르웨이: "Norway",
    덴마크: "Denmark",
    벨기에: "Belgium",
    폴란드: "Poland",
    아일랜드: "Ireland",
    뉴질랜드: "New Zealand",
    남아프리카: "South Africa",
    아랍에미리트: "United Arab Emirates",
    사우디: "Saudi Arabia",
    터키: "Turkey",
  }

  for (const [korean, english] of Object.entries(countryMap)) {
    if (query.includes(korean)) {
      return english
    }
  }

  return null
}

/**
 * Calculate lead fit scores in batches (max 100 units, auto-reduced based on prompt length)
 */
export async function calculateFitScores(
  leads: LeadForScoring[],
  websiteAnalysis: WebsiteAnalysisContext,
  selectedTarget: { country: string; industry: string },
  onScore: (result: FitScoreResult) => void,
  userQuery?: string, // User search query added
  workspaceId?: string,
): Promise<void> {
  // Fill http_status as much as possible to reflect website access failures even before enrichment
  const effectiveLeads = await hydrateMissingHttpStatus(leads)

  // For simple location/country searches, return 100 points for all without AI call
  if (userQuery && isSimpleLocationSearch(userQuery)) {
    leadDiscoveryLogger.info(
      `Simple location search detected: "${userQuery}". All leads scored 100.`,
    )
    for (const lead of effectiveLeads) {
      const base: FitScoreResult = {
        leadId: lead.id,
        score: 100,
        reason: "Simple location/country search",
      }
      onScore(applyFitScorePolicy({ lead, base }))
    }
    return
  }

  // Requested batch size (max 100) - can automatically become smaller based on actual LLM prompt length
  const requestedBatchSize = parsePositiveInt(process.env.LEAD_DISCOVERY_FIT_SCORE_BATCH_SIZE, 100)
  const maxBatchSize = Math.max(1, Math.min(100, requestedBatchSize))
  const maxPromptChars = parsePositiveInt(
    process.env.LEAD_DISCOVERY_FIT_SCORE_BATCH_MAX_PROMPT_CHARS,
    45000,
  )
  const concurrency =
    effectiveLeads.length >= 100
      ? parsePositiveInt(process.env.LEAD_DISCOVERY_FIT_SCORE_CONCURRENCY, 3)
      : parsePositiveInt(process.env.LEAD_DISCOVERY_FIT_SCORE_CONCURRENCY, 1)

  const redisWrites: Array<{ keyHash: string; value: { score: number; reason?: string } }> = []

  // 0) key precompute (hash) to reuse across memory/redis cache
  const keyByLeadId = new Map<string, string>()
  for (const lead of effectiveLeads) {
    const keyHash = makeFitScoreCacheKey({
      lead,
      websiteAnalysis,
      selectedTarget,
      userQuery,
      workspaceId,
    })
    keyByLeadId.set(lead.id, keyHash)
  }

  const remainingForLlm: LeadForScoring[] = []
  const candidatesForRedis: LeadForScoring[] = []

  // 1) Memory cache hits are returned immediately
  for (const lead of effectiveLeads) {
    const keyHash = keyByLeadId.get(lead.id)
    if (!keyHash) {
      remainingForLlm.push(lead)
      continue
    }

    const cached = FIT_SCORE_CACHE.get(keyHash)
    if (cached) {
      onScore(
        applyFitScorePolicy({
          lead,
          base: { leadId: lead.id, score: cached.score, reason: cached.reason },
        }),
      )
      continue
    }

    candidatesForRedis.push(lead)
  }

  // 2) Redis distributed cache hits are processed at once with MGET (if possible)
  if (FIT_SCORE_REDIS_CACHE.isEnabled() && candidatesForRedis.length > 0) {
    const keyHashes = candidatesForRedis
      .map((l) => keyByLeadId.get(l.id))
      .filter((v): v is string => Boolean(v))

    const redisHitMap = await FIT_SCORE_REDIS_CACHE.getMany(keyHashes)
    if (redisHitMap.size > 0) {
      const remainingAfterRedis: LeadForScoring[] = []
      for (const lead of candidatesForRedis) {
        const keyHash = keyByLeadId.get(lead.id)
        if (!keyHash) {
          remainingAfterRedis.push(lead)
          continue
        }

        const hit = redisHitMap.get(keyHash)
        if (hit) {
          FIT_SCORE_CACHE.set(keyHash, { score: hit.score, reason: hit.reason })
          onScore(
            applyFitScorePolicy({
              lead,
              base: { leadId: lead.id, score: hit.score, reason: hit.reason },
            }),
          )
          continue
        }

        remainingAfterRedis.push(lead)
      }

      candidatesForRedis.length = 0
      candidatesForRedis.push(...remainingAfterRedis)
    }
  }

  // 3) Rule-based pre-filtering (skip LLM for obvious cases)
  for (const lead of candidatesForRedis) {
    const keyHash = keyByLeadId.get(lead.id)
    if (!keyHash) {
      remainingForLlm.push(lead)
      continue
    }

    const ruleScore = tryRuleBasedScore({ lead, selectedTarget, userQuery })
    if (ruleScore) {
      const finalScore = applyFitScorePolicy({ lead, base: ruleScore })
      FIT_SCORE_CACHE.set(keyHash, { score: finalScore.score, reason: finalScore.reason })
      redisWrites.push({
        keyHash,
        value: { score: finalScore.score, reason: finalScore.reason },
      })
      onScore(finalScore)
      continue
    }

    remainingForLlm.push(lead)
  }

  if (remainingForLlm.length === 0) return

  // 4) LLM batches are automatically split from "max 100" considering prompt length limits
  const batches = chunkLeadsForPrompt(remainingForLlm, {
    maxBatchSize,
    maxPromptChars,
  })

  let nextBatchIndex = 0
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, batches.length)) },
    async () => {
      while (true) {
        const currentIndex = nextBatchIndex
        nextBatchIndex++
        if (currentIndex >= batches.length) break

        const batch = batches[currentIndex]
        if (!batch) break

        try {
          const scores = await calculateBatchScores(
            batch,
            websiteAnalysis,
            selectedTarget,
            userQuery,
          )
          for (const score of scores) {
            const lead = batch.find((l) => l.id === score.leadId)
            if (lead) {
              const base: FitScoreResult = {
                leadId: score.leadId,
                score: score.score,
                reason: score.reason ?? "LLM evaluation",
              }
              const finalScore = applyFitScorePolicy({ lead, base })
              const keyHash = keyByLeadId.get(lead.id)
              if (keyHash) {
                FIT_SCORE_CACHE.set(keyHash, {
                  score: finalScore.score,
                  reason: finalScore.reason,
                })
                redisWrites.push({
                  keyHash,
                  value: { score: finalScore.score, reason: finalScore.reason },
                })
              }
            }
            if (lead) {
              const base: FitScoreResult = {
                leadId: score.leadId,
                score: score.score,
                reason: score.reason ?? "LLM evaluation",
              }
              onScore(applyFitScorePolicy({ lead, base }))
            } else {
              onScore(score)
            }
          }
        } catch (error) {
          leadDiscoveryLogger.error(
            `Fit score calculation error for batch ${currentIndex}: ${error}`,
          )
          for (const lead of batch) {
            const base: FitScoreResult = {
              leadId: lead.id,
              score: 50,
              reason: "Error occurred during calculation",
            }
            onScore(applyFitScorePolicy({ lead, base }))
          }
        }
      }
    },
  )

  await Promise.all(workers)

  // 4) Redis cache writes are "performance assistance" so batch attempt at the end (main flow unaffected even if failed)
  await FIT_SCORE_REDIS_CACHE.setMany(redisWrites)
}

/**
 * Calculate batch fit scores
 */
async function calculateBatchScores(
  leads: LeadForScoring[],
  websiteAnalysis: WebsiteAnalysisContext,
  selectedTarget: { country: string; industry: string },
  userQuery?: string,
): Promise<FitScoreResult[]> {
  // To increase batch size, compose lead info in a very compressed format
  // (Field/description abbreviated as length quickly exceeds model context limit)
  const leadsInfo = leads.map(formatLeadForPrompt).join("\n")

  // If userQuery exists, evaluate based on search query; otherwise evaluate based on seller info
  const searchCriteria = userQuery
    ? `## User Search Query (MOST IMPORTANT):
"${userQuery}"

Evaluate each lead based on how well they match this search query.`
    : `## Seller Company (Our Client):
- Company Name: ${websiteAnalysis.companyName || "Unknown"}
- Description: ${websiteAnalysis.description || "N/A"}
- Industry: ${websiteAnalysis.industry || "N/A"}
- Products/Services: ${websiteAnalysis.products?.join(", ") || "N/A"}
- Target Markets: ${websiteAnalysis.targetMarkets?.join(", ") || "N/A"}
- Business Model: ${websiteAnalysis.businessModel || "N/A"}`

  // Extract country from user query
  const extractedCountry = userQuery ? extractCountryFromQuery(userQuery) : null

  // Detect materials/product search (when looking for wholesalers/distributors) - check first
  const isMaterialsSearch = Boolean(userQuery && isMaterialsSearchQuery(userQuery))

  // Detect sales-related keywords (ignore if materials search)
  const isSalesSearch = Boolean(userQuery && !isMaterialsSearch && isSalesSearchQuery(userQuery))

  // Extract product/materials keywords
  const productKeywords = userQuery
    ? userQuery
        .toLowerCase()
        .replace(/wholesale|distributor|supplier|vendor|retailer|도매|유통|공급|업체|회사/gi, "")
        .trim()
    : ""

  const prompt = `You are evaluating potential business leads for a B2B context.

${searchCriteria}

## Selected Target Criteria:
- Target Country: ${selectedTarget.country}
- Target Industry: ${selectedTarget.industry}
${extractedCountry ? `- User Requested Country (from query): ${extractedCountry}` : ""}

## Leads to Evaluate:
Each line is one lead, with pipe-delimited columns:
id|company|companyType|country|industry|subIndustry|title|employees|hasEmail|hasPhone|hasWebsite|httpStatus|verified|description
- hasEmail/hasPhone/hasWebsite/verified are 0 or 1
- httpStatus is a number (or -1 when unknown)
- description is truncated
${leadsInfo}

## ⚠️ CRITICAL: SEARCH INTENT UNDERSTANDING

${
  isMaterialsSearch && !isSalesSearch
    ? `**SEARCH INTENT: Finding BUILDING MATERIALS SUPPLIERS/DISTRIBUTORS/MANUFACTURERS**

The user is looking for companies that SUPPLY, DISTRIBUTE, or MANUFACTURE building materials.

### ⭐ MATERIALS SUPPLIER KEYWORDS (MUST SCORE 80-100):
If industry contains ANY of these keywords → This is a MATERIALS SUPPLIER:
- "aggregates", "aggregate", "ready-mix", "ready mix"
- "stone", "gravel", "sand", "asphalt", "crushed limestone"
- "lumber", "wood products", "timber"
- "building materials", "construction materials", "building supplies"
- "building components", "construction supplies"
- "wholesale", "distributor", "supplier" (with materials context)

### HIGH SCORE (80-100) - Actual materials suppliers/manufacturers:
- Building materials distributors/wholesalers
- Construction materials suppliers
- Lumber/wood products companies
- Aggregate/stone/gravel suppliers (Aggregates, Ready-mix concrete)
- Glass/window/door manufacturers
- Roofing materials suppliers (not contractors)
- Flooring materials suppliers
- Hardware/fastener distributors
- Steel/metal products suppliers
- Insulation/drywall manufacturers
- Plumbing/electrical supplies distributors

### MEDIUM SCORE (40-60) - Companies with some materials focus:
- Specialty contractors with materials division
- Equipment + materials suppliers
- Companies that both manufacture and install
- Concrete companies (may be supplier OR contractor - check context)

### ⚠️ CONTRACTOR DETECTION (MUST SCORE 20-40):
If industry contains these keywords WITHOUT "supplier/distributor/wholesale/materials":
- "contractor", "contracting", "roofing contractor"
- "fencing", "fence installation", "fence contractor"
- "home building", "home builder", "residential construction"
- "remodeling", "renovation", "repair services"
- "installation", "paving", "landscaping"
→ These are SERVICE companies, NOT materials suppliers. MAX 40 points!

### LOW SCORE (20-40) - Service-focused, NOT materials suppliers:
- General contractors (they BUY materials, not sell)
- Home builders (construction service)
- Roofing contractors (service, not materials)
- Paving companies (service)
- Landscaping companies (service)
- Remodeling contractors (service)

### VERY LOW SCORE (0-20) - Completely unrelated:
- Associations/trade groups
- Law firms, Insurance, Accounting
- Real estate brokers/agents
- Software/IT companies
- Government agencies

### KEY DISTINGUISHING FACTORS:
1. **MATERIALS keywords** = HIGH score: "aggregates", "ready-mix", "lumber", "stone", "gravel", "supplies", "wholesale"
2. **CONTRACTOR keywords** = LOW score: "contractor", "roofing", "fencing", "installation", "renovation", "home builder"
3. Company name containing: "Materials", "Supply", "Products", "Lumber", "Aggregates" → 80-100 points
4. Company name containing: "Construction", "Builders", "Contractors", "Roofing", "Fencing" → 20-40 points`
    : isSalesSearch
      ? `**THE USER IS A SELLER** looking for companies who would BUY their products/services.

When the search query contains "wholesale", "distributor", "supplier", or similar terms:
- The USER is the one SELLING these products
- We need to find companies that would CONSUME/PURCHASE these products

### Example: "building materials wholesale"
- The USER sells building materials
- IDEAL BUYERS include:
  - Construction companies (they BUY materials for projects)
  - Home builders (they BUY materials to build homes)
  - Real estate developers (they BUY materials for developments)
  - Remodeling/renovation contractors (they BUY materials)
  - Architecture firms (they specify materials for projects)
  - Interior design companies (they source materials)
  
- NOT ideal: Other building material wholesalers (competitors, not buyers)

### Product/Materials Keywords from Query: "${productKeywords}"
Companies that USE or CONSUME these products should score HIGH!`
      : `Evaluate leads based on industry alignment with the search criteria.`
}

## Task:
For each lead, calculate a FIT SCORE (0-100) based on:

1. **COUNTRY MATCH (40 points max)**
   - EXACT country match = 40 points
   - Related region = 20 points
   - Different country/region = 0 points
   ${extractedCountry ? `- User specifically requested "${extractedCountry}". If lead's country doesn't match, score penalty applies.` : ""}
   
2. **INDUSTRY/INTENT MATCH (60 points max) - MOST IMPORTANT** ${
    isMaterialsSearch && !isSalesSearch
      ? `
   - Actual materials supplier/distributor/manufacturer = 60 points
   - Company with materials + services = 40 points
   - Pure service/contractor company = 15 points
   - Unrelated industry = 0 points`
      : isSalesSearch
        ? `
   - Company that directly USES/CONSUMES the product = 60 points
     (e.g., construction company for building materials)
   - Company that PURCHASES for projects/resale = 45 points
     (e.g., developers, contractors)
   - Company in related field that might need the product = 30 points
     (e.g., architecture firms for building materials)
   - Competitor (same type of seller) = 10 points
   - Completely unrelated industry = 0 points`
        : `
   - Industry exactly matches = 60 points
   - Related industry = 30 points
   - Unrelated industry = 0 points`
  }

${
  isMaterialsSearch && !isSalesSearch
    ? `## ⚠️ ABSOLUTE EXCLUSIONS - MUST SCORE BELOW 30:
These company types are NEVER building materials suppliers. Score them LOW regardless of other factors:

### PROFESSIONAL SERVICES (NOT MATERIALS) → MAX 25 points:
- Architecture firms / Architects → MAX 25 points (they DESIGN, not sell materials!)
- Engineering firms / Engineers → MAX 25 points (they DESIGN, not sell materials!)
- Landscape architects / Landscape design → MAX 25 points (design service)
- Interior design studios → MAX 25 points (design service)
- Lighting design studios → MAX 25 points (design service)
- Urban planning firms → MAX 25 points (planning service)
- Construction management (CM) → MAX 30 points (management service)

### OTHER EXCLUSIONS → MAX 20 points:
- Real Estate Agents/Brokers/Realtors → MAX 20 points (they sell HOUSES, not materials!)
- Real Estate Investment/Development → MAX 25 points (they BUY materials, not sell)
- Insurance companies → MAX 15 points
- Law firms → MAX 15 points
- Accounting/CPA firms → MAX 15 points
- Government agencies → MAX 10 points
- Associations/Trade groups → MAX 20 points
- Software/IT companies → MAX 15 points

### ⚠️ CRITICAL: "Architecture" and "Engineering" are NOT materials suppliers!
If industry contains "architect", "architecture", "engineering", "design studio", "landscape" → MAX 25 points!

## ⚠️ COMPLETELY UNRELATED PRODUCTS - SCORE 0-10 points:
These are NOT building/interior/remodeling materials. Score them NEAR ZERO:

### UNRELATED PRODUCT CATEGORIES → MAX 10 points:
- Cosmetics/Beauty/Skincare (화장품/개인용품) → 0-10 points
- Clothing/Apparel/Fashion/Textiles (의류/패션) → 0-10 points
- Hats/Caps/Embroidery (모자/자수) → 0-10 points  
- Jewelry/Accessories/Watches (보석/액세서리) → 0-10 points
- Food/Beverage/Restaurant (식품/음료) → 0-10 points
- Storage Services/Moving Supplies (보관/이사) → 0-10 points
- Gift Shops/Souvenirs (선물가게) → 0-10 points
- Pet Supplies (반려동물용품) → 0-10 points
- Toys/Games (완구) → 0-10 points
- Electronics/Software (전자제품/소프트웨어) → 0-10 points
- Personal Care Products (개인용품) → 0-10 points

### CRITICAL: Even if these have "wholesale" or "distributor" in their industry:
- "Hat wholesale" → 0-10 points (NOT building materials!)
- "Cosmetics distributor" → 0-10 points (NOT building materials!)
- "Jewelry supplier" → 0-10 points (NOT building materials!)
- "Storage services" → 0-10 points (NOT building materials!)
- "Moving supplies" → 0-10 points (NOT building materials!)

## ⚠️ SCORING EXAMPLES for "Building Materials" search:

### MATERIALS SUPPLIERS (80-100 points):
- "ABC Building Materials Supply" → 90-100 (has "materials" + "supply")
- "Hissong Ready Mix & Aggregates" → 85-95 (has "ready-mix" + "aggregates" = materials!)
- "County Line Stone Co" → 85-95 (has "stone" = materials supplier)
- "Phoenix Building Components" → 80-90 (has "building components")
- "Black Forest Wood Co" → 80-90 (has "wood" = lumber/materials)

### CONTRACTORS/SERVICE (20-40 points):
- "Texas Roof and Fence" → 25-35 (has "roofing" + "fencing" = contractor!)
- "Fireside Homes Inc" → 25-35 (has "home building" = contractor!)
- "Gehring Construction" → 30-40 (has "construction" without materials keywords)

### PROFESSIONAL SERVICES - NOT MATERIALS (15-25 points):
- "Deborah Berke & Partners Architects" → 20-25 (architecture firm = DESIGN service!)
- "Pei Cobb Freed & Partners" → 20-25 (architecture firm = DESIGN service!)
- "Harris Group Engineers" → 20-25 (engineering firm = DESIGN service!)
- "Robert Silman Associates" → 20-25 (structural engineering = DESIGN service!)
- "W Architecture & Landscape" → 20-25 (landscape architecture = DESIGN service!)
- "One Lux Studio" → 20-25 (lighting design = DESIGN service!)

### UNRELATED (0-20 points):
- "Walz Real Estate Group" → 15-20 (real estate agent)
- "Home Builders Association" → 10-20 (association)
- "Joel McKinnon Insurance" → 10-15 (insurance)
- "NeuroMentix AI" → 0-10 (software)

## ⚠️ CRITICAL KEYWORD RULES:

### → MATERIALS keywords = 80-100 points:
"aggregates", "ready-mix", "stone", "gravel", "lumber", "wood products", "building supplies", "wholesale", "distributor", "supplier"

### → DESIGN/SERVICE keywords = 15-30 points (NOT materials!):
"architect", "architecture", "engineering", "engineer", "design studio", "landscape", "lighting design", "interior design", "urban planning", "construction management"

### → CONTRACTOR keywords = 20-40 points:
"roofing contractor", "fencing", "home builder", "remodeling", "renovation"

### → EXCLUSION keywords = 0-20 points:
"Real Estate Agent", "Realtor", "Insurance", "Law Firm", "Association"`
    : isSalesSearch
      ? `## ⚠️ SCORING EXAMPLES for "${userQuery}":
- "Construction Company" in target country → 85-95 points (ideal BUYER)
- "Home Builder" in target country → 85-95 points (ideal BUYER)
- "Real Estate Developer" in target country → 75-85 points (needs materials)
- "Remodeling Contractor" in target country → 80-90 points (buys materials)
- "Architecture Firm" in target country → 70-80 points (specifies materials)
- "Building Materials Distributor" → 30-40 points (competitor, not buyer)
- "Landscaping Company" → 50-60 points (may need some materials)
- "Software Company" → 10-20 points (unrelated)`
      : `## ⚠️ CRITICAL SCORING RULES:
- If user searched for specific industry but lead doesn't match, score MUST be below 40!
- Only leads matching BOTH country AND industry criteria should score 70+

## ⚠️ ABSOLUTE EXCLUSIONS for materials/construction searches:
If searching for building/construction related companies, these types should score LOW:
- Real Estate Agents/Brokers/Realtors → MAX 25 points (they don't deal with materials)
- Insurance/Law/Accounting firms → MAX 20 points (professional services)
- Associations/Chambers → MAX 25 points (not direct suppliers)
- Software/IT companies → MAX 20 points (unrelated to materials)`
}

## Response Format (JSON array only, no markdown):
[
  {"leadId": "id1", "score": 85},
  {"leadId": "id2", "score": 62}
]

Important: Return ONLY the JSON array, no explanation or markdown.`

  const response = await llm.invoke(prompt)
  const responseText = (response.content as string).trim()

  try {
    // Attempt JSON parsing
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ leadId: string; score: number }>
      return parsed.map((item) => ({
        leadId: item.leadId,
        score: Math.min(100, Math.max(0, item.score)),
      }))
    }
  } catch (parseError) {
    leadDiscoveryLogger.error(`Failed to parse fit scores: ${parseError}`)
  }

  // Return default values if parsing fails
  return leads.map((lead) => ({
    leadId: lead.id,
    score: 50,
    reason: "Error during calculation",
  }))
}
