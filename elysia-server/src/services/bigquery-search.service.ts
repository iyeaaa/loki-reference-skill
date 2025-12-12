import { gunzipSync } from "node:zlib"
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

    // 인증 방법 우선순위:
    // 1. GOOGLE_CREDENTIALS_GZIP_BASE64 (gzip 압축 + Base64 인코딩) - 약 50% 더 짧음
    // 2. GOOGLE_CREDENTIALS_BASE64 (Base64 인코딩된 JSON 키) - 배포 환경 추천
    // 3. GOOGLE_APPLICATION_CREDENTIALS (키 파일 경로) - 로컬 테스트용
    // 4. BIGQUERY_CLIENT_EMAIL + BIGQUERY_PRIVATE_KEY (개별 환경변수)
    // 5. gcloud CLI 기본 credentials - 로컬 개발용

    const credentialsGzipBase64 = process.env.GOOGLE_CREDENTIALS_GZIP_BASE64
    const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    const clientEmail = process.env.BIGQUERY_CLIENT_EMAIL
    const privateKey = process.env.BIGQUERY_PRIVATE_KEY

    // 방법 1: gzip + Base64 (가장 짧고 권장)
    if (credentialsGzipBase64?.trim()) {
      try {
        const compressedBuffer = Buffer.from(credentialsGzipBase64.trim(), "base64")
        const credentialsJson = gunzipSync(compressedBuffer).toString("utf-8")
        const credentials = JSON.parse(credentialsJson)

        if (credentials.client_email && credentials.private_key) {
          bigqueryClient = new BigQuery({
            projectId: credentials.project_id || projectId,
            credentials: {
              client_email: credentials.client_email,
              private_key: credentials.private_key,
            },
          })
          logger.info(
            { clientEmail: credentials.client_email },
            "BigQuery client initialized with gzip+Base64 credentials",
          )
        } else {
          logger.error("GOOGLE_CREDENTIALS_GZIP_BASE64 missing client_email or private_key")
          throw new Error("Invalid GOOGLE_CREDENTIALS_GZIP_BASE64: missing required fields")
        }
      } catch (error) {
        logger.error({ error }, "Failed to parse GOOGLE_CREDENTIALS_GZIP_BASE64")
        throw new Error("Invalid GOOGLE_CREDENTIALS_GZIP_BASE64 format")
      }
    }

    // 방법 2: Base64 인코딩된 JSON 키
    if (!bigqueryClient && credentialsBase64?.trim()) {
      try {
        const credentialsJson = Buffer.from(credentialsBase64.trim(), "base64").toString("utf-8")
        const credentials = JSON.parse(credentialsJson)

        if (credentials.client_email && credentials.private_key) {
          bigqueryClient = new BigQuery({
            projectId: credentials.project_id || projectId,
            credentials: {
              client_email: credentials.client_email,
              private_key: credentials.private_key,
            },
          })
          logger.info(
            { clientEmail: credentials.client_email },
            "BigQuery client initialized with Base64 credentials",
          )
        } else {
          logger.warn("GOOGLE_CREDENTIALS_BASE64 missing client_email or private_key")
        }
      } catch (error) {
        logger.warn({ error }, "Failed to parse GOOGLE_CREDENTIALS_BASE64, trying other methods")
      }
    }

    if (!bigqueryClient && keyFilePath) {
      // 방법 3: JSON 키 파일 경로로 인증 (로컬 테스트용)
      bigqueryClient = new BigQuery({
        projectId,
        keyFilename: keyFilePath,
      })
      logger.info({ keyFilePath }, "BigQuery client initialized with key file")
    }

    if (!bigqueryClient && clientEmail && privateKey) {
      // 방법 4: 개별 환경변수에서 credentials 사용
      const formattedKey = privateKey.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n")

      bigqueryClient = new BigQuery({
        projectId,
        credentials: {
          client_email: clientEmail,
          private_key: formattedKey,
        },
      })
      logger.info("BigQuery client initialized with environment credentials")
    }

    if (!bigqueryClient) {
      // 방법 5: 로컬 환경 - gcloud CLI의 application-default credentials 사용
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
HELP_QUERY: [Detailed Korean response explaining available data based on the provided industries and countries below]

For HELP_QUERY responses, use the ACTUAL data from this database:
- Industries: ${dataDictionary.industries.slice(0, 15).join(", ")}${dataDictionary.industries.length > 15 ? ` 외 ${dataDictionary.industries.length - 15}개` : ""}
- Countries/Regions: ${dataDictionary.countries.join(", ")}
- Employee Ranges: ${dataDictionary.employeeRanges.slice(0, 5).join(", ")}

Generate a helpful Korean response listing the available industries and regions from THIS database.

### Type 2: INVALID_QUERY (무효한 쿼리)
If the query is:
- A greeting (안녕, hello, hi, 반가워)
- Random/meaningless text (ㅁㄴㅇㄹ, asdf, test, ㅋㅋㅋ)
- Unrelated to searching leads/companies (날씨, 뉴스, 오늘 뭐해)

Then respond with ONLY: INVALID_QUERY

## CRITICAL: Only use columns that exist in this table!
Available columns: ${dataDictionary.columns.join(", ")}
DO NOT use any column that is not in the list above (e.g., if "sub_industry" is not listed, don't use it!)

## ⚠️ CRITICAL RULE: ALL Keywords Must Be Matched with AND!

When the user searches for a compound term like "포장재 유통회사":
1. **MUST use ALL keywords with AND** - "포장재 유통" means BOTH "packaging" AND "wholesale"
2. Extract ALL industry keywords from the query and combine them with AND
3. Only use OR for synonyms of the SAME concept (e.g., "wholesale" OR "distribution" for "유통")

### STEP-BY-STEP for "미국에 위치한 포장재 유통회사":
1. Extract country: "미국" → "United States"
2. Extract industry #1: "포장재" → "packaging"
3. Extract industry #2: "유통" → "wholesale" OR "distribution"
4. Combine with AND: packaging AND (wholesale OR distribution)

### Examples of CORRECT SQL:
- "미국 포장재 유통회사" → WHERE country = 'United States' AND LOWER(industry) LIKE '%packaging%' AND (LOWER(industry) LIKE '%wholesale%' OR LOWER(industry) LIKE '%distribution%') LIMIT 100
- "미국 포장재 회사" → WHERE country = 'United States' AND LOWER(industry) LIKE '%packaging%' LIMIT 100
- "미국 뷰티 회사" → WHERE country = 'United States' AND (LOWER(industry) LIKE '%beauty%' OR LOWER(industry) LIKE '%cosmetics%') LIMIT 100
- "미국 유통 회사" → WHERE country = 'United States' AND (LOWER(industry) LIKE '%wholesale%' OR LOWER(industry) LIKE '%distribution%') LIMIT 100
- "미국 IT 컨설팅" → WHERE country = 'United States' AND LOWER(industry) LIKE '%software%' AND LOWER(industry) LIKE '%consulting%' LIMIT 100

### Examples of WRONG SQL (DO NOT DO THIS):
❌ WHERE country = 'United States' LIMIT 100  -- Missing industry filter! Returns 600K+ unrelated results!
❌ WHERE country = 'United States' OR LOWER(industry) LIKE '%packaging%'  -- OR with country is WRONG!
❌ WHERE LOWER(industry) LIKE '%wholesale%' -- Missing "packaging" for "포장재 유통"!
❌ WHERE LOWER(industry) LIKE '%manufacturing%' OR LOWER(industry) LIKE '%wholesale%' -- Generic "manufacturing" is NOT "packaging"!

## Korean to English Industry Keyword Mapping (MANDATORY - USE THESE EXACT KEYWORDS):

| Korean Query | REQUIRED English Keywords for LIKE |
|--------------|-----------------------------------|
| 포장재, 패키징 | packaging (NEVER use just "manufacturing"!) |
| 유통 | wholesale, distribution |
| 포장재 유통 | packaging AND (wholesale OR distribution) |
| 뷰티, 화장품 | beauty, cosmetics |
| IT, 소프트웨어, 기술 | software, technology |
| 헬스케어, 의료, 병원 | health, medical, healthcare, hospital |
| 제조업 | manufacturing (but NOT for "포장재"!) |
| 금융, 은행 | financial, banking, finance |
| 부동산 | real estate, property |
| 교육 | education, training |
| 물류, 운송 | logistics, transportation, freight |
| 청소, 청소용품 | cleaning |
| 식품, 음료 | food, beverage |
| 건설 | construction, building |
| 에너지 | energy, power |
| 자동차 | automotive |
| 농업 | agriculture, farming |
| 컨설팅 | consulting |
| 광고, 마케팅 | advertising, marketing |
| 보험 | insurance |

⚠️ CRITICAL: "포장재" = "packaging", NOT "manufacturing"! 
Many industries have "manufacturing" in their name. Only use "packaging" for packaging companies!

## Table Information
- Table Name: \`${dataDictionary.tableName}\`
- Columns: ${dataDictionary.columns.join(", ")}

## Available Values

### Industries (산업군) - ONLY use keywords from this list:
${dataDictionary.industries
  .slice(0, 50)
  .map((i) => `- "${i}"`)
  .join("\n")}
${dataDictionary.industries.length > 50 ? `... and ${dataDictionary.industries.length - 50} more` : ""}

### Countries (국가):
${dataDictionary.countries.map((c) => `- "${c}"`).join("\n")}

### Employee Ranges (직원 수):
${dataDictionary.employeeRanges.map((e) => `- "${e}"`).join("\n")}

### Revenue Ranges (매출):
${dataDictionary.revenueRanges.map((r) => `- "${r}"`).join("\n")}

## Important Rules:
1. ALWAYS use LIMIT clause (default 100, max 1000)
2. Return ONLY the SQL query, no explanations (or INVALID_QUERY if not a valid search)
3. **CRITICAL: Industry Filter is MANDATORY when user mentions a product/industry!**
   - The SQL MUST include an industry condition using LIKE
   - Check the Industries list above and find the BEST matching keyword
   - If NO keyword matches at all, return: NO_INDUSTRY_MATCH
   - **NEVER return results with only country filter** (this causes 600K+ unrelated results!)
4. For Korean location queries, use the EXACT country values from the Countries list above
5. For employee range queries:
   - Check the available employee ranges format (e.g., "0 - 25", "c_00001_00010")
   - "대기업" = larger employee ranges
   - "중소기업", "스타트업" = smaller employee ranges
6. Use LOWER(industry) LIKE '%keyword%' for case-insensitive matching

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

    // Industry 매칭 없음 - 특별한 SQL 반환 (searchBigQuery에서 처리)
    if (cleanedSql === "NO_INDUSTRY_MATCH" || cleanedSql.includes("NO_INDUSTRY_MATCH")) {
      logger.info(`[${dataDictionary.tableName}] No matching industry, returning empty marker`)
      return {
        sql: "NO_INDUSTRY_MATCH",
        explanation: "이 테이블에서 해당 산업을 찾을 수 없습니다.",
      }
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

  // NO_INDUSTRY_MATCH: 빈 결과 반환 (에러 아님)
  if (sql === "NO_INDUSTRY_MATCH") {
    logger.info(`[${dataDictionary.tableName}] Returning empty results due to NO_INDUSTRY_MATCH`)
    return {
      sql: "-- NO_INDUSTRY_MATCH",
      explanation,
      results: [],
      totalCount: 0,
    }
  }

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
