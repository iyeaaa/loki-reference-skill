/**
 * Smart CSV Parser - 템플릿 없이 CSV 파일을 자동으로 분석하고 매핑합니다.
 *
 * Rox 스타일의 스마트 파싱:
 * - 헤더 이름을 분석하여 자동으로 필드 매핑
 * - 데이터 패턴 분석 (이메일, 전화번호, URL 등)
 * - 사용자가 수동으로 매핑 조정 가능
 */

import type { LeadCSVData } from "@/lib/csv-utils"

/** 리드 필드 정의 */
export interface LeadFieldDefinition {
  key: keyof LeadCSVData
  label: string
  labelKo: string
  description: string
  required: boolean
  patterns: RegExp[]
  dataPatterns?: RegExp[] // 데이터 값 패턴 (이메일, URL 등)
  priority: number // 매핑 우선순위 (높을수록 우선)
}

/** 컬럼 분석 결과 */
export interface ColumnAnalysis {
  originalHeader: string
  suggestedField: keyof LeadCSVData | null
  confidence: "high" | "medium" | "low" | "none"
  dataType: "email" | "phone" | "url" | "text" | "number" | "date"
  sampleValues: string[]
  matchReason?: string
}

/** 파싱된 CSV 결과 */
export interface SmartParseResult {
  columns: ColumnAnalysis[]
  mappings: Record<string, keyof LeadCSVData | null>
  previewData: Record<string, string>[]
  totalRows: number
  warnings: string[]
  errors: string[]
  hasHeaders: boolean // 헤더 행이 있는지 여부
  detectedHasHeaders: boolean // 자동 감지된 헤더 존재 여부
}

