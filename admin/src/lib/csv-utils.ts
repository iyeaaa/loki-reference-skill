import * as XLSX from "xlsx"

export type LeadCSVData = {
  companyName: string
  foundCompanyName?: string
  contactName?: string
  businessType?: string
  websiteUrl?: string
  description?: string
  employeeCount?: string // varchar로 변경
  foundedYear?: number
  country?: string
  city?: string
  state?: string
  address?: string
  leadSource?: string
  leadStatus?:
    | "new"
    | "contacted"
    | "qualified"
    | "unqualified"
    | "converted"
    | "lost"
    | "unsubscribed"
  leadScore?: number
  notes?: string
  // 연락처 정보
  primaryEmail?: string
  primaryPhone?: string
  secondaryEmail?: string
  secondaryPhone?: string
}

export function parseXLSX(file: File): Promise<LeadCSVData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })

        // 첫 번째 시트 사용
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as string[][]

        if (jsonData.length < 2) {
          resolve([])
          return
        }

        const headers = jsonData[0]
        const leads: LeadCSVData[] = []

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (row.length === 0) {
            continue
          }

          const lead: LeadCSVData = {
            companyName: row[0] || "",
          }

          // 헤더 매핑 (CSV 파싱과 동일한 로직)
          headers.forEach((header, index) => {
            const value = row[index]
            if (!value) {
              return
            }

            const lowerHeader = header.toLowerCase()

            if (lowerHeader.includes("company") || lowerHeader.includes("회사")) {
              lead.companyName = value
            } else if (lowerHeader.includes("business") || lowerHeader.includes("업종")) {
              lead.businessType = value
            } else if (lowerHeader.includes("website") || lowerHeader.includes("웹사이트")) {
              lead.websiteUrl = value
            } else if (lowerHeader.includes("description") || lowerHeader.includes("설명")) {
              lead.description = value
            } else if (lowerHeader.includes("employee") || lowerHeader.includes("직원")) {
              lead.employeeCount = value
            } else if (lowerHeader.includes("founded") || lowerHeader.includes("설립")) {
              lead.foundedYear = Number.parseInt(value, 10) || undefined
            } else if (lowerHeader.includes("country") || lowerHeader.includes("국가")) {
              lead.country = value
            } else if (lowerHeader.includes("city") || lowerHeader.includes("도시")) {
              lead.city = value
            } else if (
              lowerHeader.includes("state") ||
              lowerHeader.includes("주") ||
              lowerHeader.includes("도")
            ) {
              lead.state = value
            } else if (lowerHeader.includes("address") || lowerHeader.includes("주소")) {
              lead.address = value
            } else if (lowerHeader.includes("source") || lowerHeader.includes("소스")) {
              lead.leadSource = value
            } else if (lowerHeader.includes("status") || lowerHeader.includes("상태")) {
              const validStatuses = [
                "new",
                "contacted",
                "qualified",
                "unqualified",
                "converted",
                "lost",
                "unsubscribed",
              ]
              if (validStatuses.includes(value.toLowerCase())) {
                lead.leadStatus = value.toLowerCase() as LeadCSVData["leadStatus"]
              }
            } else if (lowerHeader.includes("score") || lowerHeader.includes("점수")) {
              lead.leadScore = Number.parseInt(value, 10) || undefined
            } else if (
              lowerHeader.includes("contact") ||
              lowerHeader.includes("담당자") ||
              lowerHeader.includes("contactname")
            ) {
              lead.contactName = value
            } else if (
              lowerHeader.includes("found") ||
              lowerHeader.includes("발견된") ||
              lowerHeader.includes("찾은")
            ) {
              lead.foundCompanyName = value
            } else if (
              lowerHeader.includes("notes") ||
              lowerHeader.includes("메모") ||
              lowerHeader.includes("노트")
            ) {
              lead.notes = value
            } else if (lowerHeader === "primaryemail" || lowerHeader === "primary_email") {
              lead.primaryEmail = value
            } else if (lowerHeader === "primaryphone" || lowerHeader === "primary_phone") {
              lead.primaryPhone = value
            } else if (lowerHeader === "secondaryemail" || lowerHeader === "secondary_email") {
              lead.secondaryEmail = value
            } else if (lowerHeader === "secondaryphone" || lowerHeader === "secondary_phone") {
              lead.secondaryPhone = value
            }
          })

          // 회사명이 있는 경우만 추가
          if (lead.companyName) {
            leads.push(lead)
          }
        }

        resolve(leads)
      } catch (error) {
        reject(
          new Error(
            `XLSX 파일을 읽는 중 오류가 발생했습니다: ${
              error instanceof Error ? error.message : "알 수 없는 오류"
            }`,
          ),
        )
      }
    }

    reader.onerror = () => {
      reject(new Error("파일을 읽는 중 오류가 발생했습니다."))
    }

    reader.readAsArrayBuffer(file)
  })
}

