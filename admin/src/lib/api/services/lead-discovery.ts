import { API_BASE_URL } from "@/lib/api/client"

// BigQuery 검색 결과 타입
export type LeadResult = {
  email?: string
  first_name?: string
  last_name?: string
  company_name?: string
  phone?: string
  country?: string
  city?: string
  industry?: string
  sub_industry?: string
  web_address?: string
  employee?: string
  revenue?: string
}

// 추천 타입
export type BuyerRecommendation = {
  id: string
  country: string
  industry: string
  subIndustry?: string
  reasoning: string
  keywords?: string[]
  estimatedLeadCount?: number
}

// 웹사이트 분석 결과
export type WebsiteAnalysis = {
  companyName?: string
  products?: string[]
  services?: string[]
  targetMarkets?: string[]
  businessModel?: string
  summary?: string
}

// BigQuery 검색 요청 타입
export type BigQuerySearchRequest = {
  query: string
  dataDictionary: {
    tableName: string
    columns: string[]
    industries: string[]
    countries: string[]
    employeeRanges: string[]
    revenueRanges: string[]
  }
}

// BigQuery 검색 응답 타입
export type BigQuerySearchResponse = {
  success: boolean
  sql: string | null
  explanation: string
  results: LeadResult[]
  totalCount: number
  error?: string
}

// 데이터 딕셔너리 타입
type DatabaseType = "b2b_leads" | "crunchbase"

// 데이터 딕셔너리 (BigQuery 테이블 메타데이터)
// /bigquery-search 페이지의 DATA_DICTIONARIES와 동일
export const DATA_DICTIONARIES: Record<
  DatabaseType,
  {
    tableName: string
    columns: string[]
    industries: string[]
    countries: string[]
    employeeRanges: string[]
    revenueRanges: string[]
  }
> = {
  b2b_leads: {
    tableName: "sendgrinda-leads.leads.lead_csv_data*",
    columns: [
      "first_name",
      "middle_name",
      "last_name",
      "title",
      "company_name",
      "mailing_address",
      "primary_city",
      "primary_state",
      "zip_code",
      "country",
      "phone",
      "web_address",
      "email",
      "revenue",
      "employee",
      "industry",
      "sub_industry",
    ],
    industries: [
      "Business Services",
      "Manufacturing",
      "Retail",
      "Financial Services",
      "Healthcare",
      "Real Estate & Construction",
      "Computers & Electronics",
      "Software & Internet",
      "Education",
      "Media & Entertainment",
      "Consumer Services",
      "Travel, Recreation, and Leisure",
      "Telecommunications",
      "Non-Profit",
      "Transportation & Storage",
      "Other",
      "Energy & Utilities",
      "Wholesale & Distribution",
      "Government",
      "Agriculture & Mining",
      "Retail & Wholesale",
      "Services (Miscellaneous)",
      "Food & Beverage",
      "Travel & Accommodation",
      "Recreation & Leisure",
      "Conglomerates",
    ],
    countries: ["USA", "Canada"],
    employeeRanges: [
      "0 - 25",
      "25 - 100",
      "100 - 250",
      "250 - 1000",
      "1K - 10K",
      "10K - 50K",
      "50K - 100K",
      "> 100K",
    ],
    revenueRanges: [
      "$0 - $1M",
      "$0 - 1M",
      "$1 - $10M",
      "$1 - 10M",
      "$10 - $50M",
      "$10 - 50M",
      "$50 - $100M",
      "$50 - 100M",
      "$100 - $250M",
      "$100 - 250M",
      "$250 - $500M",
      "$250 - 500M",
      "$500M - $1B",
      "$500M - 1B",
      "> $1B",
    ],
  },
  crunchbase: {
    tableName: "sendgrinda-leads.leads.crunchbase_all",
    columns: [
      "first_name",
      "last_name",
      "title",
      "email",
      "company",
      "website",
      "country",
      "industry",
      "employees",
      "revenue",
      "phone",
      "description",
      "linkedin",
      "facebook",
      "twitter",
    ],
    industries: [
      "Software",
      "Information Technology",
      "Manufacturing",
      "Health Care",
      "Real Estate",
      "Education",
      "E-Commerce",
      "Consulting",
      "Financial Services",
      "Advertising",
      "Marketing",
      "Construction",
      "Internet",
      "Banking",
      "Finance",
      "Logistics",
      "Transportation",
      "Dental",
      "Medical",
      "Hospital",
      "Human Resources",
      "Recruiting",
      "Staffing Agency",
      "Property Management",
      "Accounting",
      "Freight Service",
      "Wholesale",
      "Mechanical Engineering",
      "Wellness",
    ],
    countries: [
      "Southern US",
      "Western US",
      "Northeastern US",
      "Midwestern US",
      "Great Lakes",
      "and Africa (EMEA)",
      "Asia-Pacific (APAC)",
      "Latin America",
      "Australasia",
      "Middle East and North Africa (MENA)",
      "Southeast Asia",
      "Middle East",
      "Central America",
      "Nordic Countries",
    ],
    employeeRanges: [
      "c_00001_00010",
      "c_00011_00050",
      "c_00051_00100",
      "c_00101_00250",
      "c_00251_00500",
      "c_00501_01000",
      "c_01001_05000",
      "c_05001_10000",
      "c_10001_max",
    ],
    revenueRanges: [],
  },
}

