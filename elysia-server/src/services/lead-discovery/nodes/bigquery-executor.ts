/**
 * BigQuery Executor Node
 * Executes BigQuery search using the bigquery-search service
 * Now includes Perplexity API for real-time web search
 */

import { InvalidQueryError, searchBigQuery } from "../../bigquery-search.service"
import {
  convertPerplexityToBigQueryFormat,
  optimizeQueryForPerplexity,
  searchLeadsWithPerplexity,
} from "../../perplexity-search.service"
import { createErrorContext } from "../error-classifier"
import { leadDiscoveryLogger } from "../logger"
import type { BigQueryResult, LeadDiscoveryState } from "../state"

// 세션별 전체 결과 캐시 (더 가져오기 기능용)
const sessionResultsCache = new Map<string, BigQueryResult[]>()

// 캐시 정리 (10분 후 자동 삭제)
function cacheResults(sessionId: string, results: BigQueryResult[]) {
  sessionResultsCache.set(sessionId, results)
  setTimeout(
    () => {
      sessionResultsCache.delete(sessionId)
      leadDiscoveryLogger.info(`[캐시] 세션 ${sessionId} 결과 캐시 삭제됨`)
    },
    10 * 60 * 1000,
  ) // 10분
}

// 캐시에서 추가 결과 가져오기
export function getMoreResults(
  sessionId: string,
  offset: number,
  limit: number = 100,
): { results: BigQueryResult[]; hasMore: boolean; totalAvailable: number } | null {
  const cachedResults = sessionResultsCache.get(sessionId)
  if (!cachedResults) {
    return null
  }

  const results = cachedResults.slice(offset, offset + limit)
  const hasMore = offset + limit < cachedResults.length
  return {
    results,
    hasMore,
    totalAvailable: cachedResults.length,
  }
}

