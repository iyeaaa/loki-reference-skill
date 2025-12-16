import { Button } from "@/components/ui/button"

export default function TailwindTestPage() {
  return (
    <div className="space-y-12 p-8">
      <div>
        <h1 className="mb-2 font-bold text-3xl">Tailwind CSS 색상 테스트</h1>
        <p className="text-muted-foreground">
          모든 색상 변수가 제대로 적용되는지 확인하는 테스트 페이지
        </p>
      </div>

      {/* CSS 변수 직접 테스트 */}
      <section className="space-y-4">
        <h2 className="font-semibold text-2xl">1. CSS 변수 직접 적용 테스트</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <p className="mb-2 font-medium">Primary (bg-primary)</p>
            <div className="flex h-20 items-center justify-center rounded bg-primary text-primary-foreground">
              bg-primary
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-2 font-medium">Secondary (bg-secondary)</p>
            <div className="flex h-20 items-center justify-center rounded bg-secondary text-secondary-foreground">
              bg-secondary
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-2 font-medium">Accent (bg-accent)</p>
            <div className="flex h-20 items-center justify-center rounded bg-accent text-accent-foreground">
              bg-accent
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-2 font-medium">Destructive (bg-destructive)</p>
            <div className="flex h-20 items-center justify-center rounded bg-destructive text-destructive-foreground">
              bg-destructive
            </div>
          </div>
        </div>
      </section>

      {/* Button 컴포넌트 variants 테스트 */}
      <section className="space-y-4">
        <h2 className="font-semibold text-2xl">2. Button 컴포넌트 Variants</h2>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="mb-3 font-medium">Default Variant</p>
            <div className="flex gap-2">
              <Button variant="default">Default Button</Button>
              <Button disabled variant="default">
                Disabled
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 font-medium">Secondary Variant</p>
            <div className="flex gap-2">
              <Button variant="secondary">Secondary Button</Button>
              <Button disabled variant="secondary">
                Disabled
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 font-medium">Outline Variant</p>
            <div className="flex gap-2">
              <Button variant="outline">Outline Button</Button>
              <Button disabled variant="outline">
                Disabled
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 font-medium">Destructive Variant</p>
            <div className="flex gap-2">
              <Button variant="destructive">Destructive Button</Button>
              <Button disabled variant="destructive">
                Disabled
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 font-medium">Ghost Variant</p>
            <div className="flex gap-2">
              <Button variant="ghost">Ghost Button</Button>
              <Button disabled variant="ghost">
                Disabled
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 font-medium">Link Variant</p>
            <div className="flex gap-2">
              <Button variant="link">Link Button</Button>
              <Button disabled variant="link">
                Disabled
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 페이지네이션 시뮬레이션 */}
      <section className="space-y-4">
        <h2 className="font-semibold text-2xl">3. 페이지네이션 버튼 시뮬레이션</h2>
        <div className="rounded-lg border p-4">
          <p className="mb-3 font-medium">선택된 페이지 vs 선택 안 된 페이지</p>
          <div className="flex gap-2">
            <Button className="min-w-[40px] px-3" size="sm" variant="secondary">
              1
            </Button>
            <Button className="min-w-[40px] px-3" size="sm" variant="default">
              2 (선택됨)
            </Button>
            <Button className="min-w-[40px] px-3" size="sm" variant="secondary">
              3
            </Button>
            <Button className="min-w-[40px] px-3" size="sm" variant="secondary">
              4
            </Button>
            <Button className="min-w-[40px] px-3" size="sm" variant="secondary">
              5
            </Button>
          </div>
        </div>
      </section>

      {/* Button 사이즈 테스트 */}
      <section className="space-y-4">
        <h2 className="font-semibold text-2xl">4. Button 사이즈 테스트</h2>
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <span className="w-20 text-sm">Small:</span>
            <Button size="sm" variant="default">
              Small
            </Button>
            <Button size="sm" variant="secondary">
              Small
            </Button>
            <Button size="sm" variant="outline">
              Small
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-sm">Default:</span>
            <Button size="default" variant="default">
              Default
            </Button>
            <Button size="default" variant="secondary">
              Default
            </Button>
            <Button size="default" variant="outline">
              Default
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-sm">Large:</span>
            <Button size="lg" variant="default">
              Large
            </Button>
            <Button size="lg" variant="secondary">
              Large
            </Button>
            <Button size="lg" variant="outline">
              Large
            </Button>
          </div>
        </div>
      </section>

      {/* 인라인 스타일 테스트 */}
      <section className="space-y-4">
        <h2 className="font-semibold text-2xl">5. 인라인 CSS 변수 테스트</h2>
        <div className="space-y-3 rounded-lg border p-4">
          <div
            className="flex h-20 items-center justify-center rounded font-medium text-white"
            style={{ backgroundColor: "hsl(222.2 47.4% 11.2%)" }}
          >
            HSL: hsl(222.2 47.4% 11.2%) - Primary (라이트 모드)
          </div>
          <div
            className="flex h-20 items-center justify-center rounded font-medium"
            style={{
              backgroundColor: "hsl(210 40% 96.1%)",
              color: "hsl(222.2 47.4% 11.2%)",
            }}
          >
            HSL: hsl(210 40% 96.1%) - Secondary (라이트 모드)
          </div>
        </div>
      </section>

      {/* 다크모드 테스트 안내 */}
      <section className="space-y-4">
        <h2 className="font-semibold text-2xl">6. 다크 모드 테스트</h2>
        <div className="rounded-lg border bg-yellow-50 p-4 dark:bg-yellow-950">
          <p className="mb-2 font-medium">💡 테스트 방법</p>
          <ol className="list-inside list-decimal space-y-1 text-sm">
            <li>브라우저의 다크 모드를 켜고 끄면서 색상 변화를 확인하세요</li>
            <li>선택된 페이지네이션 버튼이 명확히 구분되는지 확인하세요</li>
            <li>라이트 모드: primary는 검정, secondary는 밝은 회색이어야 합니다</li>
            <li>다크 모드: primary는 흰색, secondary는 중간 회색이어야 합니다</li>
          </ol>
        </div>
      </section>

      {/* CSS 변수 값 표시 */}
      <section className="space-y-4">
        <h2 className="font-semibold text-2xl">7. 현재 CSS 변수 값</h2>
        <div className="space-y-2 rounded-lg border p-4 font-mono text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>--primary:</div>
            <div className="font-bold">222.2 47.4% 11.2%</div>
            <div>--secondary:</div>
            <div className="font-bold">210 40% 96.1%</div>
            <div>--background:</div>
            <div className="font-bold">0 0% 100%</div>
            <div>--foreground:</div>
            <div className="font-bold">222.2 84% 4.9%</div>
          </div>
        </div>
      </section>
    </div>
  )
}