/** 리드 필드 정의 목록 */
export const LEAD_FIELD_DEFINITIONS: LeadFieldDefinition[] = [
  {
    key: "companyName",
    label: "Company Name",
    labelKo: "회사명",
    description: "회사 또는 조직의 이름",
    required: true,
    patterns: [
      /^company[-_\s]?name$/i,
      /^company$/i,
      /^회사[-_\s]?명$/i,
      /^회사$/i,
      /^organization$/i,
      /^org[-_\s]?name$/i,
      /^business[-_\s]?name$/i,
      /^업체[-_\s]?명$/i,
      /^기업[-_\s]?명$/i,
      /^상호$/i,
    ],
    priority: 100,
  },
  {
    key: "primaryEmail",
    label: "Primary Email",
    labelKo: "대표 이메일",
    description: "주요 연락 이메일 주소",
    required: true,
    patterns: [
      /^primary[-_\s]?email$/i,
      /^email$/i,
      /^e[-_\s]?mail$/i,
      /^이메일$/i,
      /^메일$/i,
      /^대표[-_\s]?이메일$/i,
      /^contact[-_\s]?email$/i,
      /^work[-_\s]?email$/i,
      /^business[-_\s]?email$/i,
    ],
    dataPatterns: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/],
    priority: 95,
  },
  {
    key: "websiteUrl",
    label: "Website URL",
    labelKo: "웹사이트",
    description: "회사 웹사이트 주소",
    required: true,
    patterns: [
      /^website[-_\s]?url$/i,
      /^website$/i,
      /^url$/i,
      /^web$/i,
      /^homepage$/i,
      /^웹사이트$/i,
      /^홈페이지$/i,
      /^사이트$/i,
      /^site$/i,
    ],
    dataPatterns: [/^https?:\/\//, /^www\./, /\.(com|co|net|org|io|kr|jp)/i],
    priority: 90,
  },
  {
    key: "contactName",
    label: "Contact Name",
    labelKo: "담당자명",
    description: "담당자 또는 연락처 이름",
    required: false,
    patterns: [
      /^contact[-_\s]?name$/i,
      /^contact$/i,
      /^name$/i,
      /^person$/i,
      /^담당자[-_\s]?명?$/i,
      /^담당자$/i,
      /^이름$/i,
      /^성명$/i,
      /^full[-_\s]?name$/i,
      /^first[-_\s]?name$/i,
      /^rep[-_\s]?name$/i,
    ],
    priority: 85,
  },
  {
    key: "primaryPhone",
    label: "Primary Phone",
    labelKo: "대표 전화번호",
    description: "주요 연락 전화번호",
    required: false,
    patterns: [
      /^primary[-_\s]?phone$/i,
      /^phone[-_\s]?number$/i,
      /^phone$/i,
      /^tel$/i,
      /^telephone$/i,
      /^전화[-_\s]?번호$/i,
      /^전화$/i,
      /^연락처$/i,
      /^대표[-_\s]?전화$/i,
      /^mobile$/i,
      /^cell$/i,
      /^핸드폰$/i,
      /^휴대폰$/i,
    ],
    dataPatterns: [
      /^\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/,
      /^0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}$/,
    ],
    priority: 80,
  },
  {
    key: "businessType",
    label: "Business Type",
    labelKo: "업종",
    description: "사업 분야 또는 업종",
    required: false,
    patterns: [
      /^business[-_\s]?type$/i,
      /^industry$/i,
      /^sector$/i,
      /^업종$/i,
      /^사업[-_\s]?분야$/i,
      /^산업[-_\s]?분야$/i,
      /^업태$/i,
      /^분류$/i,
      /^category$/i,
    ],
    priority: 70,
  },
  {
    key: "description",
    label: "Description",
    labelKo: "설명",
    description: "회사 또는 리드에 대한 설명",
    required: false,
    patterns: [
      /^description$/i,
      /^desc$/i,
      /^설명$/i,
      /^내용$/i,
      /^비고$/i,
      /^메모$/i,
      /^about$/i,
      /^summary$/i,
      /^note$/i,
    ],
    priority: 40,
  },
  {
    key: "country",
    label: "Country",
    labelKo: "국가",
    description: "회사 소재 국가",
    required: false,
    patterns: [/^country$/i, /^국가$/i, /^nation$/i, /^지역$/i, /^region$/i],
    priority: 65,
  },
  {
    key: "city",
    label: "City",
    labelKo: "도시",
    description: "회사 소재 도시",
    required: false,
    patterns: [/^city$/i, /^도시$/i, /^시$/i, /^town$/i],
    priority: 60,
  },
  {
    key: "state",
    label: "State/Province",
    labelKo: "주/도",
    description: "주, 도, 또는 지방",
    required: false,
    patterns: [/^state$/i, /^province$/i, /^주$/i, /^도$/i, /^시[-_\s]?도$/i],
    priority: 55,
  },
  {
    key: "address",
    label: "Address",
    labelKo: "주소",
    description: "상세 주소",
    required: false,
    patterns: [/^address$/i, /^주소$/i, /^location$/i, /^위치$/i, /^소재지$/i, /^street$/i],
    priority: 50,
  },
  {
    key: "employeeCount",
    label: "Employee Count",
    labelKo: "직원 수",
    description: "회사의 직원 수",
    required: false,
    patterns: [
      /^employee[-_\s]?count$/i,
      /^employees$/i,
      /^size$/i,
      /^직원[-_\s]?수$/i,
      /^규모$/i,
      /^인원$/i,
      /^company[-_\s]?size$/i,
      /^headcount$/i,
    ],
    priority: 45,
  },
  {
    key: "foundedYear",
    label: "Founded Year",
    labelKo: "설립년도",
    description: "회사 설립 연도",
    required: false,
    patterns: [
      /^founded[-_\s]?year$/i,
      /^founded$/i,
      /^established$/i,
      /^설립[-_\s]?년도$/i,
      /^설립년$/i,
      /^year[-_\s]?founded$/i,
    ],
    priority: 35,
  },
  {
    key: "leadSource",
    label: "Lead Source",
    labelKo: "리드 소스",
    description: "리드 획득 경로",
    required: false,
    patterns: [
      /^lead[-_\s]?source$/i,
      /^source$/i,
      /^리드[-_\s]?소스$/i,
      /^유입[-_\s]?경로$/i,
      /^획득[-_\s]?경로$/i,
      /^channel$/i,
      /^채널$/i,
    ],
    priority: 30,
  },
  {
    key: "notes",
    label: "Notes",
    labelKo: "메모",
    description: "추가 메모 또는 노트",
    required: false,
    patterns: [/^notes?$/i, /^메모$/i, /^노트$/i, /^comment$/i, /^remarks$/i, /^비고$/i],
    priority: 20,
  },
  {
    key: "secondaryEmail",
    label: "Secondary Email",
    labelKo: "보조 이메일",
    description: "보조 연락 이메일",
    required: false,
    patterns: [
      /^secondary[-_\s]?email$/i,
      /^alt[-_\s]?email$/i,
      /^other[-_\s]?email$/i,
      /^보조[-_\s]?이메일$/i,
      /^서브[-_\s]?이메일$/i,
      /^email[-_\s]?2$/i,
    ],
    priority: 25,
  },
  {
    key: "secondaryPhone",
    label: "Secondary Phone",
    labelKo: "보조 전화번호",
    description: "보조 연락 전화번호",
    required: false,
    patterns: [
      /^secondary[-_\s]?phone$/i,
      /^alt[-_\s]?phone$/i,
      /^other[-_\s]?phone$/i,
      /^보조[-_\s]?전화$/i,
      /^phone[-_\s]?2$/i,
      /^fax$/i,
      /^팩스$/i,
    ],
    priority: 15,
  },
  {
    key: "foundCompanyName",
    label: "Found Company Name",
    labelKo: "검색된 회사명",
    description: "검색/크롤링으로 발견된 회사명",
    required: false,
    patterns: [
      /^found[-_\s]?company[-_\s]?name$/i,
      /^found[-_\s]?name$/i,
      /^검색[-_\s]?회사명$/i,
      /^발견[-_\s]?회사명$/i,
    ],
    priority: 10,
  },
  {
    key: "leadStatus",
    label: "Lead Status",
    labelKo: "리드 상태",
    description: "리드 진행 상태",
    required: false,
    patterns: [/^lead[-_\s]?status$/i, /^status$/i, /^상태$/i, /^리드[-_\s]?상태$/i, /^stage$/i],
    priority: 5,
  },
  {
    key: "leadScore",
    label: "Lead Score",
    labelKo: "리드 점수",
    description: "리드 품질 점수",
    required: false,
    patterns: [/^lead[-_\s]?score$/i, /^score$/i, /^점수$/i, /^리드[-_\s]?점수$/i, /^rating$/i],
    priority: 5,
  },
]

