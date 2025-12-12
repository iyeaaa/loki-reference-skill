/**
 * BigQuery Executor Node
 * Executes BigQuery search using the bigquery-search service
 * Analyzes random 50 results with GPT and streams analysis
 */

import { InvalidQueryError, searchBigQuery } from "../../bigquery-search.service"
import { leadDiscoveryLogger } from "../logger"
import type { BigQueryResult, LeadDiscoveryState } from "../state"

// Data Dictionaries for BigQuery tables
// B2B Leads 테이블 (BigQuery 실제 스키마 기준)
const B2B_LEADS_DATA_DICTIONARY = {
  tableName: "gen-lang-client-0140658679.test_lead_01.b2b_leads_all",
  columns: [
    "company",
    "website",
    "email",
    "all_emails",
    "phone",
    "industry",
    "sub_industry",
    "employees",
    "revenue",
    "city",
    "state",
    "zip",
    "country",
    "first_name",
    "last_name",
    "title",
    "address",
  ],
  // BigQuery 실제 industry 값 (count 순)
  industries: [
    "Business Services", // 330,623
    "Manufacturing", // 111,192
    "Real Estate & Construction", // 109,151
    "Retail", // 96,171
    "Healthcare", // 78,237
    "Financial Services", // 63,080
    "Other", // 51,883
    "Consumer Services", // 50,699
    "Computers & Electronics", // 44,545
    "Education", // 40,977
    "Non-Profit", // 39,752
    "Media & Entertainment", // 34,238
    "Software & Internet", // 34,231
    "Travel, Recreation, and Leisure", // 30,105
    "Government", // 28,198
    "Transportation & Storage", // 19,112
    "Agriculture & Mining", // 16,870
    "Energy & Utilities", // 15,763
    "Telecommunications", // 13,931
    "Wholesale & Distribution", // 12,506
    "Retail & Wholesale", // 1,017
    "Services (Miscellaneous)", // 673
    "Food & Beverage", // 315
    "Travel & Accommodation", // 209
    "Recreation & Leisure", // 102
    "Conglomerates", // 19
  ],
  // BigQuery 실제 sub_industry 값 (상위 50개, count 순)
  subIndustries: [
    "Business Services Other",
    "Retail Other",
    "Other",
    "Construction and Remodeling",
    "Consumer Services Other",
    "Manufacturing Other",
    "Advertising, Marketing and PR",
    "Legal Services",
    "Insurance and Risk Management",
    "Architecture,Engineering and Design",
    "Elementary and Secondary Schools",
    "Local Government",
    "Doctors and Health Care Practitioners",
    "Hospitals",
    "Software",
    "Healthcare, Pharmaceuticals, and Biotech Other",
    "Real Estate Agents and Appraisers",
    "Tools, Hardware and Light Machinery",
    "Restaurants and Bars",
    "Religious Organizations",
    "Management Consulting",
    "Real Estate & Construction Other",
    "HR and Recruiting Services",
    "Newspapers, Books and Periodicals",
    "Chemicals and Petrochemicals",
    "IT and Network Services and Support",
    "Computers & Electronics Other",
    "Media & Entertainment Other",
    "Banks",
    "Facilities Management and Maintenance",
    "Food & Dairy Product Manufacturing and Packaging",
    "Farming and Ranching",
    "Accounting and Tax Preparation",
    "Education Other",
    "Hotels, Motels and Lodging",
    "Construction Equipment and Supplies",
    "Financial Services Other",
    "Colleges and Universities",
    "Textiles, Apparel and Accessories",
    "Investment Banking and Venture Capital",
    "E-commerce and Internet Businesses",
    "Amusement Parks and Attractions",
    "Automobile Dealers",
    "Automobiles, Boats and Motor Vehicles",
    "Wholesale & Distribution Other",
    "Charitable Organizations and Foundations",
    "Metals Manufacturing",
    "Non-Profit Other",
    "Freight Hauling (Rail and Truck)",
    "Medical Supplies and Equipment",
  ],
  // BigQuery 실제 country 값
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
}