export function parseCSV(csvText: string): LeadCSVData[] {
  // 파일 형식 검증 - ZIP 파일이나 Numbers 파일인지 확인
  if (csvText.startsWith("PK") || csvText.includes("Index/Document.iwa")) {
    throw new Error(
      "잘못된 파일 형식입니다. Numbers 앱에서 CSV로 내보낸 파일이 아닌 것 같습니다. 텍스트 에디터에서 직접 CSV 파일을 만들어주세요.",
    )
  }

  // BOM 제거 및 정규화
  const normalizedText = csvText.replace(/^\uFEFF/, "").trim()

  console.log("Original CSV text length:", csvText.length)
  console.log("Normalized text length:", normalizedText.length)
  console.log("First 200 chars:", normalizedText.substring(0, 200))

  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim())
  console.log("Total lines:", lines.length)
  console.log("First line:", lines[0])

  if (lines.length < 2) {
    return []
  }

  // 더 견고한 CSV 파싱 (쉼표로만 분리하지 않고 따옴표 처리)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }

    result.push(current.trim())
    return result
  }

  const headers = parseCSVLine(lines[0])
  console.log("Headers:", headers)
  const data: LeadCSVData[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    console.log(`Line ${i} values:`, values)

    if (values.length !== headers.length) {
      console.log(`Skipping line ${i}: expected ${headers.length} columns, got ${values.length}`)
      continue
    }

    const lead: LeadCSVData = {
      companyName: values[0] || "",
    }

    // 헤더 매핑
    headers.forEach((header, index) => {
      const value = values[index]
      if (!value) {
        return
      }

      const lowerHeader = header.toLowerCase()

      if (lowerHeader.includes("company") || lowerHeader.includes("회사")) {
        lead.companyName = value
      } else if (lowerHeader.includes("business") || lowerHeader.includes("업종")) {
        lead.businessType = value
      } else if (lowerHeader.includes("website") || lowerHeader.includes("웹사이트")) {
        lead.websiteUrl = value
      } else if (lowerHeader.includes("description") || lowerHeader.includes("설명")) {
        lead.description = value
      } else if (lowerHeader.includes("employee") || lowerHeader.includes("직원")) {
        lead.employeeCount = value // 문자열로 저장
      } else if (lowerHeader.includes("founded") || lowerHeader.includes("설립")) {
        lead.foundedYear = Number.parseInt(value, 10) || undefined
      } else if (lowerHeader.includes("country") || lowerHeader.includes("국가")) {
        lead.country = value
      } else if (lowerHeader.includes("city") || lowerHeader.includes("도시")) {
        lead.city = value
      } else if (
        lowerHeader.includes("state") ||
        lowerHeader.includes("주") ||
        lowerHeader.includes("도")
      ) {
        lead.state = value
      } else if (lowerHeader.includes("address") || lowerHeader.includes("주소")) {
        lead.address = value
      } else if (lowerHeader.includes("source") || lowerHeader.includes("소스")) {
        lead.leadSource = value
      } else if (lowerHeader.includes("status") || lowerHeader.includes("상태")) {
        const validStatuses = [
          "new",
          "contacted",
          "qualified",
          "unqualified",
          "converted",
          "lost",
          "unsubscribed",
        ]
        if (validStatuses.includes(value.toLowerCase())) {
          lead.leadStatus = value.toLowerCase() as LeadCSVData["leadStatus"]
        }
      } else if (lowerHeader.includes("score") || lowerHeader.includes("점수")) {
        lead.leadScore = Number.parseInt(value, 10) || undefined
      } else if (
        lowerHeader.includes("contact") ||
        lowerHeader.includes("담당자") ||
        lowerHeader.includes("contactname")
      ) {
        lead.contactName = value
      } else if (
        lowerHeader.includes("found") ||
        lowerHeader.includes("발견된") ||
        lowerHeader.includes("찾은")
      ) {
        lead.foundCompanyName = value
      } else if (
        lowerHeader.includes("notes") ||
        lowerHeader.includes("메모") ||
        lowerHeader.includes("노트")
      ) {
        lead.notes = value
      } else if (lowerHeader === "primaryemail" || lowerHeader === "primary_email") {
        lead.primaryEmail = value
      } else if (lowerHeader === "primaryphone" || lowerHeader === "primary_phone") {
        lead.primaryPhone = value
      } else if (lowerHeader === "secondaryemail" || lowerHeader === "secondary_email") {
        lead.secondaryEmail = value
      } else if (lowerHeader === "secondaryphone" || lowerHeader === "secondary_phone") {
        lead.secondaryPhone = value
      }
    })

    // 회사명이 있는 경우만 추가
    if (lead.companyName) {
      data.push(lead)
    }
  }

  return data
}