/**
 * CSV 텍스트를 파싱하여 행 배열로 변환
 */
function parseCSVText(csvText: string): string[][] {
  const normalizedText = csvText.replace(/^\uFEFF/, "").trim()
  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim())

  return lines.map((line) => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }

    result.push(current.trim())
    return result
  })
}

/**
 * 첫 번째 행이 헤더인지 데이터인지 감지
 * 헤더는 보통:
 * - 이메일, URL, 전화번호 패턴이 아님
 * - 숫자만으로 이루어지지 않음
 * - 짧은 텍스트 (보통 헤더는 필드명이므로 짧음)
 */
function detectIfHeaderRow(firstRow: string[], secondRow?: string[]): boolean {
  if (firstRow.length === 0) return false

  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  const urlPattern = /^(https?:\/\/|www\.)/i
  const phonePattern = /^[\d\s+\-().]{10,20}$/
  const pureNumberPattern = /^[\d,.\s]+$/

  let headerLikeCount = 0
  let dataLikeCount = 0

  for (const cell of firstRow) {
    const trimmed = cell.trim()
    if (!trimmed) continue

    // 데이터 패턴 감지
    if (emailPattern.test(trimmed)) {
      dataLikeCount++
      continue
    }
    if (urlPattern.test(trimmed)) {
      dataLikeCount++
      continue
    }
    if (phonePattern.test(trimmed.replace(/\s/g, ""))) {
      dataLikeCount++
      continue
    }
    // 긴 숫자 (전화번호 제외)
    if (pureNumberPattern.test(trimmed) && trimmed.length > 4) {
      dataLikeCount++
      continue
    }

    // 헤더 패턴 감지
    // 헤더는 보통 짧고 특수문자가 적음
    if (trimmed.length <= 30 && !/[,;]/.test(trimmed)) {
      // 알려진 헤더 패턴과 일치하는지 확인
      const isKnownHeader = LEAD_FIELD_DEFINITIONS.some((field) =>
        field.patterns.some((pattern) => pattern.test(trimmed)),
      )
      if (isKnownHeader) {
        headerLikeCount++
        continue
      }
    }

    // 숫자로만 이루어진 짧은 값은 데이터일 가능성
    if (pureNumberPattern.test(trimmed)) {
      dataLikeCount++
    } else {
      // 일반 텍스트 - 첫 행이 두 번째 행과 다른 패턴이면 헤더일 가능성
      headerLikeCount++
    }
  }

  // 두 번째 행과 비교하여 추가 판단
  if (secondRow && secondRow.length > 0) {
    // 첫 번째 행의 값들이 두 번째 행의 값들보다 더 짧으면 헤더일 가능성
    const firstRowAvgLength =
      firstRow.reduce((sum, cell) => sum + cell.trim().length, 0) / firstRow.length
    const secondRowAvgLength =
      secondRow.reduce((sum, cell) => sum + cell.trim().length, 0) / secondRow.length

    if (firstRowAvgLength < secondRowAvgLength * 0.5) {
      headerLikeCount += 2
    }

    // 두 번째 행에 이메일/URL이 있고 첫 번째 행에 없으면 헤더일 가능성
    const secondRowHasData = secondRow.some(
      (cell) => emailPattern.test(cell.trim()) || urlPattern.test(cell.trim()),
    )
    const firstRowHasData = firstRow.some(
      (cell) => emailPattern.test(cell.trim()) || urlPattern.test(cell.trim()),
    )
    if (secondRowHasData && !firstRowHasData) {
      headerLikeCount += 3
    }
  }

  // 결과 판정: 헤더로 보이는 항목이 더 많으면 헤더로 간주
  return headerLikeCount > dataLikeCount
}

