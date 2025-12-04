import { useAtom, useSetAtom } from "jotai"
import { Globe, Lightbulb, Loader2, Send, SlidersHorizontal } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import TextPlus from "@/assets/text-plus.svg"
import TextRinda from "@/assets/text-rinda.svg"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type SearchMode = "website" | "detailed"

import {
  addChatMessageAtom,
  addCustomersAtom,
  type ChatMessage,
  type Customer,
  chatMessagesAtom,
  isLoadingAtom,
} from "./store"

// 임시 고객 생성 함수 (실제로는 AI API 응답으로 대체)
function generateMockCustomers(query: string): Customer[] {
  const count = 100
  const companies = [
    "Tesla Inc.",
    "Google LLC",
    "Apple Inc.",
    "Microsoft Corporation",
    "Amazon.com Inc.",
    "Meta Platforms Inc.",
    "Netflix Inc.",
    "Spotify Technology",
    "Salesforce Inc.",
    "Adobe Systems",
    "Oracle Corporation",
    "IBM Corporation",
    "Intel Corporation",
    "Cisco Systems",
    "NVIDIA Corporation",
    "PayPal Holdings",
    "Uber Technologies",
    "Airbnb Inc.",
    "Shopify Inc.",
    "Square Inc.",
    "Zoom Video",
    "Slack Technologies",
    "Dropbox Inc.",
    "HubSpot Inc.",
    "Atlassian Corporation",
    "ServiceNow Inc.",
    "Workday Inc.",
    "Snowflake Inc.",
    "Datadog Inc.",
    "Twilio Inc.",
    "Stripe Inc.",
    "Coinbase Global",
    "Robinhood Markets",
    "DoorDash Inc.",
    "Instacart Inc.",
    "Lyft Inc.",
    "Pinterest Inc.",
    "Snap Inc.",
    "Twitter Inc.",
    "LinkedIn Corporation",
  ]
  const firstNames = [
    "John",
    "Jane",
    "Michael",
    "Sarah",
    "David",
    "Emily",
    "Robert",
    "Jessica",
    "William",
    "Ashley",
    "James",
    "Amanda",
    "Daniel",
    "Stephanie",
    "Christopher",
    "Nicole",
    "Matthew",
    "Elizabeth",
    "Andrew",
    "Jennifer",
    "Joseph",
    "Megan",
    "Anthony",
    "Rachel",
    "Mark",
    "Lauren",
    "Steven",
    "Samantha",
    "Paul",
    "Katherine",
  ]
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "Martin",
    "Lee",
    "Perez",
    "Thompson",
    "White",
    "Harris",
    "Sanchez",
    "Clark",
    "Ramirez",
    "Lewis",
    "Robinson",
  ]
  const titles = [
    "CEO",
    "CTO",
    "CFO",
    "COO",
    "VP Sales",
    "VP Marketing",
    "VP Engineering",
    "Director of Sales",
    "Director of Marketing",
    "Director of Operations",
    "Manager",
    "Lead Engineer",
    "Senior Developer",
    "Product Manager",
    "Business Development Manager",
    "Account Executive",
  ]
  const industries = [
    "Software & Internet",
    "Business Services",
    "Manufacturing",
    "Financial Services",
    "Healthcare",
    "Retail",
    "Real Estate & Construction",
    "Computers & Electronics",
    "Education",
    "Media & Entertainment",
  ]
  const subIndustries = [
    "SaaS",
    "Cloud Computing",
    "E-commerce",
    "Fintech",
    "Consulting",
    "AI/ML",
    "Cybersecurity",
    "Data Analytics",
    "Mobile Apps",
    "IoT",
  ]
  const countries = ["USA", "Canada"]
  const cities = [
    "San Francisco",
    "New York",
    "Seattle",
    "Austin",
    "Boston",
    "Toronto",
    "Los Angeles",
    "Chicago",
    "Denver",
    "Miami",
    "Atlanta",
    "Dallas",
    "Portland",
    "Phoenix",
    "San Diego",
    "Vancouver",
    "Montreal",
    "Calgary",
  ]
  const states = [
    "CA",
    "NY",
    "WA",
    "TX",
    "MA",
    "ON",
    "IL",
    "CO",
    "FL",
    "GA",
    "OR",
    "AZ",
    "BC",
    "QC",
    "AB",
  ]
  const employeeRanges = ["0 - 25", "25 - 100", "100 - 250", "250 - 1000", "1K - 10K", "10K - 50K"]
  const revenueRanges = [
    "$0 - $1M",
    "$1 - $10M",
    "$10 - $50M",
    "$50 - $100M",
    "$100 - $250M",
    "$250 - $500M",
  ]

  return Array.from({ length: count }, (_, i) => ({
    id: `cust-${Date.now()}-${i}`,
    first_name: firstNames[Math.floor(Math.random() * firstNames.length)],
    last_name: lastNames[Math.floor(Math.random() * lastNames.length)],
    title: titles[Math.floor(Math.random() * titles.length)],
    company_name: companies[Math.floor(Math.random() * companies.length)],
    email: `${firstNames[Math.floor(Math.random() * firstNames.length)].toLowerCase()}.${lastNames[Math.floor(Math.random() * lastNames.length)].toLowerCase()}${Math.floor(Math.random() * 100)}@${companies[Math.floor(Math.random() * companies.length)].toLowerCase().replace(/[^a-z]/g, "")}.com`,
    phone: `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    web_address: `www.${companies[Math.floor(Math.random() * companies.length)].toLowerCase().replace(/[^a-z]/g, "")}.com`,
    country: countries[Math.floor(Math.random() * countries.length)],
    primary_city: cities[Math.floor(Math.random() * cities.length)],
    primary_state: states[Math.floor(Math.random() * states.length)],
    industry: industries[Math.floor(Math.random() * industries.length)],
    sub_industry: subIndustries[Math.floor(Math.random() * subIndustries.length)],
    employee: employeeRanges[Math.floor(Math.random() * employeeRanges.length)],
    revenue: revenueRanges[Math.floor(Math.random() * revenueRanges.length)],
    source: query,
    createdAt: new Date(),
  }))
}

export function ChatRoom() {
  const [messages] = useAtom(chatMessagesAtom)
  const addMessage = useSetAtom(addChatMessageAtom)
  const addCustomers = useSetAtom(addCustomersAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)

  const [input, setInput] = useState("")
  const [searchMode, setSearchMode] = useState<SearchMode>("website")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 스크롤 맨 아래로 - 메시지 추가시 자동 스크롤
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // 웹사이트 URL 유효성 검사
  const isValidWebsiteUrl = useCallback((url: string): boolean => {
    const trimmed = url.trim().toLowerCase()
    // URL 패턴: 도메인 형식 검사 (http(s):// 없어도 허용)
    const urlPattern =
      /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/
    return urlPattern.test(trimmed)
  }, [])

  // 입력값 유효성 검사
  const isInputValid = useCallback((): boolean => {
    const trimmed = input.trim()
    if (!trimmed) return false
    if (searchMode === "website") {
      return isValidWebsiteUrl(trimmed)
    }
    // 상세 조건 모드: 최소 2자 이상
    return trimmed.length >= 2
  }, [input, searchMode, isValidWebsiteUrl])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!isInputValid() || isLoading) return

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: input.trim(),
        timestamp: new Date(),
      }

      addMessage(userMessage)
      setInput("")
      setIsLoading(true)

      // 시뮬레이션: AI 응답 및 고객 생성
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))

      const newCustomers = generateMockCustomers(input.trim())
      addCustomers(newCustomers)

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-response`,
        role: "assistant",
        content:
          searchMode === "website"
            ? `"${input.trim()}" 웹사이트 분석 결과, ${newCustomers.length}명의 잠재 고객을 발견했습니다.`
            : `"${input.trim()}" 조건에 맞는 ${newCustomers.length}명의 잠재 고객을 발견했습니다.`,
        timestamp: new Date(),
        customersAdded: newCustomers,
      }

      addMessage(assistantMessage)
      setIsLoading(false)
    },
    [input, isLoading, isInputValid, searchMode, addMessage, addCustomers, setIsLoading],
  )

  return (
    <div className="flex flex-col h-full min-h-0 bg-background border-r border-border">
      {/* 메시지 영역 - flex-1 + min-h-0으로 스크롤 영역 확보 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="text-center max-w-xs space-y-5">
              {/* 로고 */}
              <div className="flex justify-center items-center gap-2">
                <img src={TextRinda} alt="RINDA" className="h-8 w-auto" />
                <img src={TextPlus} alt="Plus" className="h-8 w-auto" />
              </div>

              {/* 타이틀 */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  해외 영업, 이제 혼자 고민하지 마세요
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AI가 진출 가능한 시장을 찾고, 전략을 짜고,
                  <br />
                  바로 영업까지 시작해드립니다
                </p>
              </div>

              {/* 빠른 시작 */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 justify-center">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-xs text-muted-foreground">
                    빠른 시작 - 예시를 클릭하면 바로 시작할 수 있어요
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "제조업 베트남 진출",
                    "SaaS 일본 진출",
                    "뷰티 미국 진출",
                    "식품 동남아 진출",
                  ].map((example) => (
                    <Button
                      key={example}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchMode("detailed")
                        setInput(example)
                        inputRef.current?.focus()
                      }}
                      className="h-7 px-3 text-xs rounded-full hover:bg-primary hover:text-primary-foreground"
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea
            className="h-full [&>[data-radix-scroll-area-viewport]]:!overflow-y-scroll"
            ref={scrollRef}
          >
            <div className="p-4 pt-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-4 py-2",
                      message.role === "user"
                        ? "bg-zinc-100 dark:bg-zinc-800 text-foreground"
                        : "bg-zinc-100 dark:bg-zinc-800",
                    )}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.customersAdded && message.customersAdded.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs opacity-70">
                          추가된 고객:{" "}
                          {message.customersAdded
                            .map((c) => c.company_name || `${c.first_name} ${c.last_name}`)
                            .join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* 입력 영역 - 하단 고정 */}
      <div className="shrink-0 p-3 border-t bg-background">
        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl bg-muted/50 border border-border/50 overflow-hidden">
            {/* 모드 선택 버튼 - 입력창 상단 내부 */}
            <div className="flex border-b border-border/30">
              <button
                type="button"
                onClick={() => setSearchMode("website")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
                  searchMode === "website"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                웹사이트로 탐색
              </button>
              <button
                type="button"
                onClick={() => setSearchMode("detailed")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
                  searchMode === "detailed"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                상세 조건 탐색
              </button>
            </div>

            {/* 입력창 */}
            <div className="relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  searchMode === "website"
                    ? "https://www.example.com"
                    : "예: 친환경 화장품 제조, 미국 캘리포니아 진출 희망"
                }
                disabled={isLoading}
                className="pr-12 h-11 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !isInputValid()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