export function validateCSVData(data: LeadCSVData[]): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  console.log("Validating CSV data:", data)

  if (data.length === 0) {
    errors.push("CSV 파일에 유효한 데이터가 없습니다.")
    return { valid: false, errors, warnings }
  }

  // 회사명 중복 체크 (빈 문자열 제외) - 경고로 변경
  const companyNames = data
    .map((lead) => lead.companyName.trim())
    .filter((name) => name.length > 0)
    .map((name) => name.toLowerCase())

  console.log("Company names for validation:", companyNames)

  const duplicates = companyNames.filter((name, index) => companyNames.indexOf(name) !== index)

  console.log("Found duplicates:", duplicates)

  if (duplicates.length > 0) {
    warnings.push(
      `파일 내 중복된 회사명이 있습니다: ${[...new Set(duplicates)].join(
        ", ",
      )}. 같은 회사명이라도 이메일이 다르면 별도의 리드로 처리됩니다.`,
    )
  }

  // 필수 필드 체크
  const emptyCompanyNames = data.filter((lead) => !lead.companyName.trim())
  if (emptyCompanyNames.length > 0) {
    errors.push(`회사명이 비어있는 행이 ${emptyCompanyNames.length}개 있습니다.`)
  }

  const emptyPrimaryEmails = data.filter((lead) => !lead.primaryEmail?.trim())
  if (emptyPrimaryEmails.length > 0) {
    errors.push(`주요 이메일이 비어있는 행이 ${emptyPrimaryEmails.length}개 있습니다.`)
  }

  const emptyWebsiteUrls = data.filter((lead) => !lead.websiteUrl?.trim())
  if (emptyWebsiteUrls.length > 0) {
    errors.push(`웹사이트 URL이 비어있는 행이 ${emptyWebsiteUrls.length}개 있습니다.`)
  }

  console.log("Validation errors:", errors)
  console.log("Validation warnings:", warnings)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * 심플 템플릿 생성 - 필수 필드만 포함
 * 고객이 쉽게 데이터를 입력할 수 있도록 최소한의 필드만 제공
 */
export function generateSimpleCSVTemplate(): string {
  const csvContent = `회사명,담당자명,이메일,전화번호,웹사이트
"Venus Beauty Supply","김영희","contact@venusbeauty.com","+1-555-0123","https://venusbeauty.com"
"Beauty World Inc","Sarah Johnson","info@beautyworld.com","+1-555-0234","https://beautyworld.com"
"Global Beauty Co","Michael Chen","hello@globalbeauty.co","+1-555-0345","https://globalbeauty.co"`

  return `\uFEFF${csvContent}`
}

/**
 * 상세 템플릿 생성 - 모든 필드 포함
 * 더 많은 데이터를 입력하고 싶은 고객을 위한 상세 템플릿
 */
