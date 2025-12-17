/**
 * FilterSearchForm Component
 * 조건 검색 모드에서 드롭다운을 통해 국가/지역을 선택하거나 자연어로 검색하는 폼
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
import { COUNTRIES, REGIONS } from "../constants/data-dictionary"

type FilterSearchFormProps = {
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
  const [freeText, setFreeText] = useState<string>("") // 자연어 입력

  // 선택된 필터로 쿼리 생성 (자연어 + 국가/지역 조합)
  const generatedQuery = useMemo(() => {
    const parts: string[] = []

    // 자연어 입력이 있으면 추가
    if (freeText.trim()) {
      parts.push(freeText.trim())
    }

    // 국가 또는 지역 추가
    if (country) {
      const countryOption = COUNTRIES.find((c) => c.value === country)
      if (countryOption) {
        parts.push(`국가: ${countryOption.labelKo}`)
      }
    } else if (region) {
      const regionOption = REGIONS.find((r) => r.value === region)
      if (regionOption) {
        parts.push(`지역: ${regionOption.labelKo}`)
      }
    }

    return parts.join(", ")
  }, [country, region, freeText])

  // 유효성 검사: 자연어 또는 국가/지역 선택 필요
  const isValid = useMemo(
    () => !!(freeText.trim() || country || region),
    [freeText, country, region],
  )

  // 폼 초기화
  const handleReset = useCallback(() => {
    setCountry("")
    setRegion("")
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
    <form aria-label="조건 검색 폼" className="space-y-5" onSubmit={handleSubmit}>
      {/* 자연어 입력 */}
      <div className="space-y-2">
        <Label className="font-medium text-foreground text-sm" htmlFor="free-text-search">
          자연어로 검색
        </Label>
        <textarea
          aria-describedby="free-text-hint"
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          id="free-text-search"
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="예: 화장품 유통업체"
          rows={2}
          value={freeText}
        />
        <p className="text-muted-foreground text-xs" id="free-text-hint">
          직접 입력하거나, 아래 드롭다운으로 조건을 선택하세요
        </p>
      </div>

      {/* 구분선 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-border border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">또는 조건 선택</span>
        </div>
      </div>

      {/* 국가/지역 선택 */}
      <div className="space-y-2">
        <Label className="font-medium text-foreground text-sm">국가 또는 지역</Label>
        <div className="grid grid-cols-2 gap-2">
          {/* 국가 */}
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

          {/* 지역 */}
          <Select disabled={disabled} onValueChange={handleRegionChange} value={region}>
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

      {/* 버튼 */}
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
    </form>
  )
}
