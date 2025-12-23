/**
 * BigQuery SQL Validator
 *
 * Validates and auto-corrects common SQL generation mistakes from the LLM.
 * This provides a safety layer before SQL execution.
 */

interface DataDictionary {
  tableName: string
  columns: string[]
  industries: string[]
  countries: string[]
  employeeRanges: string[]
  revenueRanges: string[]
}

interface ValidationContext {
  originalQuery: string
  dataDictionary: DataDictionary
}

interface RuleResult {
  passed: boolean
  message?: string
}

interface ValidationRule {
  name: string
  check: (sql: string, context: ValidationContext) => RuleResult
  autoCorrect?: (sql: string, context: ValidationContext) => string
  severity: "error" | "warning"
}

export interface SqlValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  correctedSql: string
  autoCorrections: { rule: string; reason: string }[]
}

// Country keywords in Korean and English for detection
const COUNTRY_KEYWORDS = [
  "한국",
  "대한민국",
  "미국",
  "중국",
  "일본",
  "인도",
  "인도네시아",
  "베트남",
  "태국",
  "말레이시아",
  "싱가포르",
  "필리핀",
  "호주",
  "캐나다",
  "영국",
  "독일",
  "프랑스",
  "이탈리아",
  "스페인",
  "브라질",
  "멕시코",
  "러시아",
  "터키",
  "사우디",
  "korea",
  "united states",
  "usa",
  "china",
  "japan",
  "india",
  "indonesia",
  "vietnam",
  "thailand",
  "singapore",
  "malaysia",
  "philippines",
  "australia",
  "canada",
  "uk",
  "united kingdom",
  "germany",
  "france",
  "아시아",
  "동남아",
  "유럽",
  "asia",
  "southeast asia",
  "europe",
]

const validationRules: ValidationRule[] = [
  // Rule 1: Industry matching must use LIKE, not =
  {
    name: "industry-like-operator",
    severity: "error",
    check: (sql) => {
      // Check for industry = 'value' pattern (wrong)
      // But allow industry IN (...) which is valid for some cases
      const incorrectPattern = /\bindustry\s*=\s*'[^']+'/gi
      const hasIncorrect = incorrectPattern.test(sql)

      if (hasIncorrect) {
        return {
          passed: false,
          message: "Industry matching should use LIKE with wildcards, not exact equality (=)",
        }
      }
      return { passed: true }
    },
    autoCorrect: (sql) => {
      // Auto-correct: industry = 'value' -> LOWER(industry) LIKE '%value%'
      return sql.replace(/\bindustry\s*=\s*'([^']+)'/gi, "LOWER(industry) LIKE '%$1%'")
    },
  },

  // Rule 2: Country and industry conditions must use AND, not OR at top level
  {
    name: "country-industry-and",
    severity: "error",
    check: (sql) => {
      // Check for: country = 'X' OR LOWER(industry) or country = 'X' OR industry
      // This pattern is almost always wrong - country and industry should be AND
      const orPattern = /country\s*(?:=|IN)\s*(?:'[^']+'|\([^)]+\))\s+OR\s+(?:LOWER\()?industry/gi
      if (orPattern.test(sql)) {
        return {
          passed: false,
          message: "Country and industry conditions should be connected with AND, not OR",
        }
      }
      return { passed: true }
    },
    autoCorrect: (sql) => {
      // Replace: country = 'X' OR LOWER(industry) -> country = 'X' AND LOWER(industry)
      // Replace: country = 'X' OR industry -> country = 'X' AND industry
      return sql.replace(
        /(country\s*(?:=|IN)\s*(?:'[^']+'|\([^)]+\)))\s+OR\s+((?:LOWER\()?industry)/gi,
        "$1 AND $2",
      )
    },
  },

  // Rule 3: Industry LIKE must be wrapped in LOWER() for case-insensitive matching
  {
    name: "industry-case-insensitive",
    severity: "warning",
    check: (sql) => {
      // Check for industry LIKE without LOWER (but not LOWER(industry) LIKE)
      // Pattern: standalone "industry LIKE" not preceded by "LOWER("
      const matches = sql.match(/(?<!LOWER\()industry\s+LIKE\s+'%/gi)

      if (matches && matches.length > 0) {
        return {
          passed: false,
          message: "Industry LIKE should use LOWER() for case-insensitive matching",
        }
      }
      return { passed: true }
    },
    autoCorrect: (sql) => {
      // Replace: industry LIKE '%x%' -> LOWER(industry) LIKE '%x%'
      // But only if not already wrapped in LOWER()
      return sql.replace(/(?<!LOWER\()industry\s+LIKE\s+('%[^']+%')/gi, "LOWER(industry) LIKE $1")
    },
  },

  // Rule 4: Country should use exact match (=) or IN, not LIKE with wildcards
  {
    name: "country-exact-match",
    severity: "warning",
    check: (sql) => {
      const badPattern = /country\s+LIKE\s+'%[^']+%'/gi
      if (badPattern.test(sql)) {
        return {
          passed: false,
          message: "Country should use exact match (=) or IN clause, not LIKE with wildcards",
        }
      }
      return { passed: true }
    },
    // No auto-correct for this - it needs context to fix properly
  },

  // Rule 5: Must have LIMIT clause
  {
    name: "has-limit",
    severity: "error",
    check: (sql) => {
      if (!/\bLIMIT\s+\d+/i.test(sql)) {
        return {
          passed: false,
          message: "Query must have a LIMIT clause to prevent excessive data retrieval",
        }
      }
      return { passed: true }
    },
    autoCorrect: (sql) => {
      if (!/\bLIMIT\s+\d+/i.test(sql)) {
        return `${sql.trim()} LIMIT 150`
      }
      return sql
    },
  },

  // Rule 6: If query mentions a country/region, SQL must have country filter
  {
    name: "country-filter-required",
    severity: "error",
    check: (sql, context) => {
      const queryLower = context.originalQuery.toLowerCase()
      const hasCountryInQuery = COUNTRY_KEYWORDS.some((kw) => queryLower.includes(kw.toLowerCase()))

      if (hasCountryInQuery && !/country\s*(=|IN)/i.test(sql)) {
        return {
          passed: false,
          message: `Query mentions a location but SQL is missing country filter. Original query: "${context.originalQuery}"`,
        }
      }
      return { passed: true }
    },
    // No auto-correct - needs LLM to determine correct country
  },

  // Rule 7: LIKE patterns should have wildcards
  {
    name: "like-has-wildcards",
    severity: "warning",
    check: (sql) => {
      // Check for LIKE 'value' without any % wildcards
      // Match LIKE followed by a string that contains no %
      const likeWithoutWildcard = /LIKE\s+'([^'%]+)'/gi
      const matches = sql.match(likeWithoutWildcard)

      if (matches && matches.length > 0) {
        return {
          passed: false,
          message: "LIKE patterns should include % wildcards for partial matching",
        }
      }
      return { passed: true }
    },
    autoCorrect: (sql) => {
      // Add wildcards to LIKE patterns that don't have them
      return sql.replace(/LIKE\s+'([^'%]+)'/gi, "LIKE '%$1%'")
    },
  },

  // Rule 8: Must start with SELECT
  {
    name: "starts-with-select",
    severity: "error",
    check: (sql) => {
      const trimmed = sql.trim().toUpperCase()
      if (!trimmed.startsWith("SELECT")) {
        return {
          passed: false,
          message: "Query must start with SELECT",
        }
      }
      return { passed: true }
    },
    // No auto-correct - this is a fundamental error
  },
]

