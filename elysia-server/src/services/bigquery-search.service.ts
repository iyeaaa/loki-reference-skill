import { GoogleGenAI } from "@google/genai"
import { BigQuery } from "@google-cloud/bigquery"
import logger from "../utils/logger"

// BigQuery 테이블 메타데이터
interface DataDictionary {
  tableName: string
  columns: string[]
  industries: string[]
  countries: string[]
  employeeRanges: string[]
  revenueRanges: string[]
}

// 검색 결과 타입
interface SearchResult {
  sql: string
  explanation: string
  results: Record<string, unknown>[]
  totalCount: number
}

// BigQuery 클라이언트 (싱글톤)
let bigqueryClient: BigQuery | null = null

const getBigQueryClient = (): BigQuery => {
  if (!bigqueryClient) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0140658679"

    // 환경변수에서 서비스 계정 credentials 확인
    const clientEmail = process.env.BIGQUERY_CLIENT_EMAIL
    const privateKey = process.env.BIGQUERY_PRIVATE_KEY
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS

    if (keyFilePath) {
      // JSON 키 파일 경로로 인증 (로컬 테스트용)
      bigqueryClient = new BigQuery({
        projectId,
        keyFilename: keyFilePath,
      })
      logger.info({ keyFilePath }, "BigQuery client initialized with key file")
    } else if (clientEmail && privateKey) {
      // 서버 환경: 환경변수에서 credentials 사용
      // 다양한 환경에서의 줄바꿈 처리
      const formattedKey = privateKey
        // 따옴표 제거 (환경변수에 따옴표가 포함된 경우)
        .replace(/^["']|["']$/g, "")
        // 리터럴 \n을 실제 줄바꿈으로 변환
        .replace(/\\n/g, "\n")

      logger.info(
        {
          keyLength: formattedKey.length,
          startsWithBegin: formattedKey.startsWith("-----BEGIN"),
          endsWithEnd: formattedKey.includes("-----END"),
        },
        "BigQuery private key format check",
      )

      bigqueryClient = new BigQuery({
        projectId,
        credentials: {
          client_email: clientEmail,
          private_key: formattedKey,
        },
      })
      logger.info("BigQuery client initialized with environment credentials")
    } else {
      // 로컬 환경: gcloud CLI의 application-default credentials 사용
      bigqueryClient = new BigQuery({ projectId })
      logger.info("BigQuery client initialized with default credentials (gcloud CLI)")
    }
  }
  return bigqueryClient
}

// Gemini AI 클라이언트 초기화
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_AI_API_KEY is not set")
  }
  return new GoogleGenAI({ apiKey })
}