// Crunchbase 테이블 (BigQuery 실제 데이터 기준)
export const CRUNCHBASE_DATA_DICTIONARY = {
  tableName: "gen-lang-client-0140658679.test_lead_01.crunchbase_all",
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
  // Crunchbase industry는 복합 형태 (쉼표로 구분), LIKE 검색용 주요 키워드
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
    "Biotechnology",
    "Non Profit",
    "Food and Beverage",
    "Retail",
    "Insurance",
    "Legal",
    "Architecture",
    "Travel",
    "Tourism",
    "Automotive",
    "Energy",
    "Professional Services",
    "Telecommunications",
    "SaaS",
    "Cyber Security",
    "Machine Learning",
    "Artificial Intelligence (AI)",
  ],
  // Crunchbase는 region 기반 (country 컬럼에 저장됨, count 순)
  countries: [
    "and Africa (EMEA)", // 655,975
    "Southern US", // 259,411
    "Western US", // 243,326
    "Asia-Pacific (APAC)", // 192,957
    "Northeastern US", // 167,189
    "Midwestern US", // 138,186
    "Latin America", // 89,887
    "Australasia", // 63,613
    "Middle East and North Africa (MENA)", // 37,600
    "Southeast Asia", // 36,847
    "Great Lakes", // 31,215
    "Middle East", // 4,781
    "Central America", // 107
    "Nordic Countries", // 15
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
  revenueRanges: [], // Crunchbase에는 revenue 데이터 없음
}

