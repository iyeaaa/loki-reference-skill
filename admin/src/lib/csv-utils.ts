export interface LeadCSVData {
  companyName: string;
  foundCompanyName?: string;
  businessType?: string;
  websiteUrl?: string;
  description?: string;
  employeeCount?: string; // varchar로 변경
  foundedYear?: number;
  country?: string;
  city?: string;
  state?: string;
  address?: string;
  leadSource?: string;
  leadStatus?:
    | "new"
    | "contacted"
    | "qualified"
    | "unqualified"
    | "converted"
    | "lost"
    | "unsubscribed";
  leadScore?: number;
  notes?: string;
}

export function parseCSV(csvText: string): LeadCSVData[] {
  // 파일 형식 검증 - ZIP 파일이나 Numbers 파일인지 확인
  if (csvText.startsWith("PK") || csvText.includes("Index/Document.iwa")) {
    throw new Error(
      "잘못된 파일 형식입니다. Numbers 앱에서 CSV로 내보낸 파일이 아닌 것 같습니다. 텍스트 에디터에서 직접 CSV 파일을 만들어주세요."
    );
  }

  // BOM 제거 및 정규화
  const normalizedText = csvText.replace(/^\uFEFF/, "").trim();

  console.log("Original CSV text length:", csvText.length);
  console.log("Normalized text length:", normalizedText.length);
  console.log("First 200 chars:", normalizedText.substring(0, 200));

  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim());
  console.log("Total lines:", lines.length);
  console.log("First line:", lines[0]);

  if (lines.length < 2) return [];

  // 더 견고한 CSV 파싱 (쉼표로만 분리하지 않고 따옴표 처리)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]);
  console.log("Headers:", headers);
  const data: LeadCSVData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    console.log(`Line ${i} values:`, values);

    if (values.length !== headers.length) {
      console.log(
        `Skipping line ${i}: expected ${headers.length} columns, got ${values.length}`
      );
      continue;
    }

    const lead: LeadCSVData = {
      companyName: values[0] || "",
    };

    // 헤더 매핑
    headers.forEach((header, index) => {
      const value = values[index];
      if (!value) return;

      const lowerHeader = header.toLowerCase();

      if (lowerHeader.includes("company") || lowerHeader.includes("회사")) {
        lead.companyName = value;
      } else if (
        lowerHeader.includes("business") ||
        lowerHeader.includes("업종")
      ) {
        lead.businessType = value;
      } else if (
        lowerHeader.includes("website") ||
        lowerHeader.includes("웹사이트")
      ) {
        lead.websiteUrl = value;
      } else if (
        lowerHeader.includes("description") ||
        lowerHeader.includes("설명")
      ) {
        lead.description = value;
      } else if (
        lowerHeader.includes("employee") ||
        lowerHeader.includes("직원")
      ) {
        lead.employeeCount = value; // 문자열로 저장
      } else if (
        lowerHeader.includes("founded") ||
        lowerHeader.includes("설립")
      ) {
        lead.foundedYear = parseInt(value) || undefined;
      } else if (
        lowerHeader.includes("country") ||
        lowerHeader.includes("국가")
      ) {
        lead.country = value;
      } else if (lowerHeader.includes("city") || lowerHeader.includes("도시")) {
        lead.city = value;
      } else if (
        lowerHeader.includes("state") ||
        lowerHeader.includes("주") ||
        lowerHeader.includes("도")
      ) {
        lead.state = value;
      } else if (
        lowerHeader.includes("address") ||
        lowerHeader.includes("주소")
      ) {
        lead.address = value;
      } else if (
        lowerHeader.includes("email") ||
        lowerHeader.includes("이메일")
      ) {
        // 이메일은 현재 스키마에 없으므로 제거
      } else if (
        lowerHeader.includes("phone") ||
        lowerHeader.includes("전화")
      ) {
        // 전화번호는 현재 스키마에 없으므로 제거
      } else if (
        lowerHeader.includes("source") ||
        lowerHeader.includes("소스")
      ) {
        lead.leadSource = value;
      } else if (
        lowerHeader.includes("status") ||
        lowerHeader.includes("상태")
      ) {
        lead.leadStatus = value as any;
      } else if (
        lowerHeader.includes("score") ||
        lowerHeader.includes("점수")
      ) {
        lead.leadScore = parseInt(value) || undefined;
      } else if (
        lowerHeader.includes("found") ||
        lowerHeader.includes("발견된") ||
        lowerHeader.includes("찾은")
      ) {
        lead.foundCompanyName = value;
      } else if (
        lowerHeader.includes("notes") ||
        lowerHeader.includes("메모") ||
        lowerHeader.includes("노트")
      ) {
        lead.notes = value;
      }
    });

    // 회사명이 있는 경우만 추가
    if (lead.companyName) {
      data.push(lead);
    }
  }

  return data;
}

export function validateCSVData(data: LeadCSVData[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  console.log("Validating CSV data:", data);

  if (data.length === 0) {
    errors.push("CSV 파일에 유효한 데이터가 없습니다.");
    return { valid: false, errors };
  }

  // 회사명 중복 체크 (빈 문자열 제외)
  const companyNames = data
    .map((lead) => lead.companyName.trim())
    .filter((name) => name.length > 0)
    .map((name) => name.toLowerCase());

  console.log("Company names for validation:", companyNames);

  const duplicates = companyNames.filter(
    (name, index) => companyNames.indexOf(name) !== index
  );

  console.log("Found duplicates:", duplicates);

  if (duplicates.length > 0) {
    errors.push(
      `중복된 회사명이 있습니다: ${[...new Set(duplicates)].join(", ")}`
    );
  }

  // 회사명이 비어있는 행 체크
  const emptyCompanyNames = data.filter((lead) => !lead.companyName.trim());
  if (emptyCompanyNames.length > 0) {
    errors.push(
      `회사명이 비어있는 행이 ${emptyCompanyNames.length}개 있습니다.`
    );
  }

  console.log("Validation errors:", errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function generateCSVTemplate(): string {
  return `companyName,foundCompanyName,businessType,websiteUrl,description,employeeCount,foundedYear,country,city,state,address,leadSource,leadStatus,leadScore,notes
"회사명","발견된 회사명","업종","웹사이트","설명","직원수","설립연도","국가","도시","주/도","주소","리드소스","상태","점수","메모"
"Venus Beauty Supply","Venus Beauty Supply Ltd.","K뷰티 유통","https://venusbeautysupply.com","미국 K뷰티 유통업체","50-100명",2015,"미국","뉴욕","뉴욕주","123 Beauty St, New York","웹사이트","new",73,"K뷰티 제품 유통 가능성 높음"
"Beauty World Inc","Beauty World Inc.","화장품 유통","https://beautyworld.com","화장품 전문 유통업체","100-500명",2010,"미국","로스앤젤레스","캘리포니아","456 Cosmetics Ave, LA","추천","contacted",85,"프리미엄 브랜드 선호"
"Global Beauty Co","Global Beauty Company","뷰티 유통","https://globalbeauty.co","글로벌 뷰티 유통업체","500명 이상",2005,"미국","시카고","일리노이","789 Global Blvd, Chicago","전시회","qualified",92,"대규모 유통망 보유"`;
}