// 기본 데이터 딕셔너리 (B2B Leads)
export const DEFAULT_DATA_DICTIONARY = DATA_DICTIONARIES.b2b_leads

// API 응답 이벤트 타입들
export type LeadDiscoveryConnectedEvent = {
  sessionId: string
  timestamp: number
}

export type LeadDiscoveryInterruptEvent = {
  type: string
  payload?: {
    recommendations?: BuyerRecommendation[]
  }
  sessionId: string
}

export type LeadDiscoveryCompleteEvent = {
  sessionId: string
  success: boolean
  resultCount: number
  totalCount: number
  results: LeadResult[]
  sql?: string
  explanation?: string
  mode?: string
  recommendations?: BuyerRecommendation[]
  selectedRecommendation?: BuyerRecommendation
  websiteAnalysis?: WebsiteAnalysis
  error?: string
  duration: number
}

export type LeadDiscoveryErrorEvent = {
  sessionId: string
  error: string
  timestamp: number
}

// 콜백 타입
export type LeadDiscoveryCallbacks = {
  onConnected?: (data: LeadDiscoveryConnectedEvent) => void
  onInterrupt?: (data: LeadDiscoveryInterruptEvent) => void
  onComplete?: (data: LeadDiscoveryCompleteEvent) => void
  onError?: (error: string) => void
  onNodeProgress?: (nodeName: string, message: string, progress?: number) => void
}

// 두 DB 검색 결과를 합친 응답 타입
export type CombinedBigQuerySearchResponse = {
  success: boolean
  b2bLeads: {
    sql: string | null
    explanation: string
    results: LeadResult[]
    totalCount: number
  }
  crunchbase: {
    sql: string | null
    explanation: string
    results: LeadResult[]
    totalCount: number
  }
  combinedResults: LeadResult[]
  totalCount: number
  error?: string
}