/**
 * Validates generated SQL and attempts auto-correction for common mistakes.
 *
 * @param sql - The generated SQL query
 * @param context - Validation context including original query and data dictionary
 * @returns Validation result with errors, warnings, and corrected SQL
 */
export const validateGeneratedSql = (
  sql: string,
  context: ValidationContext,
): SqlValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []
  const autoCorrections: { rule: string; reason: string }[] = []

  let correctedSql = sql

  for (const rule of validationRules) {
    const result = rule.check(correctedSql, context)

    if (!result.passed) {
      const message = `[${rule.name}] ${result.message}`

      if (rule.severity === "error") {
        errors.push(message)
      } else {
        warnings.push(message)
      }

      // Attempt auto-correction if available
      if (rule.autoCorrect) {
        const before = correctedSql
        correctedSql = rule.autoCorrect(correctedSql, context)

        if (before !== correctedSql) {
          autoCorrections.push({
            rule: rule.name,
            reason: result.message || rule.name,
          })
        }
      }
    }
  }

  // Re-validate after auto-corrections to see if issues are resolved
  const remainingErrors: string[] = []
  for (const rule of validationRules) {
    if (rule.severity === "error") {
      const result = rule.check(correctedSql, context)
      if (!result.passed) {
        remainingErrors.push(`[${rule.name}] ${result.message}`)
      }
    }
  }

  return {
    isValid: remainingErrors.length === 0,
    errors: remainingErrors,
    warnings,
    correctedSql,
    autoCorrections,
  }
}

/**
 * Gets a summary of validation errors suitable for LLM feedback.
 */
export const getValidationErrorSummary = (result: SqlValidationResult): string => {
  if (result.isValid) {
    return ""
  }

  const parts: string[] = []

  if (result.errors.length > 0) {
    parts.push("Errors that need fixing:")
    parts.push(...result.errors.map((e, i) => `${i + 1}. ${e}`))
  }

  if (result.warnings.length > 0) {
    parts.push("\nWarnings (may affect results):")
    parts.push(...result.warnings.map((w, i) => `${i + 1}. ${w}`))
  }

  return parts.join("\n")
}
