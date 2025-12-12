/**
 * Lead Discovery Data Dictionary
 * BigQuery 테이블들의 국가, 산업군 등 필터 옵션을 정의
 */

export interface FilterOption {
  value: string
  label: string
  labelKo?: string
}

// 국가 목록 (모든 테이블 통합, 주요 국가 우선)
export const COUNTRIES: FilterOption[] = [
  // 주요 국가
  { value: "United States", label: "United States", labelKo: "미국" },
  { value: "South Korea", label: "South Korea", labelKo: "한국" },
  { value: "Japan", label: "Japan", labelKo: "일본" },
  { value: "China", label: "China", labelKo: "중국" },
  { value: "United Kingdom", label: "United Kingdom", labelKo: "영국" },
  { value: "Germany", label: "Germany", labelKo: "독일" },
  { value: "France", label: "France", labelKo: "프랑스" },
  { value: "Canada", label: "Canada", labelKo: "캐나다" },
  { value: "Australia", label: "Australia", labelKo: "호주" },
  // 아시아
  { value: "India", label: "India", labelKo: "인도" },
  { value: "Singapore", label: "Singapore", labelKo: "싱가포르" },
  { value: "Indonesia", label: "Indonesia", labelKo: "인도네시아" },
  { value: "Malaysia", label: "Malaysia", labelKo: "말레이시아" },
  { value: "Philippines", label: "Philippines", labelKo: "필리핀" },
  { value: "Thailand", label: "Thailand", labelKo: "태국" },
  { value: "Vietnam", label: "Vietnam", labelKo: "베트남" },
  { value: "Taiwan", label: "Taiwan", labelKo: "대만" },
  { value: "Hong Kong", label: "Hong Kong", labelKo: "홍콩" },
  // 유럽
  { value: "Netherlands", label: "Netherlands", labelKo: "네덜란드" },
  { value: "Spain", label: "Spain", labelKo: "스페인" },
  { value: "Italy", label: "Italy", labelKo: "이탈리아" },
  { value: "Belgium", label: "Belgium", labelKo: "벨기에" },
  { value: "Ireland", label: "Ireland", labelKo: "아일랜드" },
  { value: "Sweden", label: "Sweden", labelKo: "스웨덴" },
  { value: "Switzerland", label: "Switzerland", labelKo: "스위스" },
  { value: "Poland", label: "Poland", labelKo: "폴란드" },
  { value: "Austria", label: "Austria", labelKo: "오스트리아" },
  { value: "Denmark", label: "Denmark", labelKo: "덴마크" },
  { value: "Norway", label: "Norway", labelKo: "노르웨이" },
  { value: "Portugal", label: "Portugal", labelKo: "포르투갈" },
  // 중동/아프리카
  { value: "United Arab Emirates", label: "United Arab Emirates", labelKo: "아랍에미리트" },
  { value: "Saudi Arabia", label: "Saudi Arabia", labelKo: "사우디아라비아" },
  { value: "Israel", label: "Israel", labelKo: "이스라엘" },
  { value: "South Africa", label: "South Africa", labelKo: "남아프리카" },
  // 중남미
  { value: "Brazil", label: "Brazil", labelKo: "브라질" },
  { value: "Mexico", label: "Mexico", labelKo: "멕시코" },
  { value: "Argentina", label: "Argentina", labelKo: "아르헨티나" },
  { value: "Chile", label: "Chile", labelKo: "칠레" },
  { value: "Colombia", label: "Colombia", labelKo: "콜롬비아" },
  // 오세아니아
  { value: "New Zealand", label: "New Zealand", labelKo: "뉴질랜드" },
]

// 지역 목록 (Crunchbase regions)
export const REGIONS: FilterOption[] = [
  { value: "Asia-Pacific (APAC)", label: "Asia-Pacific", labelKo: "아시아태평양" },
  { value: "Southeast Asia", label: "Southeast Asia", labelKo: "동남아시아" },
  {
    value: "and Africa (EMEA)",
    label: "Europe, Middle East & Africa",
    labelKo: "유럽/중동/아프리카",
  },
  { value: "Latin America", label: "Latin America", labelKo: "라틴아메리카" },
  { value: "Middle East", label: "Middle East", labelKo: "중동" },
  { value: "Australasia", label: "Australasia", labelKo: "오세아니아" },
]