/**
 * 헤더 없이 데이터 패턴만으로 컬럼 분석
 */
function analyzeColumnWithoutHeader(
  colIndex: number,
  sampleValues: string[],
  usedFields: Set<keyof LeadCSVData>,
): ColumnAnalysis {
  const dataType = inferDataType(sampleValues)
  const generatedHeader = `Column ${colIndex + 1}`

  let bestMatch: { field: LeadFieldDefinition; confidence: "low" } | null = null

  // 데이터 패턴으로만 필드 추론
  if (dataType === "email") {
    const emailField = usedFields.has("primaryEmail") ? "secondaryEmail" : "primaryEmail"
    const emailFieldDef = LEAD_FIELD_DEFINITIONS.find((f) => f.key === emailField)
    if (!usedFields.has(emailField) && emailFieldDef) {
      bestMatch = { field: emailFieldDef, confidence: "low" }
    }
  } else if (dataType === "url") {
    const urlFieldDef = LEAD_FIELD_DEFINITIONS.find((f) => f.key === "websiteUrl")
    if (!usedFields.has("websiteUrl") && urlFieldDef) {
      bestMatch = { field: urlFieldDef, confidence: "low" }
    }
  } else if (dataType === "phone") {
    const phoneField = usedFields.has("primaryPhone") ? "secondaryPhone" : "primaryPhone"
    const phoneFieldDef = LEAD_FIELD_DEFINITIONS.find((f) => f.key === phoneField)
    if (!usedFields.has(phoneField) && phoneFieldDef) {
      bestMatch = { field: phoneFieldDef, confidence: "low" }
    }
  } else if (dataType === "text") {
    // 첫 번째 텍스트 컬럼은 회사명일 가능성
    if (!usedFields.has("companyName") && colIndex === 0) {
      const companyFieldDef = LEAD_FIELD_DEFINITIONS.find((f) => f.key === "companyName")
      if (companyFieldDef) {
        bestMatch = { field: companyFieldDef, confidence: "low" }
      }
    }
    // 두 번째 텍스트 컬럼은 담당자명일 가능성
    else if (!usedFields.has("contactName")) {
      const hasCompanyName = usedFields.has("companyName")
      if (hasCompanyName || colIndex === 1) {
        const contactFieldDef = LEAD_FIELD_DEFINITIONS.find((f) => f.key === "contactName")
        if (contactFieldDef) {
          bestMatch = { field: contactFieldDef, confidence: "low" }
        }
      }
    }
  }

  return {
    originalHeader: generatedHeader,
    suggestedField: bestMatch?.field.key || null,
    confidence: bestMatch ? "low" : "none",
    dataType,
    sampleValues: sampleValues.slice(0, 3),
    matchReason: bestMatch ? `데이터 패턴 분석 → ${bestMatch.field.labelKo}` : undefined,
  }
}