// Apollo Leads 테이블 (고품질 데이터 291만개 - industry 자유형식 LIKE 검색)
const APOLLO_LEADS_DATA_DICTIONARY = {
  tableName: "gen-lang-client-0140658679.test_lead_01.apollo_leads_all",
  columns: ["company", "website", "industry", "employees", "country", "industry_category"],
  // Apollo industry는 자유형식 텍스트 (LIKE 검색용 주요 키워드, 빈도순 - 실제 데이터 분석 기반)
  industries: [
    // 핵심 비즈니스
    "services",
    "technology",
    "management",
    "information",
    "software",
    "marketing",
    "health",
    "development",
    "care",
    "design",
    "internet",
    "education",
    "computer",
    "media",
    "finance",
    "advertising",
    "consumer",
    "enterprise",
    "business",
    "consulting",
    "energy",
    "engineering",
    "construction",
    "real estate",
    "hospital",
    "training",
    "medical",
    "solutions",
    "mobile",
    "travel",
    "web",
    "insurance",
    "food",
    "industrial",
    "digital",
    "fitness",
    "wellness",
    "data",
    "security",
    "law",
    "retail",
    "manufacturing",
    "tourism",
    "leisure",
    "goods",
    "production",
    "commercial",
    "events",
    "research",
    "professional",
    "environmental",
    "financial",
    "online",
    "automotive",
    "oil",
    "logistics",
    "clean",
    "supply",
    "staffing",
    "mechanical",
    "non-profit",
    "entertainment",
    "banking",
    "building",
    "equipment",
    "cloud",
    "hospitality",
    "analytics",
    "government",
    "hardware",
    "architecture",
    "recruiting",
    "fashion",
    "products",
    "property",
    "telecommunications",
    "transportation",
    "video",
    "investment",
    "coaching",
    "human resources",
    "b2b",
    "accounting",
    "e-commerce",
    "ecommerce",
    "communications",
    "sports",
    "automation",
    "recruitment",
    "printing",
    "arts",
    "beverages",
    "apparel",
    "testing",
    "maintenance",
    "intelligence",
    "materials",
    "restaurants",
    "healthcare",
    "safety",
    "brand",
    "distribution",
    "facilities",
    "water",
    "gas",
    "publishing",
    "packaging",
    "electrical",
    "machinery",
    "furniture",
    "chemicals",
    "devices",
    "electronics",
    "mining",
    "pharmaceuticals",
    "metals",
    "steel",
    "plastics",
    "textiles",
    "cosmetics",
    "fabrication",
    "concrete",
    "seo",
    "games",
    "learning",
    "graphic",
    "aviation",
    "aerospace",
    "wholesale",
    "power",
    "hotels",
    "biotechnology",
    "saas",
    "computing",
    "networking",
    "crm",
    "erp",
    "android",
    "ios",
    "hosting",
    "credit",
    "loans",
    "equity",
    "mortgage",
    "venture",
    "trading",
    "payments",
    "lending",
    "wealth",
    "dental",
    "therapy",
    "treatment",
    "clinical",
    "surgery",
    "medicine",
    "shipping",
    "delivery",
    "freight",
    "warehousing",
    "transport",
    "marine",
    "solar",
    "utilities",
    "sustainability",
    "waste",
    "renewable",
    "cleantech",
    "beauty",
    "luxury",
    "accessories",
    "clothing",
    "jewelry",
    "wine",
    "film",
    "photography",
    "broadcast",
    "audio",
    "museums",
    "schools",
    "science",
    "legal",
    "compliance",
    "litigation",
    "audit",
    "civic",
    "defense",
    "emergency",
    "artificial intelligence",
    "machine learning",
    "cybersecurity",
    "blockchain",
    "fintech",
    "edtech",
    "healthtech",
    "proptech",
    "agtech",
    "martech",
    "iot",
    "virtual",
    "smart",
    "cleaning",
    "cleaning products",
    "janitorial",
    "sanitation",
    "hygiene",
    "eco-friendly",
    "sustainable",
    "green",
    "organic",
    "agriculture",
    "innovation",
    "optimization",
    "integration",
    "platform",
    "agency",
    "global",
    "international",
    "strategic",
    "advisory",
    "specialty",
    "premium",
    "quality",
  ],
  // industry_category 정형 데이터 (실제 값, 빈도순)
  industryCategories: [
    "Other",
    "Technology",
    "Healthcare",
    "Education",
    "Finance & Banking",
    "Professional Services",
    "Manufacturing",
    "Marketing & Advertising",
    "Construction",
    "Real Estate",
    "Retail & E-commerce",
    "Media & Entertainment",
    "Hospitality & Tourism",
    "Non-Profit",
    "Design & Creative",
    "Energy & Utilities",
    "Transportation & Logistics",
    "Business Services",
    "Government",
    "Food & Beverage",
    "Automotive",
    "HR & Recruiting",
    "Legal",
    "Fashion & Apparel",
    "Insurance",
    "Telecommunications",
    "Startups",
    "Sports & Fitness",
    "Publishing",
    "Research",
    "Events",
    "Security",
    "Sales",
    "Trade",
    "Furniture",
    "Digital",
    "Agriculture",
    "Facilities",
    "Museums & Culture",
    "Translation",
    "Customer Service",
  ],
  // 국가 (실제 데이터 빈도순)
  countries: [
    "United States",
    "United Kingdom",
    "Australia",
    "Canada",
    "Netherlands",
    "India",
    "Brazil",
    "Germany",
    "Spain",
    "France",
    "Italy",
    "Mexico",
    "South Africa",
    "Singapore",
    "Belgium",
    "Ireland",
    "Sweden",
    "Switzerland",
    "New Zealand",
    "Poland",
    "Japan",
    "United Arab Emirates",
    "Argentina",
    "Portugal",
    "Denmark",
    "Norway",
    "Austria",
    "Philippines",
    "Malaysia",
    "Indonesia",
  ],
  employeeRanges: [
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "501-1000",
    "1001-5000",
    "5001-10000",
    "10000+",
  ],
  revenueRanges: [], // Apollo 데이터에 revenue 없음
}

