/**
 * AnalysisSettings Component
 * - 웹사이트 분석 설정 (타임아웃 등)
 */

import { useAtom, useSetAtom } from "jotai"
import { Clock, RotateCcw, Settings, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  analysisSettingsAtom,
  DEFAULT_ANALYSIS_SETTINGS,
  resetAnalysisSettingsAtom,
  TIMEOUT_PRESETS,
  toggleAutoTimeoutAtom,
  updateCrawlTimeoutAtom,
} from "../store"

type AnalysisSettingsProps = {
  className?: string
  triggerClassName?: string
}

export function AnalysisSettingsButton({ className, triggerClassName }: AnalysisSettingsProps) {
  const [settings] = useAtom(analysisSettingsAtom)
  const updateTimeout = useSetAtom(updateCrawlTimeoutAtom)
  const toggleAutoTimeout = useSetAtom(toggleAutoTimeoutAtom)
  const resetSettings = useSetAtom(resetAnalysisSettingsAtom)

  const isModified =
    settings.crawlTimeoutSeconds !== DEFAULT_ANALYSIS_SETTINGS.crawlTimeoutSeconds ||
    settings.useAutoTimeout !== DEFAULT_ANALYSIS_SETTINGS.useAutoTimeout

  const currentPreset = TIMEOUT_PRESETS.find((p) => p.value === settings.crawlTimeoutSeconds)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "h-7 gap-1.5 text-xs",
            isModified && "border-primary text-primary",
            triggerClassName,
          )}
          size="sm"
          variant="outline"
        >
          <Settings className="h-3.5 w-3.5" />
          설정
          {isModified && <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn("w-80", className)}>
        <div className="space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">분석 설정</h4>
            {isModified && (
              <Button
                className="h-6 gap-1 text-xs"
                onClick={() => resetSettings()}
                size="sm"
                variant="ghost"
              >
                <RotateCcw className="h-3 w-3" />
                초기화
              </Button>
            )}
          </div>

          {/* 자동 타임아웃 토글 */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <div>
                <Label className="font-medium text-sm" htmlFor="auto-timeout">
                  자동 타임아웃
                </Label>
                <p className="text-muted-foreground text-xs">사이트 응답 속도에 따라 자동 조정</p>
              </div>
            </div>
            <Switch
              checked={settings.useAutoTimeout}
              id="auto-timeout"
              onCheckedChange={() => toggleAutoTimeout()}
            />
          </div>

          {/* 수동 타임아웃 설정 */}
          {!settings.useAutoTimeout && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium text-sm">크롤링 타임아웃</Label>
              </div>

              {/* 프리셋 버튼들 */}
              <div className="grid grid-cols-2 gap-2">
                {TIMEOUT_PRESETS.map((preset) => (
                  <button
                    className={cn(
                      "flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors",
                      "hover:bg-muted/50",
                      settings.crawlTimeoutSeconds === preset.value &&
                        "border-primary bg-primary/5",
                    )}
                    key={preset.value}
                    onClick={() => updateTimeout(preset.value)}
                    type="button"
                  >
                    <span className="font-medium text-sm">{preset.label}</span>
                    <span className="text-muted-foreground text-xs">{preset.description}</span>
                  </button>
                ))}
              </div>

              {/* 커스텀 슬라이더 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">커스텀</span>
                  <span className="font-mono text-sm">{settings.crawlTimeoutSeconds}초</span>
                </div>
                <Input
                  className="h-2 cursor-pointer"
                  max={180}
                  min={5}
                  onChange={(e) => updateTimeout(Number(e.target.value))}
                  step={5}
                  type="range"
                  value={settings.crawlTimeoutSeconds}
                />
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>5초</span>
                  <span>3분</span>
                </div>
              </div>
            </div>
          )}

          {/* 현재 설정 요약 */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-muted-foreground text-xs">
              {settings.useAutoTimeout ? (
                <>
                  <strong className="text-foreground">자동 모드:</strong> 사이트 응답 속도에 따라
                  타임아웃이 자동으로 조정됩니다.
                </>
              ) : (
                <>
                  <strong className="text-foreground">수동 모드:</strong>{" "}
                  {currentPreset
                    ? `${currentPreset.label} - ${currentPreset.description}`
                    : `${settings.crawlTimeoutSeconds}초로 설정됨`}
                </>
              )}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