/**
 * 데이터 값의 타입을 추론
 */
function inferDataType(values: string[]): "email" | "phone" | "url" | "text" | "number" | "date" {
  const nonEmptyValues = values.filter((v) => v?.trim())
  if (nonEmptyValues.length === 0) return "text"

  // 이메일 패턴 검사
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  const emailMatches = nonEmptyValues.filter((v) => emailPattern.test(v.trim()))
  if (emailMatches.length / nonEmptyValues.length > 0.5) return "email"

  // URL 패턴 검사
  const urlPattern = /^(https?:\/\/|www\.)|(\.(com|co|net|org|io|kr|jp|biz)[/\s]*$)/i
  const urlMatches = nonEmptyValues.filter((v) => urlPattern.test(v.trim()))
  if (urlMatches.length / nonEmptyValues.length > 0.5) return "url"

  // 전화번호 패턴 검사
  const phonePattern = /^[\d\s+\-().]{7,20}$/
  const phoneMatches = nonEmptyValues.filter((v) => phonePattern.test(v.trim().replace(/\s/g, "")))
  if (phoneMatches.length / nonEmptyValues.length > 0.5) return "phone"

  // 숫자 패턴 검사
  const numberPattern = /^[\d,.\s]+$/
  const numberMatches = nonEmptyValues.filter((v) => numberPattern.test(v.trim()))
  if (numberMatches.length / nonEmptyValues.length > 0.7) return "number"

  return "text"
}

/**
 * 컬럼 헤더를 분석하여 최적의 필드 매핑을 제안
 */