// Data Dictionaries for BigQuery tables
// B2B Leads 테이블 (BigQuery 실제 스키마 기준)
const B2B_LEADS_DATA_DICTIONARY = {
  tableName: "sendgrinda-leads.leads.b2b_leads_clean",
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

// Apollo Leads 테이블 (고품질 데이터 291만개 - industry 자유형식 LIKE 검색)
// Exported for use in background services (e.g., auto-generation during signup)
export const APOLLO_LEADS_DATA_DICTIONARY = {
  tableName: "sendgrinda-leads.leads.apollo_leads_clean",
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
  tableName: "sendgrinda-leads.leads.fresh_leads_clean",
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

// Revation Leads 테이블 (큐레이션된 프리미엄 리드)
const REVATION_LEADS_DATA_DICTIONARY = {
  tableName: "sendgrinda-leads.leads.revation_leads",
  columns: [
    "company",
    "website",
    "email",
    "description",
    "industry",
    "business_type",
    "country",
    "city",
    "employee_count",
    "products",
  ],
  // industry 값 (실제 데이터 기반)
  industries: [
    // 리테일/이커머스
    "Retail",
    "E-commerce",
    "Retail, E-commerce",
    // 펫
    "Pet retail",
    "Pet Retail",
    "Pet Supplies",
    "Pet Food",
    "Pet Services",
    // 홈/리빙/인테리어
    "Home & Living",
    "Home décor",
    "Home Goods",
    "Furniture",
    "Furniture Retail",
    "Interior & Home Decor",
    "Lifestyle",
    "Lifestyle Goods",
    // 패션/뷰티
    "Fashion",
    "Beauty",
    "Beauty retail",
    "Luxury Retail",
    // 식품/음료
    "Food & Beverage",
    "Food & Snacks",
    // 기타 리테일
    "Gifts",
    "Gifts retail",
    "Stationery retail",
    "Department Store",
    "Marketplace",
    // 디자인/미디어
    "Design",
    "Design Goods",
    "Media",
    "Publishing",
    // 유통/도매
    "Distribution",
    "Wholesale",
    "Wholesale Distribution",
    // 서비스
    "Trade Shows & Events",
    "Corporate Gifting",
    "Spa Services",
    "Wellness",
  ],
  // business_type 값
  businessTypes: [
    "소매업체",
    "온라인 플랫폼",
    "유통업체",
    "도매업체",
    "수입업체",
    "브랜드 소유자",
    "마케팅업체",
    "백화점",
    "드러그스토어",
  ],
  // 국가 값
  countries: [
    "캐나다",
    "미국",
    "일본",
    "프랑스",
    "네덜란드",
    "영국",
    "벨기에",
    "덴마크",
    "Canada",
    "United States",
    "Japan",
    "France",
    "Netherlands",
    "United Kingdom",
    "Belgium",
    "Denmark",
  ],
  employeeRanges: [
    "1-10",
    "2-10",
    "5-20",
    "10-20",
    "10-50",
    "20-50",
    "50-100",
    "100-200",
    "100-500",
    "500-1000",
    "1000-5000",
    "5000-10000",
  ],
  revenueRanges: [],
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

// 지역(Region) 값 - 특정 국가 검색 시 제외해야 함
const REGION_VALUES = [
  "asia-pacific",
  "apac",
  "asia pacific",
  "southeast asia",
  "asean",
  "europe",
  "emea",
  "middle east",
  "latin america",
  "latam",
  "north america",
  "africa",
  "oceania",
]

// 국가 키워드 매핑 (한국어 → 영어)
// isSpecificCountry: true면 특정 국가 검색 (Region 결과 제외)
const COUNTRY_KEYWORD_MAP: Record<string, { keywords: string[]; isSpecificCountry: boolean }> = {
  한국: { keywords: ["korea", "south korea"], isSpecificCountry: true },
  미국: { keywords: ["usa", "united states", "america"], isSpecificCountry: true },
  중국: { keywords: ["china"], isSpecificCountry: true },
  일본: { keywords: ["japan"], isSpecificCountry: true },
  인도: { keywords: ["india"], isSpecificCountry: true },
  인도네시아: { keywords: ["indonesia"], isSpecificCountry: true },
  베트남: { keywords: ["vietnam"], isSpecificCountry: true },
  태국: { keywords: ["thailand"], isSpecificCountry: true },
  말레이시아: { keywords: ["malaysia"], isSpecificCountry: true },
  싱가포르: { keywords: ["singapore"], isSpecificCountry: true },
  필리핀: { keywords: ["philippines"], isSpecificCountry: true },
  호주: { keywords: ["australia"], isSpecificCountry: true },
  캐나다: { keywords: ["canada"], isSpecificCountry: true },
  영국: { keywords: ["uk", "united kingdom", "britain"], isSpecificCountry: true },
  독일: { keywords: ["germany"], isSpecificCountry: true },
  프랑스: { keywords: ["france"], isSpecificCountry: true },
  이탈리아: { keywords: ["italy"], isSpecificCountry: true },
  스페인: { keywords: ["spain"], isSpecificCountry: true },
  네덜란드: { keywords: ["netherlands"], isSpecificCountry: true },
  브라질: { keywords: ["brazil"], isSpecificCountry: true },
  멕시코: { keywords: ["mexico"], isSpecificCountry: true },
  러시아: { keywords: ["russia"], isSpecificCountry: true },
  터키: { keywords: ["turkey"], isSpecificCountry: true },
  사우디: { keywords: ["saudi", "saudi arabia"], isSpecificCountry: true },
  uae: { keywords: ["uae", "united arab emirates", "dubai"], isSpecificCountry: true },
  이집트: { keywords: ["egypt"], isSpecificCountry: true },
  남아공: { keywords: ["south africa"], isSpecificCountry: true },
  나이지리아: { keywords: ["nigeria"], isSpecificCountry: true },
  // 지역 검색 (Region 결과 포함)
  아시아: { keywords: ["asia", "asia-pacific", "apac"], isSpecificCountry: false },
  유럽: { keywords: ["europe", "european", "eu"], isSpecificCountry: false },
  동남아: { keywords: ["southeast asia", "asean"], isSpecificCountry: false },
}

// 검색 쿼리에서 산업 키워드 추출
const INDUSTRY_KEYWORD_MAP: Record<string, string[]> = {
  // 한국어 → 영어 키워드 매핑
  포장재: ["packaging", "package", "container"],
  유통: ["wholesale", "distribution", "retail", "distributor"],
  뷰티: ["beauty", "cosmetics", "cosmetic", "skincare", "makeup"],
  화장품: ["cosmetics", "cosmetic", "beauty", "skincare"],
  IT: ["software", "technology", "tech", "it", "computer"],
  소프트웨어: ["software", "saas", "tech"],
  헬스케어: ["health", "healthcare", "medical", "hospital"],
  의료: ["medical", "health", "hospital", "clinic"],
  제조: ["manufacturing", "manufacturer", "production"],
  금융: ["financial", "finance", "banking", "bank"],
  부동산: ["real estate", "property", "realty"],
  교육: ["education", "training", "school", "academy"],
  물류: ["logistics", "freight", "shipping", "transport"],
  운송: ["transportation", "transport", "shipping", "freight"],
  식품: ["food", "beverage", "f&b"],
  건설: ["construction", "building", "contractor"],
  에너지: ["energy", "power", "utility"],
  자동차: ["automotive", "auto", "vehicle", "car"],
  농업: ["agriculture", "farming", "agricultural"],
  컨설팅: ["consulting", "consultant", "advisory"],
  광고: ["advertising", "marketing", "agency"],
  마케팅: ["marketing", "advertising", "digital"],
  보험: ["insurance"],
  청소: ["cleaning", "janitorial", "sanitation"],
  // 영어 키워드 직접 매핑
  packaging: ["packaging", "package", "container"],
  wholesale: ["wholesale", "distribution", "distributor"],
  beauty: ["beauty", "cosmetics", "skincare"],
  software: ["software", "saas", "tech"],
  healthcare: ["health", "healthcare", "medical"],
  manufacturing: ["manufacturing", "manufacturer"],
  // 🔥 Interior materials 관련 키워드 (핵심!)
  "interior materials": [
    "flooring",
    "tile",
    "stone",
    "marble",
    "granite",
    "cabinet",
    "carpet",
    "hardwood",
    "millwork",
    "drywall",
    "building materials",
  ],
  interior: ["flooring", "tile", "cabinet", "carpet", "hardwood", "millwork", "interior"],
  flooring: ["flooring", "hardwood", "laminate", "vinyl", "carpet", "tile"],
  tile: ["tile", "ceramic", "porcelain", "stone", "marble", "granite"],
  cabinet: ["cabinet", "cabinetry", "millwork", "kitchen cabinet"],
  "building materials": [
    "building materials",
    "construction materials",
    "lumber",
    "drywall",
    "insulation",
    "roofing",
  ],
  distributor: ["distributor", "wholesale", "supplier", "distribution"],
}

// 쿼리에서 국가 키워드 추출 (특정 국가 검색 여부도 반환)
function extractCountryKeywords(query: string): { keywords: string[]; isSpecificCountry: boolean } {
  const lowerQuery = query.toLowerCase()
  const keywords: string[] = []
  let isSpecificCountry = false

  for (const [term, config] of Object.entries(COUNTRY_KEYWORD_MAP)) {
    if (lowerQuery.includes(term.toLowerCase())) {
      keywords.push(...config.keywords)
      if (config.isSpecificCountry) {
        isSpecificCountry = true
      }
    }
  }

  return { keywords: [...new Set(keywords)], isSpecificCountry }
}

// 쿼리에서 산업 키워드 추출
function extractIndustryKeywords(query: string): string[] {
  const lowerQuery = query.toLowerCase()
  const keywords: string[] = []

  for (const [term, englishKeywords] of Object.entries(INDUSTRY_KEYWORD_MAP)) {
    if (lowerQuery.includes(term.toLowerCase())) {
      keywords.push(...englishKeywords)
    }
  }

  return [...new Set(keywords)]
}

// 국가 매칭 점수 계산 (정확 매칭 우선, 특정 국가 검색 시 Region 제외)
function calculateCountryMatchScore(
  lead: BigQueryResult,
  countryKeywords: string[],
  isSpecificCountry: boolean,
): number {
  if (countryKeywords.length === 0) return 0

  const country = (lead.country || "").toLowerCase()

  // 특정 국가 검색인데 country가 Region 값이면 제외 (점수 0)
  if (isSpecificCountry) {
    const isRegion = REGION_VALUES.some((region) => country.includes(region.toLowerCase()))
    if (isRegion) {
      return -10 // 특정 국가 검색에서 Region은 오히려 감점
    }
  }

  for (const keyword of countryKeywords) {
    const kw = keyword.toLowerCase()
    // 정확히 국가명이 포함되면 높은 점수
    if (country.includes(kw)) return 20
    // 'korea'를 검색했는데 'south korea'가 있으면 매칭
    if (kw === "korea" && country.includes("korea")) return 20
  }

  return 0
}

// 🔥 최우선 키워드 (building materials + interior materials 핵심) → +100점
const TOP_PRIORITY_KEYWORDS = [
  // Building materials
  "building materials",
  "building material",
  "construction materials",
  "construction material",
  "building supplies",
  "building supply",
  // Interior materials 핵심
  "interior materials",
  "interior material",
  "flooring materials",
  "flooring distributor",
  "tile distributor",
  "cabinet distributor",
  "wall covering",
  "millwork",
]

// ⭐ 높은 우선순위 키워드 (인테리어 자재 - 바닥재/타일/캐비닛) → +80점
const HIGH_PRIORITY_KEYWORDS = [
  // 바닥재
  "flooring",
  "hardwood",
  "laminate flooring",
  "vinyl flooring",
  "carpet",
  "carpet distributor",
  // 타일/석재
  "tile",
  "stone",
  "marble",
  "granite",
  "ceramic",
  "porcelain",
  "natural stone",
  // 캐비닛/목공
  "cabinet",
  "cabinetry",
  "millwork",
  "molding",
  "moulding",
  "trim",
  // 벽재
  "drywall",
  "paneling",
  "wallpaper",
  // 기타 건축자재
  "lumber",
  "insulation",
  "roofing materials",
]

// 중간 우선순위 (일반 도매/유통) → +50점
const MEDIUM_PRIORITY_KEYWORDS = [
  "wholesale",
  "distributor",
  "supplier",
  "distribution",
  "materials",
  "supplies",
  "aggregate",
  "aggregates",
  "ready-mix",
  "hardware",
]

// 낮은 우선순위 (배관/HVAC - interior materials와 간접 관련) → +15점
const LOW_PRIORITY_KEYWORDS = [
  "plumbing",
  "pipe",
  "fittings",
  "hvac",
  "irrigation",
  "water heater",
  "bathroom fixtures",
  "kitchen fixtures",
  "faucet",
  "sink",
  "shower",
  "vanity",
]

// 설계/서비스 키워드 (감점)
const DESIGN_SERVICE_KEYWORDS = [
  "architect",
  "architecture",
  "engineering",
  "engineer",
  "design",
  "landscape",
  "interior design",
  "lighting",
  "planning",
  "consulting",
  "management",
]

// 자재 도매 검색 시 무관한 제품 키워드 (강한 감점 -100점)
const UNRELATED_PRODUCT_KEYWORDS = [
  // 화장품/개인용품
  "cosmetic",
  "beauty",
  "skincare",
  "personal care",
  "deodorant",
  "fragrance",
  "makeup",
  // 의류/패션
  "clothing",
  "apparel",
  "fashion",
  "textile",
  "embroidery",
  "hat",
  "hats",
  "cap",
  "caps",
  "snapback",
  // 보석/액세서리
  "jewelry",
  "jewellery",
  "accessori",
  "bead",
  "watch",
  // 식품/음료
  "food",
  "beverage",
  "restaurant",
  "catering",
  "grocery",
  // 기타 무관
  "storage services",
  "moving supplies",
  "self storage",
  "gift shop",
  "pet supplies",
  "toys",
  "sporting goods",
  "electronics",
  "software",
  "it services",
]

// 리드의 산업과 검색 키워드 매칭 점수 계산
function calculateIndustryMatchScore(lead: BigQueryResult, searchKeywords: string[]): number {
  if (searchKeywords.length === 0) return 0

  const industry = (lead.mainIndustry || "").toLowerCase()
  const category = (lead.category || "").toLowerCase()
  const subIndustry = (lead.subIndustry || "").toLowerCase()
  const companyName = (lead.companyName || "").toLowerCase()
  const combinedText = `${industry} ${category} ${subIndustry} ${companyName}`

  let score = 0

  // 0. 무관한 제품 키워드 체크 (최우선 - 강한 감점 -100점)
  const hasUnrelatedProduct = UNRELATED_PRODUCT_KEYWORDS.some((kw) => combinedText.includes(kw))
  if (hasUnrelatedProduct) {
    // 자재 도매 검색에서 완전히 무관한 제품은 최하위로
    return -100
  }

  // 1. 기본 키워드 매칭
  for (const keyword of searchKeywords) {
    const kw = keyword.toLowerCase()
    if (industry.includes(kw)) score += 10
    if (category.includes(kw)) score += 8
    if (subIndustry.includes(kw)) score += 6
  }

  // 2. 계층화된 우선순위 점수 적용

  // 🔥 최우선 (building/interior materials 핵심): +100점
  const hasTopPriority = TOP_PRIORITY_KEYWORDS.some((kw) => combinedText.includes(kw))
  if (hasTopPriority) {
    score += 100
  }

  // ⭐ 높은 우선순위 (바닥재/타일/캐비닛): +80점
  const hasHighPriority = HIGH_PRIORITY_KEYWORDS.some((kw) => combinedText.includes(kw))
  if (hasHighPriority && !hasTopPriority) {
    score += 80
  }

  // 중간 우선순위 (일반 도매/유통): +50점
  const hasMediumPriority = MEDIUM_PRIORITY_KEYWORDS.some((kw) => combinedText.includes(kw))
  if (hasMediumPriority && !hasTopPriority && !hasHighPriority) {
    score += 50
  }

  // 낮은 우선순위 (배관/HVAC): +15점
  const hasLowPriority = LOW_PRIORITY_KEYWORDS.some((kw) => combinedText.includes(kw))
  if (hasLowPriority && !hasTopPriority && !hasHighPriority && !hasMediumPriority) {
    score += 15
  }

  // 3. 설계/서비스 키워드 감점 (-30점)
  const hasAnyMaterialsKeyword = hasTopPriority || hasHighPriority || hasMediumPriority
  const hasDesignKeyword = DESIGN_SERVICE_KEYWORDS.some((kw) => combinedText.includes(kw))
  if (hasDesignKeyword && !hasAnyMaterialsKeyword) {
    // 자재 키워드가 없으면서 설계 키워드가 있으면 감점
    score -= 30
  }

  return score
}

// 그룹 내 랜덤 셔플 헬퍼
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const itemI = shuffled[i]
    const itemJ = shuffled[j]
    if (itemI && itemJ) {
      shuffled[i] = itemJ
      shuffled[j] = itemI
    }
  }
  return shuffled
}

// 스마트 셔플: 국가 + 산업 매칭 우선 정렬 (특정 국가 검색 시 Region 제외)
function smartShuffle(results: BigQueryResult[], searchQuery: string): BigQueryResult[] {
  const { keywords: countryKeywords, isSpecificCountry } = extractCountryKeywords(searchQuery)
  const industryKeywords = extractIndustryKeywords(searchQuery)

  leadDiscoveryLogger.info(
    `[스마트 정렬] 국가 키워드: ${countryKeywords.length > 0 ? countryKeywords.join(", ") : "(없음)"} (특정국가: ${isSpecificCountry})`,
  )
  leadDiscoveryLogger.info(
    `[스마트 정렬] 산업 키워드: ${industryKeywords.length > 0 ? industryKeywords.join(", ") : "(없음)"}`,
  )

  // Perplexity 결과는 항상 최상위 (실시간 웹 검색 결과)
  const perplexityResults = results.filter((r) => r.source === "perplexity")
  // Revation 결과는 2순위 (큐레이션된 프리미엄 리드)
  const revationResults = results.filter((r) => r.source === "revation")
  const otherResults = results.filter((r) => r.source !== "perplexity" && r.source !== "revation")

  leadDiscoveryLogger.info(
    `[스마트 정렬] Perplexity 결과: ${perplexityResults.length}개 (최상위 노출), Revation 결과: ${revationResults.length}개 (2순위)`,
  )

  // 키워드가 없어도 소스 기반 우선순위 적용 (Perplexity > Revation > Apollo > Fresh > 기타)
  if (countryKeywords.length === 0 && industryKeywords.length === 0) {
    leadDiscoveryLogger.info(
      "[스마트 정렬] 키워드 없음 - 소스 기반 우선순위 적용 (Perplexity > Revation > Apollo > Fresh)",
    )

    // Perplexity 최우선, Revation 다음, Apollo, Fresh, 나머지
    const apolloResults = otherResults.filter((r) => r.source === "apollo")
    const freshResults = otherResults.filter((r) => r.source === "fresh")
    const restResults = otherResults.filter((r) => r.source !== "apollo" && r.source !== "fresh")

    return [
      ...perplexityResults, // Perplexity 최상위 (셔플 안 함 - 정확도 순서 유지)
      ...revationResults, // Revation 2순위 (프리미엄 리드 - 순서 유지)
      ...shuffleArray(apolloResults),
      ...shuffleArray(freshResults),
      ...shuffleArray(restResults),
    ]
  }

  // 각 리드에 매칭 점수 계산 (국가 + 산업 + 소스 보너스) - Perplexity/Revation 제외한 나머지
  const scored = otherResults.map((lead) => {
    const countryScore = calculateCountryMatchScore(lead, countryKeywords, isSpecificCountry)
    let industryScore = calculateIndustryMatchScore(lead, industryKeywords)

    // Apollo 소스 보너스 (+20점)
    if (lead.source === "apollo") {
      industryScore += 20
    }
    // Fresh 소스 보너스 (+15점)
    if (lead.source === "fresh") {
      industryScore += 15
    }

    return { lead, countryScore, industryScore }
  })

  // 그룹 분류 (국가 매칭 우선, Region은 제외)
  // 자재/도매 핵심 키워드 보너스(+50) 고려하여 기준 조정
  // 1. 국가 O + 자재/도매 핵심 키워드 (score >= 50): 최우선
  const priorityMatch = scored.filter((s) => s.countryScore > 0 && s.industryScore >= 50)
  // 2. 국가 O + 산업 O (score >= 10): 우선
  const bothMatch = scored.filter(
    (s) => s.countryScore > 0 && s.industryScore >= 10 && s.industryScore < 50,
  )
  // 3. 국가 O + 산업 부분매칭 (score 1-9)
  const countryWithPartialIndustry = scored.filter(
    (s) => s.countryScore > 0 && s.industryScore > 0 && s.industryScore < 10,
  )
  // 4. 국가 O + 산업 X 또는 설계 감점 (score <= 0)
  const countryOnly = scored.filter((s) => s.countryScore > 0 && s.industryScore <= 0)
  // 5. 국가 X + 자재/도매 핵심 키워드 (Region 제외)
  const industryPriority = scored.filter((s) => s.countryScore === 0 && s.industryScore >= 50)
  // 6. 국가 X + 산업 O (Region 제외)
  const industryOnly = scored.filter(
    (s) => s.countryScore === 0 && s.industryScore >= 10 && s.industryScore < 50,
  )
  // 7. Region 결과 (특정 국가 검색 시 최하단으로)
  const regionResults = scored.filter((s) => s.countryScore < 0)
  // 8. 나머지 (설계/서비스 업체 포함)
  const noMatch = scored.filter(
    (s) => s.countryScore === 0 && s.industryScore < 10 && s.industryScore > -100,
  )

  leadDiscoveryLogger.info(
    `[스마트 정렬] 매칭 결과: ` +
      `자재도매+국가=${priorityMatch.length}, ` +
      `국가+산업=${bothMatch.length}, ` +
      `국가+부분산업=${countryWithPartialIndustry.length}, ` +
      `국가만=${countryOnly.length}, ` +
      `자재도매=${industryPriority.length}, ` +
      `산업만=${industryOnly.length}, ` +
      `Region(제외)=${regionResults.length}, ` +
      `기타=${noMatch.length}`,
  )

  // 우선순위대로 결합 (Perplexity > Revation > 자재/도매 키워드 매칭)
  const sortedResults = [
    ...perplexityResults, // Perplexity 실시간 검색 결과 최상위 (정확도 순서 유지)
    ...revationResults, // Revation 프리미엄 큐레이션 리드 2순위 (순서 유지)
    ...shuffleArray(priorityMatch).map((s) => s.lead), // 자재/도매 + 국가 매칭
    ...shuffleArray(bothMatch).map((s) => s.lead), // 국가 + 산업 매칭
    ...shuffleArray(countryWithPartialIndustry).map((s) => s.lead), // 국가 + 부분 산업
    ...shuffleArray(industryPriority).map((s) => s.lead), // 자재/도매 키워드만 (국가 X)
    ...shuffleArray(countryOnly).map((s) => s.lead), // 국가만
    ...shuffleArray(industryOnly).map((s) => s.lead), // 산업만
    ...shuffleArray(noMatch).map((s) => s.lead), // 기타
    ...shuffleArray(regionResults).map((s) => s.lead), // Region은 최하단
  ]

  return sortedResults
}

// Transform Apollo results to our format
function transformApolloResults(
  results: Record<string, unknown>[],
  source: "apollo" | "fresh" = "apollo",
): BigQueryResult[] {
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
    source, // 데이터 소스
  }))
}