// Fresh Leads 테이블 (Apollo + Phone + Pitchbook 통합 데이터 24만개)
const FRESH_LEADS_DATA_DICTIONARY = {
  tableName: "gen-lang-client-0140658679.test_lead_01.fresh_leads",
  columns: ["company", "website", "industry", "employees", "country", "industry_category"],
  // industry는 자유형식 텍스트 (LIKE 검색용 주요 키워드 - 실제 데이터 분석 기반)
  industries: [
    // 음식/외식 (30,703+)
    "restaurants",
    "food & beverages",
    "food production",
    "catering",
    // 의료/헬스케어 (29,000+)
    "chiropractors",
    "health, wellness & fitness",
    "hospital & health care",
    "mental health care",
    "medical practice",
    "medical devices",
    "pharmaceuticals",
    "veterinary",
    // 자동차 (25,000+)
    "auto detailing",
    "auto wheel repair",
    "automotive",
    "transportation/trucking/railroad",
    // 금융/보험 (17,000+)
    "financial services",
    "insurance",
    "investment management",
    "banking",
    "investment banking",
    "venture capital & private equity",
    "accounting",
    // 전문 서비스 (18,000+)
    "staffing & recruiting",
    "marketing & advertising",
    "management consulting",
    "legal services",
    "law practice",
    "professional training & coaching",
    "human resources",
    "public relations & communications",
    // 기술/IT (15,000+)
    "information technology & services",
    "electronics",
    "computer & network security",
    "electrical/electronic manufacturing",
    "semiconductors",
    "e-learning",
    "online media",
    // 건설/부동산 (8,000+)
    "construction",
    "real estate",
    "architecture & planning",
    "building materials",
    "civil engineering",
    // 소매/도매 (10,000+)
    "retail",
    "wholesale",
    "consumer services",
    "apparel & fashion",
    "furniture",
    // 제조 (6,000+)
    "machinery",
    "mechanical or industrial engineering",
    "packaging & containers",
    // 에너지/환경 (5,000+)
    "oil & energy",
    "environmental services",
    "utilities",
    // 교육 (2,000+)
    "higher education",
    "education management",
    // 엔터테인먼트/미디어 (3,000+)
    "entertainment",
    "media production",
    "sports",
    "events services",
    // 물류/운송 (2,000+)
    "logistics & supply chain",
    "airlines/aviation",
    "aviation & aerospace",
    // 기타
    "nonprofit organization management",
    "research",
    "design",
    "coach",
    "hospitality",
    "leisure, travel & tourism",
    "security & investigations",
    "government administration",
    "biotechnology",
    "publishing",
    "defense & space",
    "printing",
    "facilities services",
    "individual & family services",
    "civic & social organization",
  ],
  // industry_category (표준화된 카테고리)
  industryCategories: [
    "Food & Beverage - Restaurant",
    "Healthcare - Chiropractic",
    "Finance - Insurance",
    "Automotive - Detailing",
    "Professional Services - HR",
    "Retail - General",
    "Professional Services - Marketing",
    "Automotive - Trucking",
    "Automotive - Repair",
    "Technology - Hardware",
    "Healthcare - Hospital",
    "Construction",
    "Healthcare - Wellness",
    "Healthcare - Other",
    "Healthcare - Mental Health",
    "Real Estate - Brokerage",
    "Professional Services - Consulting",
    "Finance - Investment",
    "Finance - Banking",
    "Nonprofit",
    "Food & Beverage - Cafe",
    "Manufacturing - General",
    "Entertainment - Events",
    "Legal Services",
    "Food & Beverage - General",
    "Finance - Accounting",
    "Technology - Cybersecurity",
    "Education - Higher Ed",
    "Energy - Oil & Gas",
    "Logistics & Transportation",
    "Beauty - Spa",
    "Education - Training",
    "Healthcare - Pharmacy",
    "Healthcare - Physical Therapy",
    "Retail - Wholesale",
    "Automotive - Dealership",
    "Food & Beverage - Bar",
    "Entertainment - Media",
    "Hospitality - Travel",
    "Technology - IT Services",
    "Healthcare - Veterinary",
    "Food & Beverage - Food Production",
    "Automotive - Parts",
    "Hospitality - Hotel",
    "Manufacturing - Packaging",
    "Agriculture",
    "Technology - Software",
  ],
  // 국가 (대부분 미국)
  countries: ["United States", "Canada", "United Kingdom", "Australia", "Brazil"],
  employeeRanges: [], // employees는 정수값
  revenueRanges: [], // revenue 데이터 없음
}

// Build natural language query from parameters
function buildNaturalLanguageQuery(params: {
  query: string
  country?: string
  industry?: string
  subIndustry?: string
  employeeRange?: string
  revenueRange?: string
  limit?: number
}): string {
  const parts: string[] = []

  // Start with base query or build from parameters
  if (
    params.query &&
    !params.query.includes(params.country || "") &&
    !params.query.includes(params.industry || "")
  ) {
    // User's raw query - let BigQuery service handle it
    return params.query
  }

  // Build structured query
  if (params.country) {
    parts.push(params.country)
  }

  if (params.industry) {
    parts.push(params.industry)
  }

  // NOTE: subIndustry는 Data Dictionary에 없는 값일 수 있으므로
  // 자연어 쿼리에 포함하지 않음 (LLM이 잘못된 LIKE 조건을 생성하는 문제 방지)
  // subIndustry는 UI 표시용으로만 사용

  // Add company type
  parts.push("회사")

  if (params.employeeRange) {
    parts.push(`직원 수 ${params.employeeRange}`)
  }

  if (params.revenueRange) {
    parts.push(`매출 ${params.revenueRange}`)
  }

  // Add limit
  const limit = params.limit || 100
  parts.push(`${limit}개`)

  return parts.join(" ")
}