function analyzeColumn(
  header: string,
  sampleValues: string[],
  usedFields: Set<keyof LeadCSVData>,
): ColumnAnalysis {
  const normalizedHeader = header.trim()
  const dataType = inferDataType(sampleValues)

  // 헤더 패턴 매칭으로 필드 찾기
  let bestMatch: { field: LeadFieldDefinition; confidence: "high" | "medium" | "low" } | null = null

  for (const fieldDef of LEAD_FIELD_DEFINITIONS.sort((a, b) => b.priority - a.priority)) {
    if (usedFields.has(fieldDef.key)) continue

    // 헤더 패턴 매칭
    for (const pattern of fieldDef.patterns) {
      if (pattern.test(normalizedHeader)) {
        bestMatch = { field: fieldDef, confidence: "high" }
        break
      }
    }
    if (bestMatch?.confidence === "high") break

    // 부분 매칭 (헤더에 키워드가 포함된 경우)
    const keywordMatch = fieldDef.patterns.some((p) => {
      const source = p.source.replace(/[\^$]/g, "").replace(/\[-_\\s\]\?/g, "")
      return normalizedHeader.toLowerCase().includes(source.toLowerCase())
    })
    if (keywordMatch && !bestMatch) {
      bestMatch = { field: fieldDef, confidence: "medium" }
    }
  }

  // 데이터 패턴으로 필드 추론 (헤더 매칭이 없는 경우)
  if (!bestMatch) {
    // 이메일 데이터 → primaryEmail 또는 secondaryEmail
    if (dataType === "email") {
      const emailField = usedFields.has("primaryEmail") ? "secondaryEmail" : "primaryEmail"
      const emailFieldDef = LEAD_FIELD_DEFINITIONS.find((f) => f.key === emailField)
      if (!usedFields.has(emailField) && emailFieldDef) {
        bestMatch = {
          field: emailFieldDef,
          confidence: "medium",
        }
      }
    }
    // URL 데이터 → websiteUrl
    else if (dataType === "url" && !usedFields.has("websiteUrl")) {
      const urlFieldDef = LEAD_FIELD_DEFINITIONS.find((f) => f.key === "websiteUrl")
      if (urlFieldDef) {
        bestMatch = {
          field: urlFieldDef,
          confidence: "medium",
        }
      }
    }
    // 전화번호 데이터 → primaryPhone 또는 secondaryPhone
    else if (dataType === "phone") {
      const phoneField = usedFields.has("primaryPhone") ? "secondaryPhone" : "primaryPhone"
      const phoneFieldDef = LEAD_FIELD_DEFINITIONS.find((f) => f.key === phoneField)
      if (!usedFields.has(phoneField) && phoneFieldDef) {
        bestMatch = {
          field: phoneFieldDef,
          confidence: "low",
        }
      }
    }
  }

  return {
    originalHeader: normalizedHeader,
    suggestedField: bestMatch?.field.key || null,
    confidence: bestMatch?.confidence || "none",
    dataType,
    sampleValues: sampleValues.slice(0, 3),
    matchReason: bestMatch
      ? `헤더 "${normalizedHeader}" → ${bestMatch.field.labelKo} (${bestMatch.confidence === "high" ? "정확 일치" : bestMatch.confidence === "medium" ? "부분 일치" : "데이터 패턴"})`
      : undefined,
  }
}

/**
 * CSV 데이터를 스마트하게 분석하고 매핑 제안
 * @param csvText CSV 텍스트
 * @param forceHasHeaders 헤더 존재 여부 강제 지정 (undefined면 자동 감지)
 */
