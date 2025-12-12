/**
 * FilterSearchForm Component
 * 조건 검색 모드에서 드롭다운을 통해 국가, 산업군 등을 선택하거나 자연어로 검색하는 폼
 */

import { ArrowRight, Loader2, RotateCcw } from "lucide-react"
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
  buildSearchQuery,
  COUNTRIES,
  EMPLOYEE_RANGES,
  INDUSTRIES,
  REGIONS,
  SUB_INDUSTRIES,
} from "../constants/data-dictionary"

interface FilterSearchFormProps {
  onSubmit: (query: string) => void
  isLoading?: boolean
  disabled?: boolean
}

export function FilterSearchForm({
  onSubmit,
  isLoading = false,
  disabled = false,
}: FilterSearchFormProps) {
  const [country, setCountry] = useState<string>("")
  const [region, setRegion] = useState<string>("")
  const [industry, setIndustry] = useState<string>("")
  const [subIndustry, setSubIndustry] = useState<string>("")
  const [employeeRange, setEmployeeRange] = useState<string>("")
  const [freeText, setFreeText] = useState<string>("") // 자연어 입력

  // 선택된 필터로 쿼리 생성
  const generatedQuery = useMemo(() => {
    // 자연어 입력이 있으면 우선 사용
    if (freeText.trim()) {
      return freeText.trim()
    }
    return buildSearchQuery({
      country,
      region,
      industry,
      subIndustry,
      employeeRange,
    })
  }, [country, region, industry, subIndustry, employeeRange, freeText])

  // 유효성 검사: 자연어 또는 최소 하나의 필터 선택 필요
  const isValid = useMemo(() => {
    return !!(freeText.trim() || country || region || industry || subIndustry)
  }, [freeText, country, region, industry, subIndustry])

  // 폼 초기화
  const handleReset = useCallback(() => {
    setCountry("")
    setRegion("")
    setIndustry("")
    setSubIndustry("")
    setEmployeeRange("")
    setFreeText("")
  }, [])

  // 제출
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!isValid || isLoading) return
      onSubmit(generatedQuery)
    },
    [isValid, isLoading, generatedQuery, onSubmit],
  )

  // 국가 선택 시 지역 초기화 (상호 배타적)
  const handleCountryChange = useCallback((value: string) => {
    setCountry(value)
    setRegion("")
  }, [])

  // 지역 선택 시 국가 초기화 (상호 배타적)
  const handleRegionChange = useCallback((value: string) => {
    setRegion(value)
    setCountry("")
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 자연어 입력 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">자연어로 검색</Label>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="예: 미국에 위치한 화장품 유통업체, 직원 50명 이상"
          disabled={disabled}
          rows={2}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">
          직접 입력하거나, 아래 드롭다운으로 조건을 선택하세요
        </p>
      </div>

      {/* 구분선 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">또는 조건 선택</span>
        </div>
      </div>

      {/* 국가/지역 선택 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">국가 또는 지역</Label>
        <div className="grid grid-cols-2 gap-2">
          {/* 국가 */}
          <Select value={country} onValueChange={handleCountryChange} disabled={disabled}>
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

          {/* 지역 */}
          <Select value={region} onValueChange={handleRegionChange} disabled={disabled}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="지역 선택" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {REGIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.labelKo} ({r.label})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 산업군 선택 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">산업군</Label>
        <Select value={industry} onValueChange={setIndustry} disabled={disabled}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="산업군 선택" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectGroup>
              <SelectLabel>기술/IT</SelectLabel>
              {INDUSTRIES.slice(0, 7).map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.labelKo} ({i.label})
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>제조</SelectLabel>
              {INDUSTRIES.slice(7, 15).map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.labelKo} ({i.label})
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>헬스케어</SelectLabel>
              {INDUSTRIES.slice(15, 19).map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.labelKo} ({i.label})
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>금융/전문서비스</SelectLabel>
              {INDUSTRIES.slice(19, 25).map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.labelKo} ({i.label})
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>소매/소비재</SelectLabel>
              {INDUSTRIES.slice(25, 30).map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.labelKo} ({i.label})
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>부동산/건설</SelectLabel>
              {INDUSTRIES.slice(30, 33).map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.labelKo} ({i.label})
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>기타</SelectLabel>
              {INDUSTRIES.slice(33).map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.labelKo} ({i.label})
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* 세부 산업군 (선택) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">세부 산업군 (선택)</Label>
        <Select value={subIndustry} onValueChange={setSubIndustry} disabled={disabled}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="세부 산업군 선택 (선택사항)" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectGroup>
              <SelectLabel>비즈니스 서비스</SelectLabel>
              {SUB_INDUSTRIES.slice(0, 5).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.labelKo}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>기술</SelectLabel>
              {SUB_INDUSTRIES.slice(5, 8).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.labelKo}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>헬스케어</SelectLabel>
              {SUB_INDUSTRIES.slice(8, 12).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.labelKo}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>제조</SelectLabel>
              {SUB_INDUSTRIES.slice(12, 18).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.labelKo}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>소매/도매</SelectLabel>
              {SUB_INDUSTRIES.slice(18, 22).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.labelKo}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>금융</SelectLabel>
              {SUB_INDUSTRIES.slice(22, 25).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.labelKo}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>부동산/건설</SelectLabel>
              {SUB_INDUSTRIES.slice(25, 28).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.labelKo}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>교육/호스피탈리티</SelectLabel>
              {SUB_INDUSTRIES.slice(28).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.labelKo}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* 직원 수 (선택) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">직원 수 (선택)</Label>
        <Select value={employeeRange} onValueChange={setEmployeeRange} disabled={disabled}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="직원 수 범위 선택 (선택사항)" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {EMPLOYEE_RANGES.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.labelKo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 생성된 쿼리 미리보기 */}
      {generatedQuery && (
        <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">검색 쿼리 미리보기</p>
          <p className="text-sm font-medium text-foreground">{generatedQuery}</p>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={disabled || isLoading}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          초기화
        </Button>
        <Button type="submit" disabled={!isValid || disabled || isLoading} className="flex-1 gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              검색 중...
            </>
          ) : (
            <>
              바이어 찾기
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