// Transform Apollo results to our format
function transformApolloResults(results: Record<string, unknown>[]): BigQueryResult[] {
  return results.map((row) => ({
    companyName: row.company as string | undefined,
    webAddress: row.website as string | undefined,
    description: undefined, // Apollo에는 description 없음
    fitScore: undefined, // 추후 계산 가능
    country: row.country as string | undefined,
    category: row.industry_category as string | undefined,
    mainIndustry: row.industry as string | undefined,
    subIndustry: "-", // Apollo에는 sub_industry 없음
    email: undefined, // Apollo에는 email 없음
    employee: row.employees?.toString() || undefined,
  }))
}

// Transform BigQuery results to our format (B2B Leads + Crunchbase 통합 지원)
// 컬럼 순서: 회사명, 웹사이트, Description, Fit Score, Country, Category, Main Industry, Sub Industry, Company Email
function transformResults(
  results: Record<string, unknown>[],
  isCrunchbase: boolean,
): BigQueryResult[] {
  return results.map((row) => {
    if (isCrunchbase) {
      // Crunchbase 테이블 컬럼 매핑
      return {
        companyName: row.company as string | undefined,
        webAddress: row.website as string | undefined,
        description: row.description as string | undefined,
        fitScore: undefined, // 추후 계산 가능
        country: row.country as string | undefined,
        category: undefined, // Crunchbase에는 category 없음
        mainIndustry: row.industry as string | undefined,
        subIndustry: "-", // Crunchbase에는 sub_industry 없음
        email: row.email as string | undefined,
        phone: row.phone as string | undefined,
        employee: row.employees as string | undefined,
        revenue: row.revenue as string | undefined,
      }
    }
    // B2B Leads 테이블 컬럼 매핑
    return {
      companyName: row.company as string | undefined,
      webAddress: row.website as string | undefined,
      description: undefined, // B2B에는 description 없음
      fitScore: undefined, // 추후 계산 가능
      country: row.country as string | undefined,
      category: undefined, // B2B에는 category 없음
      mainIndustry: row.industry as string | undefined,
      subIndustry: (row.sub_industry as string) || "-",
      email: row.email as string | undefined,
      phone: row.phone as string | undefined,
      employee: row.employees as string | undefined,
      revenue: row.revenue as string | undefined,
    }
  })
}