// 자연어를 SQL로 변환하는 프롬프트 생성
const generateSqlPrompt = (query: string, dataDictionary: DataDictionary): string => {
  return `You are a SQL expert. Convert the following natural language query to a BigQuery SQL query.

## CRITICAL: Query Type Detection
FIRST, determine the type of query:

### Type 1: HELP_QUERY (도움말/가이드 요청)
If the user is asking about:
- What data/industries/companies are available ("어떤 산업", "검색 가능한", "무엇을 검색", "도움말", "어떻게 검색", "사용법")
- Capabilities of the search system
- Available search options or filters

Then respond with:
HELP_QUERY: [Detailed Korean response explaining available data]

Example responses:
- "어떤 산업 검색할 수 있어?" → HELP_QUERY: 검색 가능한 산업군입니다:\n\n**주요 산업 (Industry):**\n- Business Services (비즈니스 서비스)\n- Software & Internet (소프트웨어/IT)\n- Healthcare (헬스케어)\n- Financial Services (금융)\n- Manufacturing (제조업)\n- Retail (소매업)\n- Food & Beverage (식음료)\n- Real Estate & Construction (부동산/건설)\n- Education (교육)\n- Media & Entertainment (미디어/엔터테인먼트)\n\n**국가:** USA, Canada\n\n**검색 예시:**\n- "미국 소프트웨어 회사 100개"\n- "직원 1000명 이상 헬스케어 회사"\n- "캐나다 금융 서비스 회사"

### Type 2: INVALID_QUERY (무효한 쿼리)
If the query is:
- A greeting (안녕, hello, hi, 반가워)
- Random/meaningless text (ㅁㄴㅇㄹ, asdf, test, ㅋㅋㅋ)
- Unrelated to searching leads/companies (날씨, 뉴스, 오늘 뭐해)

Then respond with ONLY: INVALID_QUERY

## IMPORTANT: Smart Search with Fallback to sub_industry
If the user's query doesn't exactly match an industry name, AUTOMATICALLY search in sub_industry instead.
DO NOT return NO_DATA if the term can be found in sub_industry.

Examples of automatic expansion:
- "IT 회사" → Search: industry = 'Software & Internet' OR industry = 'Computers & Electronics' OR sub_industry LIKE '%IT%'
- "자동차 회사" → Search: sub_industry LIKE '%Automobile%' OR sub_industry LIKE '%Automotive%'
- "패션 회사" → Search: sub_industry LIKE '%Clothing%' OR sub_industry LIKE '%Apparel%' OR sub_industry LIKE '%Fashion%'
- "스타트업" → Search: industry = 'Software & Internet' (best match)
- "테크 회사" → Search: industry IN ('Software & Internet', 'Computers & Electronics', 'Telecommunications')

Only use NO_DATA when the data truly doesn't exist:
- "한국 회사 찾아줘" → NO_DATA: 현재 데이터베이스에는 USA와 Canada 회사만 있습니다.
- "일본 기업" → NO_DATA: 현재 데이터베이스에는 USA와 Canada 회사만 있습니다.
- "유럽 회사" → NO_DATA: 현재 데이터베이스에는 USA와 Canada 회사만 있습니다.

## Table Information
- Table Name: \`${dataDictionary.tableName}\`
- Columns: ${dataDictionary.columns.join(", ")}

## Available Values

### Industries (산업군):
${dataDictionary.industries.map((i) => `- "${i}"`).join("\n")}

### Countries (국가):
${dataDictionary.countries.map((c) => `- "${c}"`).join("\n")}

### Employee Ranges (직원 수):
${dataDictionary.employeeRanges.map((e) => `- "${e}"`).join("\n")}

### Revenue Ranges (매출):
${dataDictionary.revenueRanges.map((r) => `- "${r}"`).join("\n")}

## Important Rules:
1. ALWAYS use LIMIT clause (default 100, max 1000)
2. Use UPPER() for country comparisons to handle case variations
3. For revenue queries like "10억 달러 이상" or "over $1B", use: revenue = '> $1B'
4. For employee queries like "1000명 이상", use employee ranges like '1K - 10K', '10K - 50K', etc.
5. Return ONLY the SQL query, no explanations (or INVALID_QUERY if not a valid search)
6. For Korean queries, understand common patterns:
   - "미국" = USA
   - "캐나다" = Canada  
   - "헬스케어" = Healthcare
   - "소프트웨어" = Software & Internet
   - "제조업" = Manufacturing
   - "금융" = Financial Services
   - "식음료", "음식", "식품", "요식업" = Food & Beverage
   - "소매" = Retail
   - "교육" = Education
   - "통신" = Telecommunications
   - "정부" = Government
   - "농업" = Agriculture & Mining
   - "운송", "물류" = Transportation & Storage
   - "대기업" = employee in ('10K - 50K', '50K - 100K', '> 100K')
   - "중소기업" = employee in ('0 - 25', '25 - 100', '100 - 250')
7. ALWAYS try to find matches - use sub_industry when industry doesn't match exactly:
   - "IT", "IT회사" = industry IN ('Software & Internet', 'Computers & Electronics') OR sub_industry LIKE '%IT%'
   - "테크", "기술" = industry IN ('Software & Internet', 'Computers & Electronics', 'Telecommunications')
   - "자동차", "차량" = sub_industry LIKE '%Automobile%' OR sub_industry LIKE '%Automotive%'
   - "병원" = sub_industry = 'Hospitals'
   - "은행" = sub_industry = 'Banks'
   - "호텔" = sub_industry = 'Hotels, Motels and Lodging'
   - "레스토랑", "음식점" = sub_industry = 'Restaurants and Bars'
   - "법률", "법무법인", "로펌" = sub_industry = 'Legal Services'
   - "보험" = sub_industry = 'Insurance and Risk Management'
   - "부동산" = sub_industry = 'Real Estate Agents and Appraisers'
   - "광고", "마케팅" = sub_industry = 'Advertising, Marketing and PR'
   - "제약" = sub_industry = 'Pharmaceuticals'
   - "바이오" = sub_industry = 'Biotechnology'
   - "항공", "항공우주" = sub_industry = 'Aerospace and Defense'
   - "패션", "의류" = sub_industry LIKE '%Clothing%' OR sub_industry LIKE '%Apparel%'
   - "화장품", "뷰티" = sub_industry LIKE '%Cosmetic%' OR sub_industry LIKE '%Beauty%'
   - "게임" = sub_industry LIKE '%Game%' OR sub_industry LIKE '%Entertainment%'
8. When in doubt, use LIKE with wildcards to find related sub_industries

## User Query:
"${query}"

## SQL Query:`
}

// 유효하지 않은 쿼리 에러
export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidQueryError"
  }
}