// 산업군 카테고리 (모든 테이블 통합)
export const INDUSTRIES: FilterOption[] = [
  // Technology & IT
  { value: "Technology", label: "Technology", labelKo: "기술/IT" },
  { value: "Software", label: "Software", labelKo: "소프트웨어" },
  { value: "Information Technology", label: "Information Technology", labelKo: "정보기술" },
  { value: "SaaS", label: "SaaS", labelKo: "SaaS" },
  { value: "E-Commerce", label: "E-Commerce", labelKo: "이커머스" },
  { value: "Cyber Security", label: "Cyber Security", labelKo: "사이버보안" },
  { value: "Artificial Intelligence", label: "AI / Machine Learning", labelKo: "AI/머신러닝" },
  // Manufacturing
  { value: "Manufacturing", label: "Manufacturing", labelKo: "제조업" },
  { value: "Electronics", label: "Electronics", labelKo: "전자/전기" },
  { value: "Machinery", label: "Machinery", labelKo: "기계" },
  { value: "Automotive", label: "Automotive", labelKo: "자동차" },
  { value: "Packaging", label: "Packaging & Containers", labelKo: "포장재" },
  { value: "Chemicals", label: "Chemicals", labelKo: "화학" },
  { value: "Textiles", label: "Textiles & Apparel", labelKo: "섬유/의류" },
  // Healthcare & Life Sciences
  { value: "Healthcare", label: "Healthcare", labelKo: "헬스케어" },
  { value: "Pharmaceuticals", label: "Pharmaceuticals", labelKo: "제약" },
  { value: "Biotechnology", label: "Biotechnology", labelKo: "바이오테크" },
  { value: "Medical Devices", label: "Medical Devices", labelKo: "의료기기" },
  // Finance & Professional Services
  { value: "Financial Services", label: "Financial Services", labelKo: "금융서비스" },
  { value: "Banking", label: "Banking", labelKo: "은행" },
  { value: "Insurance", label: "Insurance", labelKo: "보험" },
  { value: "Consulting", label: "Consulting", labelKo: "컨설팅" },
  { value: "Legal", label: "Legal Services", labelKo: "법률서비스" },
  { value: "Accounting", label: "Accounting", labelKo: "회계" },
  // Retail & Consumer
  { value: "Retail", label: "Retail", labelKo: "소매" },
  { value: "Wholesale", label: "Wholesale & Distribution", labelKo: "도매/유통" },
  { value: "Consumer Goods", label: "Consumer Goods", labelKo: "소비재" },
  { value: "Food and Beverage", label: "Food & Beverage", labelKo: "식품/음료" },
  { value: "Fashion", label: "Fashion & Apparel", labelKo: "패션/의류" },
  // Real Estate & Construction
  { value: "Real Estate", label: "Real Estate", labelKo: "부동산" },
  { value: "Construction", label: "Construction", labelKo: "건설" },
  { value: "Architecture", label: "Architecture", labelKo: "건축" },
  // Energy & Utilities
  { value: "Energy", label: "Energy", labelKo: "에너지" },
  { value: "Oil and Gas", label: "Oil & Gas", labelKo: "석유/가스" },
  { value: "Renewable Energy", label: "Renewable Energy", labelKo: "재생에너지" },
  // Media & Entertainment
  { value: "Media", label: "Media & Entertainment", labelKo: "미디어/엔터테인먼트" },
  { value: "Advertising", label: "Advertising & Marketing", labelKo: "광고/마케팅" },
  // Education & Non-Profit
  { value: "Education", label: "Education", labelKo: "교육" },
  { value: "Non Profit", label: "Non-Profit", labelKo: "비영리" },
  // Hospitality & Travel
  { value: "Hospitality", label: "Hospitality", labelKo: "호스피탈리티" },
  { value: "Travel", label: "Travel & Tourism", labelKo: "여행/관광" },
  // Logistics & Transportation
  { value: "Logistics", label: "Logistics & Transportation", labelKo: "물류/운송" },
  { value: "Telecommunications", label: "Telecommunications", labelKo: "통신" },
  // Others
  { value: "Agriculture", label: "Agriculture", labelKo: "농업" },
  { value: "Beauty", label: "Beauty & Cosmetics", labelKo: "뷰티/화장품" },
  { value: "Human Resources", label: "HR & Recruiting", labelKo: "인사/채용" },
]