export async function executeBigQuery(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  const params = state.bigQueryParams

  if (!params) {
    leadDiscoveryLogger.nodeError("executeBigQuery", "No search parameters provided", 0)
    return {
      error: "검색 조건이 없어요",
    }
  }

  // 상세 로그: 검색 시작
  leadDiscoveryLogger.info(`[리드 검색] 시작`)
  leadDiscoveryLogger.info(`  - 국가: ${params.country || "전체"}`)
  leadDiscoveryLogger.info(`  - 산업: ${params.industry || "전체"}`)
  leadDiscoveryLogger.info(`  - 쿼리: ${params.query}`)
  leadDiscoveryLogger.nodeStart("executeBigQuery", {
    query: params.query,
    country: params.country,
    industry: params.industry,
  })

  if (emitter) {
    const targetInfo =
      params.country && params.industry ? `${params.country} ${params.industry}` : "전 세계"
    emitter.nodeStart("executeBigQuery", `${targetInfo} 바이어를 검색하고 있어요`)
  }

  try {
    // Build the natural language query
    const nlQuery = buildNaturalLanguageQuery(params)

    leadDiscoveryLogger.info(`[리드 검색] 자연어 쿼리: "${nlQuery}"`)
    leadDiscoveryLogger.info(
      `[리드 검색] 세 테이블(b2b_leads_all, crunchbase_all, apollo_leads_all) 모두 검색`,
    )
    leadDiscoveryLogger.bigQueryExecutionStart(nlQuery)

    if (emitter) {
      emitter.progress("executeBigQuery", "세 테이블에서 검색 중...", 20)
    }

    // 네 테이블 병렬 검색
    leadDiscoveryLogger.info(`[리드 검색] BigQuery 실행 중 (네 테이블 병렬)...`)

    const [b2bResult, crunchbaseResult, apolloResult, freshResult] = await Promise.allSettled([
      searchBigQuery(nlQuery, B2B_LEADS_DATA_DICTIONARY),
      searchBigQuery(nlQuery, CRUNCHBASE_DATA_DICTIONARY),
      searchBigQuery(nlQuery, APOLLO_LEADS_DATA_DICTIONARY),
      searchBigQuery(nlQuery, FRESH_LEADS_DATA_DICTIONARY),
    ])

    // B2B Leads 결과 처리
    let b2bTransformed: ReturnType<typeof transformResults> = []
    let b2bTotal = 0
    let b2bSql = ""
    if (b2bResult.status === "fulfilled") {
      b2bTransformed = transformResults(b2bResult.value.results, false)
      b2bTotal = b2bResult.value.totalCount
      b2bSql = b2bResult.value.sql
      leadDiscoveryLogger.info(`[리드 검색] b2b_leads_all: ${b2bTotal.toLocaleString()}개`)
    } else {
      leadDiscoveryLogger.warn(`[리드 검색] b2b_leads_all 검색 실패: ${b2bResult.reason}`)
    }

    // Crunchbase 결과 처리
    let crunchbaseTransformed: ReturnType<typeof transformResults> = []
    let crunchbaseTotal = 0
    let crunchbaseSql = ""
    if (crunchbaseResult.status === "fulfilled") {
      crunchbaseTransformed = transformResults(crunchbaseResult.value.results, true)
      crunchbaseTotal = crunchbaseResult.value.totalCount
      crunchbaseSql = crunchbaseResult.value.sql
      leadDiscoveryLogger.info(`[리드 검색] crunchbase_all: ${crunchbaseTotal.toLocaleString()}개`)
    } else {
      leadDiscoveryLogger.warn(`[리드 검색] crunchbase_all 검색 실패: ${crunchbaseResult.reason}`)
    }

    // Apollo Leads 결과 처리
    let apolloTransformed: ReturnType<typeof transformResults> = []
    let apolloTotal = 0
    let apolloSql = ""
    leadDiscoveryLogger.info(`[Apollo] status: ${apolloResult.status}`)
    if (apolloResult.status === "fulfilled") {
      apolloTransformed = transformApolloResults(apolloResult.value.results)
      apolloTotal = apolloResult.value.totalCount
      apolloSql = apolloResult.value.sql
      leadDiscoveryLogger.info(`[리드 검색] apollo_leads_all: ${apolloTotal.toLocaleString()}개`)
      leadDiscoveryLogger.info(`[Apollo SQL] ${apolloSql}`)
    } else {
      const reason =
        apolloResult.reason instanceof Error
          ? apolloResult.reason.message
          : String(apolloResult.reason)
      leadDiscoveryLogger.error(`[리드 검색] apollo_leads_all 검색 실패: ${reason}`)
    }

    // Fresh Leads 결과 처리
    let freshTransformed: ReturnType<typeof transformApolloResults> = []
    let freshTotal = 0
    let freshSql = ""
    leadDiscoveryLogger.info(`[Fresh] status: ${freshResult.status}`)
    if (freshResult.status === "fulfilled") {
      freshTransformed = transformApolloResults(freshResult.value.results) // Apollo와 같은 구조
      freshTotal = freshResult.value.totalCount
      freshSql = freshResult.value.sql
      leadDiscoveryLogger.info(`[리드 검색] fresh_leads: ${freshTotal.toLocaleString()}개`)
      leadDiscoveryLogger.info(`[Fresh SQL] ${freshSql}`)
    } else {
      const reason =
        freshResult.reason instanceof Error
          ? freshResult.reason.message
          : String(freshResult.reason)
      leadDiscoveryLogger.error(`[리드 검색] fresh_leads 검색 실패: ${reason}`)
    }

    // 각 테이블 결과 수 로그
    leadDiscoveryLogger.info(
      `[셔플 전] B2B: ${b2bTransformed.length}, Crunchbase: ${crunchbaseTransformed.length}, Apollo: ${apolloTransformed.length}, Fresh: ${freshTransformed.length}`,
    )

    // 결과 합치기 + Fisher-Yates 완전 셔플
    const allResults = [
      ...b2bTransformed,
      ...crunchbaseTransformed,
      ...apolloTransformed,
      ...freshTransformed,
    ]

    // Fisher-Yates 셔플 (완전 랜덤)
    const combinedResults = [...allResults]
    for (let i = combinedResults.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const itemI = combinedResults[i]
      const itemJ = combinedResults[j]
      if (itemI && itemJ) {
        combinedResults[i] = itemJ
        combinedResults[j] = itemI
      }
    }

    // 셔플 후 100개로 제한
    const limitedResults = combinedResults.slice(0, 100)
    const first5 = limitedResults.slice(0, 5).map((r) => r.companyName || "unknown")
    leadDiscoveryLogger.info(`[셔플 후] 첫 5개: ${first5.join(", ")}`)
    const totalCount = b2bTotal + crunchbaseTotal + apolloTotal + freshTotal
    const combinedSql = `-- B2B Leads:\n${b2bSql}\n\n-- Crunchbase:\n${crunchbaseSql}\n\n-- Apollo:\n${apolloSql}\n\n-- Fresh:\n${freshSql}`

    const duration = Date.now() - startTime

    // 상세 로그: 검색 결과
    leadDiscoveryLogger.info(`[리드 검색] 검색 완료:`)
    leadDiscoveryLogger.info(`  - B2B Leads: ${b2bTotal.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - Crunchbase: ${crunchbaseTotal.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - Apollo: ${apolloTotal.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - Fresh: ${freshTotal.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - 총 결과: ${totalCount.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - 반환 결과: ${limitedResults.length}개 (랜덤 셔플, 100개 제한)`)
    leadDiscoveryLogger.info(`  - 소요시간: ${(duration / 1000).toFixed(1)}초`)
    leadDiscoveryLogger.bigQueryExecutionComplete(duration, limitedResults.length, totalCount)

    if (emitter) {
      emitter.progress("executeBigQuery", `${totalCount.toLocaleString()}개 리드를 찾았어요`, 80)
    }

    // 고객군 분석 없이 바로 결과 반환
    if (emitter) {
      emitter.nodeComplete("executeBigQuery", `${totalCount.toLocaleString()}개 리드 검색 완료`, {
        resultCount: limitedResults.length,
        totalCount: totalCount,
        b2bCount: b2bTotal,
        crunchbaseCount: crunchbaseTotal,
        apolloCount: apolloTotal,
        freshCount: freshTotal,
      })
    }

    leadDiscoveryLogger.nodeSuccess("executeBigQuery", duration, {
      resultCount: limitedResults.length,
      totalCount: totalCount,
      b2bCount: b2bTotal,
      crunchbaseCount: crunchbaseTotal,
      apolloCount: apolloTotal,
      freshCount: freshTotal,
    })

    return {
      searchResults: limitedResults,
      totalResultCount: totalCount,
      bigQuerySQL: combinedSql,
      bigQueryExplanation: `B2B: ${b2bTotal}개, Crunchbase: ${crunchbaseTotal}개, Apollo: ${apolloTotal}개, Fresh: ${freshTotal}개`,
      executionTime: duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime

    if (error instanceof InvalidQueryError) {
      leadDiscoveryLogger.warn(`[리드 검색] 잘못된 쿼리: ${error.message}`)

      if (emitter) {
        emitter.nodeComplete("executeBigQuery", "검색 조건을 다시 확인해주세요", {
          isInvalidQuery: true,
          message: error.message,
        })
      }

      return {
        error: error.message,
        searchResults: [],
        totalResultCount: 0,
        executionTime: duration,
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    leadDiscoveryLogger.error(`[리드 검색] 오류 발생: ${errorMessage}`)
    leadDiscoveryLogger.bigQueryExecutionError(errorMessage)
    leadDiscoveryLogger.nodeError("executeBigQuery", errorMessage, duration)

    if (emitter) {
      emitter.error("executeBigQuery", `검색 중 문제가 발생했어요: ${errorMessage}`)
    }

    return {
      error: `검색에 실패했어요: ${errorMessage}`,
      searchResults: [],
      totalResultCount: 0,
      executionTime: duration,
    }
  }
}
