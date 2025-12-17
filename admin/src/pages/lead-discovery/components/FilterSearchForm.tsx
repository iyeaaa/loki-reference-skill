/**
 * FilterSearchForm Component
 * 조건 검색 모드에서 드롭다운(고급 옵션) 또는 자연어로 검색하는 폼
 */

import { ArrowRight, Loader2, RotateCcw, Search } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  COUNTRIES,
  EMPLOYEE_RANGES,
  INDUSTRIES,
  SUB_INDUSTRIES,
} from "../constants/data-dictionary"

type FilterSearchFormProps = {
  onSubmit: (query: string) => void
  isLoading?: boolean
  disabled?: boolean
  mode?: "input" | "click"
  compact?: boolean
}

export function FilterSearchForm({
  onSubmit,
  isLoading = false,
  disabled = false,
  mode = "input",
  compact = false,
}: FilterSearchFormProps) {
  const [country, setCountry] = useState<string>("")
  const [industry, setIndustry] = useState<string>("")
  const [subIndustry, setSubIndustry] = useState<string>("")
  const [employeeRange, setEmployeeRange] = useState<string>("")
  const [freeText, setFreeText] = useState<string>("") // 자연어 입력

  const extractedFromFreeText = useMemo(() => {
    const q = freeText.trim()
    if (!q) {
      return {}
    }

    const lower = q.toLowerCase()

    const countryFromText = COUNTRIES.find((c) => {
      const ko = c.labelKo?.trim()
      if (ko && q.includes(ko)) {
        return true
      }
      if (c.label && lower.includes(c.label.toLowerCase())) {
        return true
      }
      if (c.value && lower.includes(c.value.toLowerCase())) {
        return true
      }
      return false
    })?.value

    const employeeRangeFromText =
      EMPLOYEE_RANGES.find((e) => {
        const ko = e.labelKo?.trim()
        if (ko && q.includes(ko)) {
          return true
        }
        if (e.label && lower.includes(e.label.toLowerCase())) {
          return true
        }
        if (e.value && lower.includes(e.value.toLowerCase())) {
          return true
        }
        return false
      })?.value ??
      (() => {
        const match = q
          .replaceAll(",", "")
          .match(/(\d{1,5})\s*(?:-|~|–|—|to)\s*(\d{1,5}|\+)\s*(?:명|employees?)?/i)
        if (!match) {
          return
        }
        const left = match[1]
        const right = match[2]
        const normalized = right === "+" ? `${left}+` : `${left}-${right}`
        return EMPLOYEE_RANGES.find((e) => e.value.replaceAll(",", "") === normalized)?.value
      })()

    const subIndustryFromText = SUB_INDUSTRIES.find((s) => {
      const ko = s.labelKo?.trim()
      if (ko && q.includes(ko)) {
        return true
      }
      if (s.label && lower.includes(s.label.toLowerCase())) {
        return true
      }
      if (s.value && lower.includes(s.value.toLowerCase())) {
        return true
      }
      return false
    })?.value

    const industryFromText = INDUSTRIES.find((i) => {
      const ko = i.labelKo?.trim()
      if (ko && q.includes(ko)) {
        return true
      }
      if (i.label && lower.includes(i.label.toLowerCase())) {
        return true
      }
      if (i.value && lower.includes(i.value.toLowerCase())) {
        return true
      }
      // 동의어/유사어 검색
      if (i.synonyms?.some((syn) => lower.includes(syn.toLowerCase()))) {
        return true
      }
      return false
    })?.value

    return {
      country: countryFromText,
      industry: industryFromText,
      subIndustry: subIndustryFromText,
      employeeRange: employeeRangeFromText,
    }
  }, [freeText])

  // 선택된 필터로 쿼리 생성 (자연어 + 고급 옵션 조합)
  const generatedQuery = useMemo(() => {
    const parts: string[] = []

    // 자연어 입력이 있으면 추가
    if (mode === "input" && freeText.trim()) {
      parts.push(freeText.trim())
    }

    const resolvedCountry = mode === "input" ? extractedFromFreeText.country : country
    const resolvedIndustry = mode === "input" ? extractedFromFreeText.industry : industry
    const resolvedSubIndustry = mode === "input" ? extractedFromFreeText.subIndustry : subIndustry
    const resolvedEmployeeRange =
      mode === "input" ? extractedFromFreeText.employeeRange : employeeRange

    // 국가 추가
    if (resolvedCountry) {
      const countryOption = COUNTRIES.find((c) => c.value === resolvedCountry)
      if (countryOption) {
        parts.push(`국가: ${countryOption.labelKo}`)
      }
    }

    // 산업/섹터
    if (resolvedIndustry) {
      const industryOption = INDUSTRIES.find((i) => i.value === resolvedIndustry)
      parts.push(`산업: ${industryOption?.labelKo || resolvedIndustry}`)
    }

    // 세부 산업
    if (resolvedSubIndustry) {
      const subIndustryOption = SUB_INDUSTRIES.find((s) => s.value === resolvedSubIndustry)
      parts.push(`세부산업: ${subIndustryOption?.labelKo || resolvedSubIndustry}`)
    }

    // 직원수(Company Size)
    if (resolvedEmployeeRange) {
      const employeeOption = EMPLOYEE_RANGES.find((e) => e.value === resolvedEmployeeRange)
      parts.push(
        `직원수: ${employeeOption?.labelKo || employeeOption?.label || resolvedEmployeeRange}`,
      )
    }

    return parts.join(", ")
  }, [country, employeeRange, extractedFromFreeText, freeText, industry, mode, subIndustry])

  // 유효성 검사: 자연어 또는 필터 1개 이상 선택 필요
  const isValid = useMemo(() => {
    if (mode === "click") {
      return Boolean(country && industry)
    }
    return freeText.trim().length > 0
  }, [country, freeText, industry, mode])

  // 폼 초기화
  const handleReset = useCallback(() => {
    setCountry("")
    setIndustry("")
    setSubIndustry("")
    setEmployeeRange("")
    setFreeText("")
  }, [])

  // 제출
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!isValid || isLoading) {
        return
      }
      onSubmit(generatedQuery)
    },
    [isValid, isLoading, generatedQuery, onSubmit],
  )

  const handleCountryChange = useCallback((value: string) => {
    setCountry(value)
  }, [])

  return (
    <form
      aria-label="조건 검색 폼"
      className={compact ? "space-y-3" : "space-y-5"}
      onSubmit={handleSubmit}
    >
      {/* 입력해서 찾기: 웹사이트 모드와 동일한 구조 */}
      {mode === "input" && (
        <>
          <textarea
            aria-label="찾고 싶은 바이어 조건 입력"
            className="min-h-[72px] w-full resize-none border-0 bg-transparent px-4 pt-4 pb-2 text-base outline-none placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (isValid && !isLoading) {
                  onSubmit(generatedQuery)
                }
              }
            }}
            placeholder="예: 미국 B2B SaaS 기업, 독일 헬스케어 51-200명 규모"
            rows={3}
            value={freeText}
          />
          <div className="flex items-center justify-end px-4 pb-3">
            <Button
              aria-label={isLoading ? "검색 중..." : "바이어 찾기 시작"}
              className="gap-2"
              disabled={!isValid || disabled || isLoading}
              size="sm"
              type="submit"
            >
              {isLoading ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  바이어 찾기
                  <Search aria-hidden="true" className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* 클릭하여 찾기: 고급 옵션만(숨김 없음) + 국가/산업 필수 */}
      {mode === "click" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="font-medium text-foreground text-sm">조건 선택</Label>
            <p className="text-muted-foreground text-xs">* 국가 / 산업은 필수</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 국가 */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">국가 *</Label>
              <Select disabled={disabled} onValueChange={handleCountryChange} value={country}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="국가 선택" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectGroup>
                    <SelectLabel>주요 국가</SelectLabel>
                    {COUNTRIES.slice(0, 9).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.labelKo} ({c.label})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>아시아</SelectLabel>
                    {COUNTRIES.slice(9, 18).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.labelKo} ({c.label})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>유럽</SelectLabel>
                    {COUNTRIES.slice(18, 30).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.labelKo} ({c.label})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>중동/아프리카</SelectLabel>
                    {COUNTRIES.slice(30, 34).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.labelKo} ({c.label})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>아메리카</SelectLabel>
                    {COUNTRIES.slice(34, 39).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.labelKo} ({c.label})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>오세아니아</SelectLabel>
                    {COUNTRIES.slice(39).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.labelKo} ({c.label})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* 직원수 */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">직원수</Label>
              <Select
                disabled={disabled}
                onValueChange={(value) => setEmployeeRange(value)}
                value={employeeRange}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="직원수 선택" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {EMPLOYEE_RANGES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.labelKo} ({e.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 산업/섹터 */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">산업/섹터 *</Label>
              <Select
                disabled={disabled}
                onValueChange={(value) => setIndustry(value)}
                value={industry}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="산업 선택" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.labelKo} ({i.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 세부 산업 */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">세부 산업</Label>
              <Select
                disabled={disabled}
                onValueChange={(value) => setSubIndustry(value)}
                value={subIndustry}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="세부 산업 선택" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {SUB_INDUSTRIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.labelKo} ({s.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* 버튼: 클릭하여 찾기 모드에서만 표시 */}
      {mode === "click" && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            aria-label="검색 조건 초기화"
            className="gap-1.5"
            disabled={disabled || isLoading}
            onClick={handleReset}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            초기화
          </Button>
          <Button
            aria-label={isLoading ? "바이어 검색 중..." : "선택한 조건으로 바이어 찾기"}
            className="flex-1 gap-2"
            disabled={!isValid || disabled || isLoading}
            type="submit"
          >
            {isLoading ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                <span aria-live="polite">검색 중...</span>
              </>
            ) : (
              <>
                바이어 찾기
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </form>
  )
}