// 세부 산업군 (Sub-Industry)
export const SUB_INDUSTRIES: FilterOption[] = [
  // Business Services
  {
    value: "Advertising, Marketing and PR",
    label: "Advertising, Marketing & PR",
    labelKo: "광고/마케팅/PR",
  },
  { value: "Management Consulting", label: "Management Consulting", labelKo: "경영 컨설팅" },
  { value: "HR and Recruiting Services", label: "HR & Recruiting", labelKo: "인사/채용" },
  { value: "Legal Services", label: "Legal Services", labelKo: "법률 서비스" },
  { value: "Accounting and Tax Preparation", label: "Accounting", labelKo: "회계/세무" },
  // Technology
  { value: "Software", label: "Software", labelKo: "소프트웨어" },
  { value: "IT and Network Services and Support", label: "IT Services", labelKo: "IT 서비스" },
  { value: "E-commerce and Internet Businesses", label: "E-commerce", labelKo: "이커머스" },
  // Healthcare
  { value: "Hospitals", label: "Hospitals", labelKo: "병원" },
  {
    value: "Doctors and Health Care Practitioners",
    label: "Healthcare Practitioners",
    labelKo: "의료진",
  },
  {
    value: "Medical Supplies and Equipment",
    label: "Medical Supplies",
    labelKo: "의료 장비/소모품",
  },
  { value: "Pharmaceuticals", label: "Pharmaceuticals", labelKo: "제약" },
  // Manufacturing
  { value: "Manufacturing Other", label: "General Manufacturing", labelKo: "일반 제조" },
  {
    value: "Tools, Hardware and Light Machinery",
    label: "Tools & Machinery",
    labelKo: "공구/기계",
  },
  { value: "Metals Manufacturing", label: "Metals Manufacturing", labelKo: "금속 제조" },
  { value: "Chemicals and Petrochemicals", label: "Chemicals", labelKo: "화학" },
  { value: "Textiles, Apparel and Accessories", label: "Textiles & Apparel", labelKo: "섬유/의류" },
  {
    value: "Food & Dairy Product Manufacturing and Packaging",
    label: "Food Manufacturing",
    labelKo: "식품 제조",
  },
  // Retail & Wholesale
  { value: "Retail Other", label: "General Retail", labelKo: "일반 소매" },
  {
    value: "Wholesale & Distribution Other",
    label: "Wholesale Distribution",
    labelKo: "도매 유통",
  },
  { value: "Automobile Dealers", label: "Auto Dealers", labelKo: "자동차 딜러" },
  { value: "Restaurants and Bars", label: "Restaurants & Bars", labelKo: "레스토랑/바" },
  // Finance
  { value: "Banks", label: "Banks", labelKo: "은행" },
  { value: "Insurance and Risk Management", label: "Insurance", labelKo: "보험" },
  {
    value: "Investment Banking and Venture Capital",
    label: "Investment Banking & VC",
    labelKo: "투자은행/VC",
  },
  // Real Estate & Construction
  { value: "Construction and Remodeling", label: "Construction", labelKo: "건설/리모델링" },
  {
    value: "Real Estate Agents and Appraisers",
    label: "Real Estate Agents",
    labelKo: "부동산 중개",
  },
  {
    value: "Architecture,Engineering and Design",
    label: "Architecture & Engineering",
    labelKo: "건축/엔지니어링",
  },
  // Education
  { value: "Colleges and Universities", label: "Colleges & Universities", labelKo: "대학" },
  { value: "Elementary and Secondary Schools", label: "K-12 Schools", labelKo: "초중고" },
  // Hospitality
  { value: "Hotels, Motels and Lodging", label: "Hotels & Lodging", labelKo: "호텔/숙박" },
]

// 직원 수 범위
export const EMPLOYEE_RANGES: FilterOption[] = [
  { value: "1-10", label: "1-10", labelKo: "1-10명" },
  { value: "11-50", label: "11-50", labelKo: "11-50명" },
  { value: "51-200", label: "51-200", labelKo: "51-200명" },
  { value: "201-500", label: "201-500", labelKo: "201-500명" },
  { value: "501-1000", label: "501-1,000", labelKo: "501-1,000명" },
  { value: "1001-5000", label: "1,001-5,000", labelKo: "1,001-5,000명" },
  { value: "5001-10000", label: "5,001-10,000", labelKo: "5,001-10,000명" },
  { value: "10000+", label: "10,000+", labelKo: "10,000명 이상" },
]

// 검색 쿼리 생성 함수
export function buildSearchQuery(filters: {
  country?: string
  region?: string
  industry?: string
  subIndustry?: string
  employeeRange?: string
}): string {
  const parts: string[] = []

  // 국가/지역
  if (filters.country) {
    const countryOption = COUNTRIES.find((c) => c.value === filters.country)
    parts.push(countryOption?.labelKo || filters.country)
  } else if (filters.region) {
    const regionOption = REGIONS.find((r) => r.value === filters.region)
    parts.push(regionOption?.labelKo || filters.region)
  }

  // 산업군
  if (filters.industry) {
    const industryOption = INDUSTRIES.find((i) => i.value === filters.industry)
    parts.push(industryOption?.labelKo || filters.industry)
  }

  // 세부 산업군
  if (filters.subIndustry) {
    const subOption = SUB_INDUSTRIES.find((s) => s.value === filters.subIndustry)
    parts.push(subOption?.labelKo || filters.subIndustry)
  }

  // 직원 수
  if (filters.employeeRange) {
    const empOption = EMPLOYEE_RANGES.find((e) => e.value === filters.employeeRange)
    parts.push(`직원 ${empOption?.label || filters.employeeRange}`)
  }

  // 쿼리 조합
  if (parts.length === 0) {
    return ""
  }

  // 국가 + 산업군 조합
  if (parts.length >= 2) {
    return `${parts[0]}에 위치한 ${parts.slice(1).join(" ")} 업체`
  }

  return `${parts[0]} 관련 업체`
}