// Transform Revation results to our format (큐레이션된 프리미엄 리드)
function transformRevationResults(results: Record<string, unknown>[]): BigQueryResult[] {
  return results.map((row) => ({
    companyName: row.company as string | undefined,
    webAddress: row.website as string | undefined,
    description: row.description as string | undefined,
    fitScore: undefined, // 추후 계산 가능
    country: row.country as string | undefined,
    category: row.business_type as string | undefined,
    mainIndustry: row.industry as string | undefined,
    subIndustry: row.products as string | undefined,
    email: row.email as string | undefined,
    employee: row.employee_count as string | undefined,
    source: "revation" as const,
  }))
}

// Transform BigQuery results to our format (B2B Leads)
// 컬럼 순서: 회사명, 웹사이트, Description, Fit Score, Country, Category, Main Industry, Sub Industry, Company Email
function transformResults(results: Record<string, unknown>[], source: "b2b"): BigQueryResult[] {
  return results.map((row) => {
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
      source: "b2b",
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
    emitter.thinking("executeBigQuery", {
      summary: `Rinda 데이터베이스에서 ${targetInfo} 바이어를 검색합니다`,
      detail: `**검색 조건**\n- 국가: ${params.country || "전체"}\n- 산업: ${params.industry || "전체"}\n- 쿼리: ${params.query}\n\n6개 데이터 소스(B2B Leads, Crunchbase, Apollo, Fresh Leads, Revation Premium, Perplexity 실시간)에서 동시에 검색을 시작합니다.`,
      isStreaming: true,
    })
  }

  // 재시도 설정
  const MAX_RETRY_COUNT = 3

  // 내부 검색 함수 (재시도용)
  // params는 위에서 이미 체크됨
  const searchParams = params
  async function executeSearchOnce(attemptNumber: number) {
    // Build the natural language query
    const nlQuery = buildNaturalLanguageQuery(searchParams)

    leadDiscoveryLogger.info(
      `[리드 검색] ${attemptNumber > 1 ? `재시도 ${attemptNumber}/${MAX_RETRY_COUNT} - ` : ""}자연어 쿼리: "${nlQuery}"`,
    )
    leadDiscoveryLogger.info(
      `[리드 검색] 네 테이블(b2b_leads_all, crunchbase_all, apollo_leads_all, fresh_leads) 모두 검색`,
    )
    leadDiscoveryLogger.bigQueryExecutionStart(nlQuery)

    if (emitter) {
      const progressMsg =
        attemptNumber > 1
          ? `재검색 중... (${attemptNumber}/${MAX_RETRY_COUNT})`
          : "6개 데이터 소스에서 병렬 검색 중..."
      emitter.progress("executeBigQuery", progressMsg, 20)
      emitter.thinking("executeBigQuery", {
        summary: "데이터베이스 검색을 실행하고 있어요",
        detail: `6개 데이터 소스에서 동시에 검색 중입니다:\n\n1. **B2B Leads** - 전 세계 B2B 기업 데이터\n2. **Crunchbase** - 스타트업/투자 기업 데이터\n3. **Apollo** - 영업 인텔리전스 데이터\n4. **Fresh Leads** - 최신 기업 정보\n5. **Revation Premium** - 큐레이션된 프리미엄 리드\n6. **Perplexity** - 실시간 웹 검색 결과`,
        isStreaming: true,
      })
    }

    // 네 테이블 병렬 검색 + Perplexity 실시간 검색
    leadDiscoveryLogger.info(`[리드 검색] BigQuery + Perplexity 하이브리드 검색 중...`)

    // Perplexity 검색용 쿼리 최적화
    const perplexityQuery = optimizeQueryForPerplexity(nlQuery)

    const [b2bResult, apolloResult, freshResult, revationResult, perplexityResult] =
      await Promise.allSettled([
        searchBigQuery(nlQuery, B2B_LEADS_DATA_DICTIONARY),
        searchBigQuery(nlQuery, APOLLO_LEADS_DATA_DICTIONARY),
        searchBigQuery(nlQuery, FRESH_LEADS_DATA_DICTIONARY),
        searchBigQuery(nlQuery, REVATION_LEADS_DATA_DICTIONARY), // 큐레이션된 프리미엄 리드
        searchLeadsWithPerplexity(perplexityQuery, 10), // 상위 10개 실시간 검색
      ])

    return {
      b2bResult,
      apolloResult,
      freshResult,
      revationResult,
      perplexityResult,
      nlQuery,
    }
  }

  try {
    let attemptCount = 0
    let searchResults: Awaited<ReturnType<typeof executeSearchOnce>> | null = null
    let totalResultCount = 0

    // 재시도 루프
    while (attemptCount < MAX_RETRY_COUNT) {
      attemptCount++
      searchResults = await executeSearchOnce(attemptCount)

      const { b2bResult, apolloResult, freshResult, revationResult, perplexityResult } =
        searchResults

      // 결과 수 계산
      totalResultCount = 0
      if (b2bResult.status === "fulfilled") totalResultCount += b2bResult.value.totalCount
      if (apolloResult.status === "fulfilled") totalResultCount += apolloResult.value.totalCount
      if (freshResult.status === "fulfilled") totalResultCount += freshResult.value.totalCount
      // Revation 결과 추가 (큐레이션된 프리미엄 리드)
      if (revationResult.status === "fulfilled") totalResultCount += revationResult.value.totalCount
      // Perplexity 결과 추가
      if (perplexityResult.status === "fulfilled")
        totalResultCount += perplexityResult.value.totalCount

      // 결과가 있으면 루프 종료
      if (totalResultCount > 0) {
        leadDiscoveryLogger.info(
          `[리드 검색] ${attemptCount}번째 시도에서 ${totalResultCount}개 결과 찾음`,
        )
        break
      }

      // 결과 없음 - 재시도
      if (attemptCount < MAX_RETRY_COUNT) {
        leadDiscoveryLogger.warn(
          `[리드 검색] 결과 0개 - 재시도 예정 (${attemptCount}/${MAX_RETRY_COUNT})`,
        )
        if (emitter) {
          emitter.progress(
            "executeBigQuery",
            `결과가 없어 다시 검색 중... (${attemptCount + 1}/${MAX_RETRY_COUNT})`,
            20,
          )
        }
        // 잠시 대기 후 재시도 (API 부하 방지)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    // 최종 결과가 없는 경우
    if (!searchResults || totalResultCount === 0) {
      leadDiscoveryLogger.warn(`[리드 검색] ${MAX_RETRY_COUNT}번 시도 후에도 결과 없음`)
      const duration = Date.now() - startTime

      if (emitter) {
        emitter.nodeComplete("executeBigQuery", "검색 조건에 맞는 결과가 없습니다", {
          resultCount: 0,
          totalCount: 0,
          retryCount: attemptCount,
        })
      }

      return {
        searchResults: [],
        totalResultCount: 0,
        bigQuerySQL: "",
        bigQueryExplanation: `${MAX_RETRY_COUNT}번 검색했지만 결과가 없습니다. 검색 조건을 변경해보세요.`,
        executionTime: duration,
        hasMore: false,
        totalAvailable: 0,
      }
    }

    // 결과 처리
    const { b2bResult, apolloResult, freshResult, revationResult, perplexityResult } = searchResults

    // B2B Leads 결과 처리
    let b2bTransformed: ReturnType<typeof transformResults> = []
    let b2bTotal = 0
    let b2bSql = ""
    if (b2bResult.status === "fulfilled") {
      b2bTransformed = transformResults(b2bResult.value.results, "b2b")
      b2bTotal = b2bResult.value.totalCount
      b2bSql = b2bResult.value.sql
      leadDiscoveryLogger.info(`[리드 검색] b2b_leads_all: ${b2bTotal.toLocaleString()}개`)
    } else {
      leadDiscoveryLogger.warn(`[리드 검색] b2b_leads_all 검색 실패: ${b2bResult.reason}`)
    }

    // Apollo Leads 결과 처리
    let apolloTransformed: ReturnType<typeof transformResults> = []
    let apolloTotal = 0
    let apolloSql = ""
    leadDiscoveryLogger.info(`[Apollo] status: ${apolloResult.status}`)
    if (apolloResult.status === "fulfilled") {
      apolloTransformed = transformApolloResults(apolloResult.value.results, "apollo")
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
      freshTransformed = transformApolloResults(freshResult.value.results, "fresh") // Apollo와 같은 구조
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

    // Revation Leads 결과 처리 (큐레이션된 프리미엄 리드)
    let revationTransformed: BigQueryResult[] = []
    let revationTotal = 0
    let revationSql = ""
    leadDiscoveryLogger.info(`[Revation] status: ${revationResult.status}`)
    if (revationResult.status === "fulfilled") {
      revationTransformed = transformRevationResults(revationResult.value.results)
      revationTotal = revationResult.value.totalCount
      revationSql = revationResult.value.sql
      leadDiscoveryLogger.info(
        `[리드 검색] revation_leads: ${revationTotal.toLocaleString()}개 ⭐ (프리미엄)`,
      )
      leadDiscoveryLogger.info(`[Revation SQL] ${revationSql}`)
    } else {
      const reason =
        revationResult.reason instanceof Error
          ? revationResult.reason.message
          : String(revationResult.reason)
      leadDiscoveryLogger.warn(`[리드 검색] revation_leads 검색 실패: ${reason}`)
    }

    // Perplexity 결과 처리 (실시간 웹 검색)
    let perplexityTransformed: BigQueryResult[] = []
    let perplexityTotal = 0
    if (perplexityResult.status === "fulfilled") {
      const pxResults = convertPerplexityToBigQueryFormat(perplexityResult.value.leads)
      perplexityTransformed = pxResults.map((r) => ({
        companyName: r.companyName,
        webAddress: r.webAddress,
        email: r.email,
        country: r.country,
        mainIndustry: r.mainIndustry,
        subIndustry: r.subIndustry,
        category: r.category,
        employee: r.employee,
        revenue: r.revenue,
        source: "perplexity" as const,
      }))
      perplexityTotal = perplexityResult.value.totalCount
      leadDiscoveryLogger.info(
        `[리드 검색] Perplexity (실시간): ${perplexityTransformed.length}개 ⭐`,
      )
    } else {
      const reason =
        perplexityResult.reason instanceof Error
          ? perplexityResult.reason.message
          : String(perplexityResult.reason)
      leadDiscoveryLogger.warn(`[리드 검색] Perplexity 검색 실패: ${reason}`)
    }

    // 각 테이블 결과 수 로그
    leadDiscoveryLogger.info(
      `[셔플 전] Perplexity: ${perplexityTransformed.length}, Revation: ${revationTransformed.length}, B2B: ${b2bTransformed.length}, Apollo: ${apolloTransformed.length}, Fresh: ${freshTransformed.length}`,
    )

    // 결과 합치기 (Perplexity > Revation > Apollo > Fresh > B2B)
    const allResults = [
      ...perplexityTransformed, // Perplexity 실시간 검색 결과 최우선
      ...revationTransformed, // Revation 프리미엄 큐레이션 리드 (2순위)
      ...apolloTransformed, // Apollo BigQuery 결과
      ...freshTransformed,
      ...b2bTransformed,
    ]

    // 스마트 셔플: 검색 쿼리와 관련 있는 산업군을 앞에 배치
    const combinedResults = smartShuffle(allResults, params.query)

    // 세션 캐시에 전체 결과 저장 (더 가져오기 기능용)
    const sessionId = state.sessionId
    cacheResults(sessionId, combinedResults)
    leadDiscoveryLogger.info(`[캐시] 세션 ${sessionId}: ${combinedResults.length}개 결과 캐시됨`)

    // 100개로 제한
    const limitedResults = combinedResults.slice(0, 100)
    const hasMore = combinedResults.length > 100
    const first5 = limitedResults
      .slice(0, 5)
      .map((r) => `${r.companyName || "unknown"}[${r.country || "-"}/${r.mainIndustry || "-"}]`)
    leadDiscoveryLogger.info(`[스마트 셔플 후] 첫 5개: ${first5.join(", ")}`)
    leadDiscoveryLogger.info(
      `[더 가져오기] 전체: ${combinedResults.length}개, 반환: 100개, 남음: ${combinedResults.length - 100}개`,
    )
    const totalCount = b2bTotal + apolloTotal + freshTotal + revationTotal + perplexityTotal
    const combinedSql = `-- Perplexity (실시간): ${perplexityTotal} results\n\n-- Revation (프리미엄):\n${revationSql}\n\n-- B2B Leads:\n${b2bSql}\n\n-- Apollo:\n${apolloSql}\n\n-- Fresh:\n${freshSql}`

    const duration = Date.now() - startTime

    // 상세 로그: 검색 결과
    leadDiscoveryLogger.info(`[리드 검색] 검색 완료:`)
    leadDiscoveryLogger.info(`  - Perplexity (실시간): ${perplexityTotal}개 ⭐ (상위 노출)`)
    leadDiscoveryLogger.info(`  - Revation (프리미엄): ${revationTotal}개 ⭐ (2순위)`)
    leadDiscoveryLogger.info(`  - B2B Leads: ${b2bTotal.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - Apollo: ${apolloTotal.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - Fresh: ${freshTotal.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - 총 결과: ${totalCount.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - 반환 결과: ${limitedResults.length}개 (스마트 셔플, 100개 제한)`)
    leadDiscoveryLogger.info(`  - 소요시간: ${(duration / 1000).toFixed(1)}초`)
    leadDiscoveryLogger.bigQueryExecutionComplete(duration, limitedResults.length, totalCount)

    if (emitter) {
      emitter.progress("executeBigQuery", `${totalCount.toLocaleString()}개 리드를 찾았어요`, 80)
      emitter.thinking("executeBigQuery", {
        summary: `${totalCount.toLocaleString()}개 잠재 바이어 중 상위 100개를 엄선합니다`,
        detail: `**검색 결과 요약**\n- Perplexity (실시간): ${perplexityTotal.toLocaleString()}개\n- Revation (프리미엄): ${revationTotal.toLocaleString()}개\n- Apollo: ${apolloTotal.toLocaleString()}개\n- Fresh Leads: ${freshTotal.toLocaleString()}개\n- B2B Leads: ${b2bTotal.toLocaleString()}개\n- Crunchbase: ${crunchbaseTotal.toLocaleString()}개\n\n**총 ${totalCount.toLocaleString()}개** 잠재 바이어 중 관련도가 높은 **상위 100개**를 선별하여 표시합니다.\n\n> 💡 프리미엄 데이터와 실시간 검색 결과가 우선 노출됩니다.`,
        isStreaming: false,
      })
    }

    // 고객군 분석 없이 바로 결과 반환
    if (emitter) {
      const premiumNote =
        perplexityTotal > 0 || revationTotal > 0
          ? ` (프리미엄 ${perplexityTotal + revationTotal}개 포함)`
          : ""
      emitter.nodeComplete(
        "executeBigQuery",
        `${totalCount.toLocaleString()}개 리드 검색 완료${premiumNote}`,
        {
          resultCount: limitedResults.length,
          totalCount: totalCount,
          perplexityCount: perplexityTotal,
          revationCount: revationTotal,
          b2bCount: b2bTotal,
          apolloCount: apolloTotal,
          freshCount: freshTotal,
        },
      )
    }

    leadDiscoveryLogger.nodeSuccess("executeBigQuery", duration, {
      resultCount: limitedResults.length,
      totalCount: totalCount,
      b2bCount: b2bTotal,
      apolloCount: apolloTotal,
      freshCount: freshTotal,
    })

    return {
      searchResults: limitedResults,
      totalResultCount: totalCount,
      bigQuerySQL: combinedSql,
      bigQueryExplanation: `B2B: ${b2bTotal}개, Apollo: ${apolloTotal}개, Fresh: ${freshTotal}개, Revation: ${revationTotal}개`,
      executionTime: duration,
      hasMore,
      totalAvailable: combinedResults.length,
    }
  } catch (error) {
    const duration = Date.now() - startTime

    // InvalidQueryError는 쿼리 문법 오류
    if (error instanceof InvalidQueryError) {
      leadDiscoveryLogger.warn(`[리드 검색] 잘못된 쿼리: ${error.message}`)

      const errorContext = createErrorContext(error, "executeBigQuery", {
        sessionId: state.sessionId,
        retryCount: state.retryCount,
        details: {
          queryParams: state.bigQueryParams,
          isInvalidQuery: true,
        },
      })

      if (emitter) {
        emitter.nodeComplete("executeBigQuery", "검색 조건을 다시 확인해주세요", {
          isInvalidQuery: true,
          message: error.message,
          errorContext,
        })
      }

      return {
        error: error.message,
        errorContext,
        searchResults: [],
        totalResultCount: 0,
        executionTime: duration,
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // 구조화된 에러 컨텍스트 생성
    const errorContext = createErrorContext(error, "executeBigQuery", {
      sessionId: state.sessionId,
      retryCount: state.retryCount,
      details: {
        queryParams: state.bigQueryParams,
        executionTimeMs: duration,
      },
    })

    leadDiscoveryLogger.error(`[리드 검색] 오류 발생: ${errorMessage}`)
    leadDiscoveryLogger.bigQueryExecutionError(errorMessage)
    leadDiscoveryLogger.nodeError("executeBigQuery", errorMessage, duration)

    if (emitter) {
      emitter.error("executeBigQuery", `검색 중 문제가 발생했어요: ${errorMessage}`)
    }

    return {
      error: errorContext.message,
      errorContext,
      searchResults: [],
      totalResultCount: 0,
      executionTime: duration,
    }
  }
}