export function smartAnalyzeCSV(csvText: string, forceHasHeaders?: boolean): SmartParseResult {
  const warnings: string[] = []
  const errors: string[] = []

  // ZIP 파일이나 Numbers 파일 검증
  if (csvText.startsWith("PK") || csvText.includes("Index/Document.iwa")) {
    errors.push("잘못된 파일 형식입니다. CSV 파일을 업로드해주세요.")
    return {
      columns: [],
      mappings: {},
      previewData: [],
      totalRows: 0,
      warnings,
      errors,
      hasHeaders: true,
      detectedHasHeaders: true,
    }
  }

  const rows = parseCSVText(csvText)
  if (rows.length < 1) {
    errors.push("파일에 데이터가 없습니다.")
    return {
      columns: [],
      mappings: {},
      previewData: [],
      totalRows: 0,
      warnings,
      errors,
      hasHeaders: true,
      detectedHasHeaders: true,
    }
  }

  // 헤더 존재 여부 감지
  const detectedHasHeaders = detectIfHeaderRow(rows[0], rows[1])
  const hasHeaders = forceHasHeaders !== undefined ? forceHasHeaders : detectedHasHeaders

  // 헤더와 데이터 행 분리
  let headers: string[]
  let dataRows: string[][]

  if (hasHeaders) {
    headers = rows[0]
    dataRows = rows.slice(1)
  } else {
    // 헤더가 없는 경우: 컬럼 인덱스를 헤더로 사용
    const columnCount = rows[0].length
    headers = Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`)
    dataRows = rows // 모든 행이 데이터
    warnings.push(
      "헤더가 감지되지 않았습니다. 첫 번째 행도 데이터로 처리됩니다. 필요시 컬럼 매핑을 확인해주세요.",
    )
  }

  if (dataRows.length === 0) {
    errors.push("파일에 데이터가 없습니다. 최소 1개의 데이터 행이 필요합니다.")
    return {
      columns: [],
      mappings: {},
      previewData: [],
      totalRows: 0,
      warnings,
      errors,
      hasHeaders,
      detectedHasHeaders,
    }
  }

  const usedFields = new Set<keyof LeadCSVData>()

  // 각 컬럼 분석
  const columns: ColumnAnalysis[] = headers.map((header, colIndex) => {
    const columnValues = dataRows.map((row) => row[colIndex] || "")

    let analysis: ColumnAnalysis
    if (hasHeaders) {
      // 헤더가 있는 경우: 헤더 기반 분석
      analysis = analyzeColumn(header, columnValues, usedFields)
    } else {
      // 헤더가 없는 경우: 데이터 패턴 기반 분석
      analysis = analyzeColumnWithoutHeader(colIndex, columnValues, usedFields)
    }

    if (analysis.suggestedField) {
      usedFields.add(analysis.suggestedField)
    }

    return analysis
  })

  // 매핑 객체 생성
  const mappings: Record<string, keyof LeadCSVData | null> = {}
  columns.forEach((col) => {
    mappings[col.originalHeader] = col.suggestedField
  })

  // 미리보기 데이터 생성 (최대 5행)
  const previewData = dataRows.slice(0, 5).map((row) => {
    const rowData: Record<string, string> = {}
    headers.forEach((header, index) => {
      rowData[header] = row[index] || ""
    })
    return rowData
  })

  // 필수 필드 경고
  const requiredFields: (keyof LeadCSVData)[] = ["companyName", "primaryEmail", "websiteUrl"]
  const mappedFields = new Set(Object.values(mappings).filter(Boolean))

  requiredFields.forEach((field) => {
    if (!mappedFields.has(field)) {
      const fieldDef = LEAD_FIELD_DEFINITIONS.find((f) => f.key === field)
      warnings.push(`필수 필드 "${fieldDef?.labelKo || field}"가 매핑되지 않았습니다.`)
    }
  })

  // 매핑되지 않은 컬럼 경고
  const unmappedColumns = columns.filter((col) => col.suggestedField === null)
  if (unmappedColumns.length > 0) {
    warnings.push(
      `${unmappedColumns.length}개의 컬럼이 자동 매핑되지 않았습니다: ${unmappedColumns.map((c) => c.originalHeader).join(", ")}`,
    )
  }

  return {
    columns,
    mappings,
    previewData,
    totalRows: dataRows.length,
    warnings,
    errors,
    hasHeaders,
    detectedHasHeaders,
  }
}

/**
 * 사용자 지정 매핑으로 CSV 데이터를 LeadCSVData 배열로 변환
 * @param csvText CSV 텍스트
 * @param mappings 컬럼 매핑 정보
 * @param hasHeaders 헤더 존재 여부 (기본: true)
 */
export function parseCSVWithMappings(
  csvText: string,
  mappings: Record<string, keyof LeadCSVData | null>,
  hasHeaders = true,
): { leads: LeadCSVData[]; errors: string[] } {
  const rows = parseCSVText(csvText)
  const errors: string[] = []

  if (rows.length < 1) {
    return { leads: [], errors: ["데이터가 없습니다."] }
  }

  let headers: string[]
  let dataRows: string[][]

  if (hasHeaders) {
    if (rows.length < 2) {
      return { leads: [], errors: ["데이터가 없습니다. 헤더만 있고 데이터 행이 없습니다."] }
    }
    headers = rows[0]
    dataRows = rows.slice(1)
  } else {
    // 헤더가 없는 경우: 컬럼 인덱스를 헤더로 사용
    const columnCount = rows[0].length
    headers = Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`)
    dataRows = rows // 모든 행이 데이터
  }

  const leads: LeadCSVData[] = []

  dataRows.forEach((row, rowIndex) => {
    const lead: Partial<LeadCSVData> = {}

    headers.forEach((header, colIndex) => {
      const value = row[colIndex]?.trim() || ""
      const targetField = mappings[header]

      if (targetField && value) {
        // 타입에 맞게 값 변환
        if (targetField === "foundedYear") {
          const year = Number.parseInt(value, 10)
          if (!Number.isNaN(year) && year >= 1800 && year <= new Date().getFullYear() + 1) {
            lead[targetField] = year
          }
        } else if (targetField === "leadScore") {
          const score = Number.parseInt(value, 10)
          if (!Number.isNaN(score)) {
            lead[targetField] = score
          }
        } else if (targetField === "leadStatus") {
          const validStatuses = [
            "new",
            "contacted",
            "qualified",
            "unqualified",
            "converted",
            "lost",
            "unsubscribed",
          ] as const
          const normalizedStatus = value.toLowerCase()
          if (validStatuses.includes(normalizedStatus as (typeof validStatuses)[number])) {
            lead[targetField] = normalizedStatus as LeadCSVData["leadStatus"]
          }
        } else {
          ;(lead as Record<string, unknown>)[targetField] = value
        }
      }
    })

    // companyName이 있는 경우에만 추가
    if (lead.companyName) {
      leads.push(lead as LeadCSVData)
    } else {
      errors.push(`Row ${rowIndex + 2}: 회사명이 없어 스킵되었습니다.`)
    }
  })

  return { leads, errors }
}