// 자연어를 SQL로 변환
export const convertNaturalLanguageToSql = async (
  query: string,
  dataDictionary: DataDictionary,
): Promise<{ sql: string; explanation: string }> => {
  const ai = getGeminiClient()

  const prompt = generateSqlPrompt(query, dataDictionary)

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    })

    const sqlQuery = response.text?.trim() || ""

    // SQL 쿼리 정제 (마크다운 코드 블록 제거)
    const cleanedSql = sqlQuery
      .replace(/```sql\n?/gi, "")
      .replace(/```\n?/gi, "")
      .trim()

    // 도움말 요청 체크
    if (cleanedSql.startsWith("HELP_QUERY:")) {
      const helpMessage = cleanedSql.replace("HELP_QUERY:", "").trim()
      throw new InvalidQueryError(`ℹ️ 검색 가이드\n\n${helpMessage}`)
    }

    // 유효하지 않은 쿼리 체크
    if (cleanedSql === "INVALID_QUERY" || cleanedSql.includes("INVALID_QUERY")) {
      throw new InvalidQueryError(
        '검색어가 올바르지 않습니다. 리드/회사 검색과 관련된 질문을 입력해주세요.\n\n예시:\n- "헬스케어 산업의 미국 회사 100개 보여줘"\n- "직원 수 1000명 이상인 소프트웨어 회사"\n- "캐나다에 있는 금융 서비스 회사"',
      )
    }

    // 데이터 없음 체크
    if (cleanedSql.startsWith("NO_DATA:")) {
      const message = cleanedSql.replace("NO_DATA:", "").trim()
      throw new InvalidQueryError(`📋 데이터 안내\n\n${message}`)
    }

    // SQL 쿼리가 SELECT로 시작하는지 검증
    if (!cleanedSql.toUpperCase().startsWith("SELECT")) {
      throw new InvalidQueryError(
        "유효한 검색 쿼리를 생성할 수 없습니다. 리드/회사 검색과 관련된 질문을 입력해주세요.",
      )
    }

    // 설명 생성
    const explanationPrompt = `다음 SQL 쿼리가 무엇을 검색하는지 한국어로 간단히 설명해주세요 (1-2문장):

SQL: ${cleanedSql}

설명:`

    const explanationResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: explanationPrompt,
    })

    const explanation = explanationResponse.text?.trim() || "검색 결과입니다."

    return { sql: cleanedSql, explanation }
  } catch (error) {
    if (error instanceof InvalidQueryError) {
      throw error
    }
    logger.error({ error }, "Failed to convert natural language to SQL")
    throw error
  }
}

// BigQuery에서 쿼리 실행 (SDK 사용)
export const executeBigQuerySql = async (sql: string): Promise<SearchResult> => {
  const bigquery = getBigQueryClient()

  // LIMIT 제거한 쿼리로 총 개수 확인
  const countSql = `SELECT COUNT(*) as total FROM (${sql.replace(/LIMIT \d+/gi, "")}) as subquery`

  let totalCount = 0

  try {
    const [countRows] = await bigquery.query({
      query: countSql,
      location: "US",
    })
    totalCount = Number(countRows[0]?.total || 0)
  } catch (error) {
    logger.warn({ error }, "Failed to get total count, using result count instead")
  }

  // 실제 데이터 쿼리 실행
  const [rows] = await bigquery.query({
    query: sql,
    location: "US",
  })

  logger.info({ rowCount: rows.length, totalCount }, "BigQuery query executed")

  return {
    sql,
    explanation: "",
    results: rows as Record<string, unknown>[],
    totalCount: totalCount || rows.length,
  }
}

// 메인 검색 함수
export const searchBigQuery = async (
  query: string,
  dataDictionary: DataDictionary,
): Promise<SearchResult> => {
  // 1. 자연어 → SQL 변환
  const { sql, explanation } = await convertNaturalLanguageToSql(query, dataDictionary)

  logger.info({ query, sql }, "Converted natural language to SQL")

  // 2. BigQuery 실행
  const result = await executeBigQuerySql(sql)

  return {
    ...result,
    explanation,
  }
}

// 직접 SQL 실행 (고급 사용자용)
export const executeRawSql = async (sql: string): Promise<SearchResult> => {
  return executeBigQuerySql(sql)
}

// 테이블 스키마 조회
export const getTableSchema = async (tableName: string) => {
  const bigquery = getBigQueryClient()

  // project.dataset.table 형식에서 dataset과 table 추출
  const parts = tableName.split(".")
  const dataset = parts.length >= 2 ? parts[parts.length - 2] : ""
  const table = parts.length >= 1 ? parts[parts.length - 1] : ""

  if (!dataset || !table) {
    throw new Error(`Invalid table name format: ${tableName}`)
  }

  try {
    const [metadata] = await bigquery.dataset(dataset).table(table).getMetadata()

    return {
      schema: metadata.schema?.fields || [],
      numRows: metadata.numRows,
      numBytes: metadata.numBytes,
      creationTime: metadata.creationTime,
      lastModifiedTime: metadata.lastModifiedTime,
    }
  } catch (error) {
    logger.error({ error, tableName }, "Failed to get table schema")
    throw error
  }
}

// 컬럼의 고유값 조회
export const getDistinctValues = async (
  tableName: string,
  columnName: string,
  limit = 100,
): Promise<string[]> => {
  const bigquery = getBigQueryClient()

  const sql = `
    SELECT DISTINCT ${columnName} as value, COUNT(*) as cnt
    FROM \`${tableName}\`
    WHERE ${columnName} IS NOT NULL AND ${columnName} != ''
    GROUP BY ${columnName}
    ORDER BY cnt DESC
    LIMIT ${limit}
  `

  const [rows] = await bigquery.query({
    query: sql,
    location: "US",
  })

  return rows.map((row: { value: string }) => row.value)
}