export const leadDiscoveryApi = {
  /**
   * BigQuery 직접 검색 (단일 DB)
   */
  searchBigQuerySingle: async (
    query: string,
    dbType: "b2b_leads" | "crunchbase" = "b2b_leads",
  ): Promise<BigQuerySearchResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/bigquery/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          dataDictionary: DATA_DICTIONARIES[dbType],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `서버 오류 (${response.status})`)
      }

      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error("검색 중 알 수 없는 오류가 발생했습니다")
    }
  },

  /**
   * 쿼리에서 국가/지역 키워드를 감지하여 적합한 DB 판단
   */
  detectQueryTarget: (
    query: string,
  ): { searchB2B: boolean; searchCrunchbase: boolean; reason?: string } => {
    const lowerQuery = query.toLowerCase()

    // B2B Leads 전용 키워드 (USA, Canada만 지원)
    const b2bOnlyKeywords = ["캐나다", "canada", "canadian"]
    // Crunchbase 전용 키워드 (글로벌/지역 기반)
    const crunchbaseOnlyKeywords = [
      "유럽",
      "europe",
      "emea",
      "아시아",
      "asia",
      "apac",
      "중동",
      "middle east",
      "mena",
      "남미",
      "latin america",
      "호주",
      "australia",
      "australasia",
      "동남아",
      "southeast asia",
      "글로벌",
      "global",
      "worldwide",
    ]

    const isB2BOnly = b2bOnlyKeywords.some((kw) => lowerQuery.includes(kw))
    const isCrunchbaseOnly = crunchbaseOnlyKeywords.some((kw) => lowerQuery.includes(kw))

    if (isB2BOnly) {
      return {
        searchB2B: true,
        searchCrunchbase: false,
        reason: "캐나다는 B2B Leads에서만 검색 가능합니다.",
      }
    }

    if (isCrunchbaseOnly) {
      return {
        searchB2B: false,
        searchCrunchbase: true,
        reason: "해당 지역은 Crunchbase에서만 검색 가능합니다.",
      }
    }

    // 기본: 둘 다 검색
    return { searchB2B: true, searchCrunchbase: true }
  },

  /**
   * BigQuery 두 DB 모두 검색 (B2B Leads + Crunchbase, 총 200개)
   * 쿼리에 따라 적합한 DB만 선택적으로 검색
   */
  searchBigQuery: async (query: string): Promise<CombinedBigQuerySearchResponse> => {
    try {
      // 쿼리 분석하여 검색 대상 DB 결정
      const { searchB2B, searchCrunchbase, reason } = leadDiscoveryApi.detectQueryTarget(query)

      console.log("[Lead Discovery] DB 선택:", { searchB2B, searchCrunchbase, reason })

      // 선택된 DB만 검색
      const b2bPromise = searchB2B
        ? leadDiscoveryApi.searchBigQuerySingle(`${query} 100개`, "b2b_leads")
        : Promise.resolve({
            success: true,
            sql: null,
            explanation: reason || "이 쿼리에서는 B2B Leads를 검색하지 않았습니다.",
            results: [] as LeadResult[],
            totalCount: 0,
          })

      const crunchbasePromise = searchCrunchbase
        ? leadDiscoveryApi.searchBigQuerySingle(`${query} 100개`, "crunchbase")
        : Promise.resolve({
            success: true,
            sql: null,
            explanation: reason || "이 쿼리에서는 Crunchbase를 검색하지 않았습니다.",
            results: [] as LeadResult[],
            totalCount: 0,
          })

      const [b2bResult, crunchbaseResult] = await Promise.all([b2bPromise, crunchbasePromise])

      // Crunchbase 결과를 B2B Leads 형식으로 정규화
      const normalizedCrunchbaseResults: LeadResult[] = crunchbaseResult.results.map((lead) => ({
        ...lead,
        // Crunchbase 필드를 B2B Leads 필드로 매핑
        company_name: lead.company_name || ((lead as Record<string, unknown>).company as string),
        web_address: lead.web_address || ((lead as Record<string, unknown>).website as string),
        employee: lead.employee || ((lead as Record<string, unknown>).employees as string),
      }))

      // 두 결과 합치기 (B2B 먼저, 그 다음 Crunchbase)
      const combinedResults = [...b2bResult.results, ...normalizedCrunchbaseResults]

      return {
        success: b2bResult.success || crunchbaseResult.success,
        b2bLeads: {
          sql: b2bResult.sql,
          explanation: b2bResult.explanation,
          results: b2bResult.results,
          totalCount: b2bResult.totalCount,
        },
        crunchbase: {
          sql: crunchbaseResult.sql,
          explanation: crunchbaseResult.explanation,
          results: normalizedCrunchbaseResults,
          totalCount: crunchbaseResult.totalCount,
        },
        combinedResults,
        totalCount: b2bResult.totalCount + crunchbaseResult.totalCount,
        error:
          b2bResult.success || crunchbaseResult.success
            ? undefined
            : "두 DB 모두 검색에 실패했습니다",
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error("검색 중 알 수 없는 오류가 발생했습니다")
    }
  },

  /**
   * 웹사이트 URL 또는 자연어 쿼리로 리드 검색 (SSE 스트리밍)
   */
  search: async (
    request: {
      query: string
      workspaceId: string
      sessionId?: string
      locale?: string
    },
    callbacks: LeadDiscoveryCallbacks,
  ): Promise<void> => {
    const { query, workspaceId, sessionId, locale = "ko" } = request
    const { onConnected, onInterrupt, onComplete, onError, onNodeProgress } = callbacks

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/lead-discovery/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          workspaceId,
          sessionId,
          locale,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `서버 오류 (${response.status})`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("응답 스트림을 읽을 수 없습니다")
      }

      const decoder = new TextDecoder()
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split("\n\n")
          buffer = events.pop() || ""

          for (const eventStr of events) {
            if (!eventStr.trim() || eventStr.trim().startsWith(":")) {
              continue
            }

            const lines = eventStr.split("\n")
            let eventType: string | undefined
            let eventData: string | undefined

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim()
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6)
              }
            }

            if (eventData) {
              try {
                const data = JSON.parse(eventData)
                const type = data.type || eventType

                switch (type) {
                  case "connected":
                    onConnected?.(data)
                    break
                  case "interrupt":
                    onInterrupt?.(data)
                    break
                  case "complete":
                    onComplete?.(data)
                    break
                  case "error":
                    onError?.(data.error || "검색 중 오류가 발생했습니다")
                    break
                  case "node_start":
                  case "node_progress":
                    onNodeProgress?.(data.nodeName, data.message, data.progress)
                    break
                }
              } catch (parseError) {
                console.error("Failed to parse event:", parseError)
              }
            }
          }
        }
      } finally {
        try {
          reader.releaseLock()
        } catch {
          // Ignore release errors
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        onError?.(error.message)
      } else {
        onError?.("검색 중 알 수 없는 오류가 발생했습니다")
      }
    }
  },

  /**
   * 사용자 선택으로 검색 재개 (SSE 스트리밍)
   */
  select: async (
    request: {
      sessionId: string
      selectedRecommendationId: string
      workspaceId: string
    },
    callbacks: LeadDiscoveryCallbacks,
  ): Promise<void> => {
    const { sessionId, selectedRecommendationId, workspaceId } = request
    const { onConnected, onComplete, onError, onNodeProgress } = callbacks

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/lead-discovery/select`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          selectedRecommendationId,
          workspaceId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `서버 오류 (${response.status})`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("응답 스트림을 읽을 수 없습니다")
      }

      const decoder = new TextDecoder()
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split("\n\n")
          buffer = events.pop() || ""

          for (const eventStr of events) {
            if (!eventStr.trim() || eventStr.trim().startsWith(":")) {
              continue
            }

            const lines = eventStr.split("\n")
            let eventType: string | undefined
            let eventData: string | undefined

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim()
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6)
              }
            }

            if (eventData) {
              try {
                const data = JSON.parse(eventData)
                const type = data.type || eventType

                switch (type) {
                  case "connected":
                    onConnected?.(data)
                    break
                  case "complete":
                    onComplete?.(data)
                    break
                  case "error":
                    onError?.(data.error || "검색 중 오류가 발생했습니다")
                    break
                  case "node_start":
                  case "node_progress":
                    onNodeProgress?.(data.nodeName, data.message, data.progress)
                    break
                }
              } catch (parseError) {
                console.error("Failed to parse event:", parseError)
              }
            }
          }
        }
      } finally {
        try {
          reader.releaseLock()
        } catch {
          // Ignore release errors
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        onError?.(error.message)
      } else {
        onError?.("검색 중 알 수 없는 오류가 발생했습니다")
      }
    }
  },

  /**
   * 헬스 체크
   */
  healthCheck: async (): Promise<{ status: string; service: string; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/lead-discovery/health`)

    if (!response.ok) {
      throw new Error("Lead Discovery 서비스가 응답하지 않습니다")
    }

    return response.json()
  },
}