/**
 * 필수 필드 검증
 */
export function validateMappings(mappings: Record<string, keyof LeadCSVData | null>): {
  valid: boolean
  missingRequired: string[]
  warnings: string[]
} {
  const requiredFields: { key: keyof LeadCSVData; label: string }[] = [
    { key: "companyName", label: "회사명" },
    { key: "primaryEmail", label: "대표 이메일" },
    { key: "websiteUrl", label: "웹사이트" },
  ]

  const mappedFields = new Set(Object.values(mappings).filter(Boolean))
  const missingRequired: string[] = []

  requiredFields.forEach(({ key, label }) => {
    if (!mappedFields.has(key)) {
      missingRequired.push(label)
    }
  })

  const warnings: string[] = []

  // 권장 필드 체크
  const recommendedFields: { key: keyof LeadCSVData; label: string }[] = [
    { key: "contactName", label: "담당자명" },
    { key: "primaryPhone", label: "전화번호" },
  ]

  recommendedFields.forEach(({ key, label }) => {
    if (!mappedFields.has(key)) {
      warnings.push(`"${label}" 필드가 매핑되지 않았습니다. (선택사항)`)
    }
  })

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    warnings,
  }
}

/**
 * 필드 정의 조회
 */
export function getFieldDefinition(key: keyof LeadCSVData): LeadFieldDefinition | undefined {
  return LEAD_FIELD_DEFINITIONS.find((f) => f.key === key)
}

/**
 * 모든 필수 필드 목록 조회
 */
export function getRequiredFields(): LeadFieldDefinition[] {
  return LEAD_FIELD_DEFINITIONS.filter((f) => f.required)
}

/**
 * 모든 선택 필드 목록 조회
 */
export function getOptionalFields(): LeadFieldDefinition[] {
  return LEAD_FIELD_DEFINITIONS.filter((f) => !f.required)
}