export function generateDetailedCSVTemplate(): string {
  const csvContent = `회사명,담당자명,이메일,전화번호,웹사이트,업종,국가,도시,주소,직원수,설립년도,메모
"Venus Beauty Supply","김영희","contact@venusbeauty.com","+1-555-0123","https://venusbeauty.com","K뷰티 유통","미국","뉴욕","123 Beauty St, New York","50-100명",2015,"K뷰티 제품 유통 가능성 높음"
"Beauty World Inc","Sarah Johnson","info@beautyworld.com","+1-555-0234","https://beautyworld.com","화장품 유통","미국","로스앤젤레스","456 Cosmetics Ave, LA","100-500명",2010,"프리미엄 브랜드 선호"
"Global Beauty Co","Michael Chen","hello@globalbeauty.co","+1-555-0345","https://globalbeauty.co","뷰티 유통","미국","시카고","789 Global Blvd, Chicago","500명 이상",2005,"대규모 유통망 보유"`

  return `\uFEFF${csvContent}`
}

/**
 * 기존 호환성을 위한 기본 템플릿 (상세 템플릿 사용)
 */
export function generateCSVTemplate(): string {
  return generateSimpleCSVTemplate()
}

/**
 * 심플 XLSX 템플릿 생성
 */
export function generateSimpleXLSXTemplate(): Blob {
  const headers = ["회사명", "담당자명", "이메일", "전화번호", "웹사이트"]

  const sampleData = [
    [
      "Venus Beauty Supply",
      "김영희",
      "contact@venusbeauty.com",
      "+1-555-0123",
      "https://venusbeauty.com",
    ],
    [
      "Beauty World Inc",
      "Sarah Johnson",
      "info@beautyworld.com",
      "+1-555-0234",
      "https://beautyworld.com",
    ],
    [
      "Global Beauty Co",
      "Michael Chen",
      "hello@globalbeauty.co",
      "+1-555-0345",
      "https://globalbeauty.co",
    ],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "리드 데이터")

  // 컬럼 너비 자동 조정
  worksheet["!cols"] = [
    { wch: 25 }, // 회사명
    { wch: 15 }, // 담당자명
    { wch: 30 }, // 이메일
    { wch: 15 }, // 전화번호
    { wch: 35 }, // 웹사이트
  ]

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  })
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

/**
 * 상세 XLSX 템플릿 생성
 */
export function generateDetailedXLSXTemplate(): Blob {
  const headers = [
    "회사명",
    "담당자명",
    "이메일",
    "전화번호",
    "웹사이트",
    "업종",
    "국가",
    "도시",
    "주소",
    "직원수",
    "설립년도",
    "메모",
  ]

  const sampleData = [
    [
      "Venus Beauty Supply",
      "김영희",
      "contact@venusbeauty.com",
      "+1-555-0123",
      "https://venusbeauty.com",
      "K뷰티 유통",
      "미국",
      "뉴욕",
      "123 Beauty St, New York",
      "50-100명",
      2015,
      "K뷰티 제품 유통 가능성 높음",
    ],
    [
      "Beauty World Inc",
      "Sarah Johnson",
      "info@beautyworld.com",
      "+1-555-0234",
      "https://beautyworld.com",
      "화장품 유통",
      "미국",
      "로스앤젤레스",
      "456 Cosmetics Ave, LA",
      "100-500명",
      2010,
      "프리미엄 브랜드 선호",
    ],
    [
      "Global Beauty Co",
      "Michael Chen",
      "hello@globalbeauty.co",
      "+1-555-0345",
      "https://globalbeauty.co",
      "뷰티 유통",
      "미국",
      "시카고",
      "789 Global Blvd, Chicago",
      "500명 이상",
      2005,
      "대규모 유통망 보유",
    ],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "리드 데이터")

  // 컬럼 너비 자동 조정
  worksheet["!cols"] = [
    { wch: 25 }, // 회사명
    { wch: 15 }, // 담당자명
    { wch: 30 }, // 이메일
    { wch: 15 }, // 전화번호
    { wch: 35 }, // 웹사이트
    { wch: 15 }, // 업종
    { wch: 10 }, // 국가
    { wch: 12 }, // 도시
    { wch: 30 }, // 주소
    { wch: 12 }, // 직원수
    { wch: 10 }, // 설립년도
    { wch: 30 }, // 메모
  ]

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  })
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

/**
 * 기존 호환성을 위한 기본 템플릿 (심플 템플릿 사용)
 */
export function generateXLSXTemplate(): Blob {
  return generateSimpleXLSXTemplate()
}
