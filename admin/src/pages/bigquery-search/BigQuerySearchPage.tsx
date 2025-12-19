import { AnimatePresence, motion } from "framer-motion"
import {
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Copy,
  Database,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Mail,
  Plus,
  Send,
  Sparkles,
  Table,
  Trash2,
  User,
  X,
} from "lucide-react"
import { memo, useCallback, useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UITable,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { API_BASE_URL } from "@/lib/env"
import { cn } from "@/lib/utils"

// Enrichment 결과 타입
type EnrichmentResult = {
  domain: string
  emails: Array<{
    value: string
    type: string
    confidence?: number
  }>
  companyInfo: {
    name?: string
    description?: string
    industry?: string
    size?: string
    founded?: string
    location?: string
  }
  socialLinks: {
    linkedin?: string
    twitter?: string
    facebook?: string
  }
  rawContent?: string
}

// 데이터베이스 타입
type DatabaseType = "b2b_leads" | "crunchbase"

// 데이터베이스별 설정
const DATABASE_OPTIONS: Record<DatabaseType, { label: string; description: string; icon: string }> =
  {
    b2b_leads: {
      label: "B2B Leads",
      description: "USA & Canada (100만+ 리드)",
      icon: "🇺🇸",
    },
    crunchbase: {
      label: "Crunchbase",
      description: "Global (200만+ 기업)",
      icon: "🌍",
    },
  }

// 데이터 사전 (BigQuery 테이블별 메타데이터)
const DATA_DICTIONARIES: Record<
  DatabaseType,
  {
    tableName: string
    columns: string[]
    industries: string[]
    countries: string[]
    employeeRanges: string[]
    revenueRanges: string[]
  }
> = {
  b2b_leads: {
    tableName: "sendgrinda-leads.leads.lead_csv_data*",
    columns: [
      "first_name",
      "middle_name",
      "last_name",
      "title",
      "company_name",
      "mailing_address",
      "primary_city",
      "primary_state",
      "zip_code",
      "country",
      "phone",
      "web_address",
      "email",
      "revenue",
      "employee",
      "industry",
      "sub_industry",
    ],
    industries: [
      "Business Services",
      "Manufacturing",
      "Retail",
      "Financial Services",
      "Healthcare",
      "Real Estate & Construction",
      "Computers & Electronics",
      "Software & Internet",
      "Education",
      "Media & Entertainment",
      "Consumer Services",
      "Travel, Recreation, and Leisure",
      "Telecommunications",
      "Non-Profit",
      "Transportation & Storage",
      "Other",
      "Energy & Utilities",
      "Wholesale & Distribution",
      "Government",
      "Agriculture & Mining",
      "Retail & Wholesale",
      "Services (Miscellaneous)",
      "Food & Beverage",
      "Travel & Accommodation",
      "Recreation & Leisure",
      "Conglomerates",
    ],
    countries: ["USA", "Canada"],
    employeeRanges: [
      "0 - 25",
      "25 - 100",
      "100 - 250",
      "250 - 1000",
      "1K - 10K",
      "10K - 50K",
      "50K - 100K",
      "> 100K",
    ],
    revenueRanges: [
      "$0 - $1M",
      "$0 - 1M",
      "$1 - $10M",
      "$1 - 10M",
      "$10 - $50M",
      "$10 - 50M",
      "$50 - $100M",
      "$50 - 100M",
      "$100 - $250M",
      "$100 - 250M",
      "$250 - $500M",
      "$250 - 500M",
      "$500M - $1B",
      "$500M - 1B",
      "> $1B",
    ],
  },
  crunchbase: {
    tableName: "sendgrinda-leads.leads.crunchbase_all",
    columns: [
      "first_name",
      "last_name",
      "title",
      "email",
      "company",
      "website",
      "country",
      "industry",
      "employees",
      "revenue",
      "phone",
      "description",
      "linkedin",
      "facebook",
      "twitter",
    ],
    industries: [
      "Software",
      "Information Technology",
      "Manufacturing",
      "Health Care",
      "Real Estate",
      "Education",
      "E-Commerce",
      "Consulting",
      "Financial Services",
      "Advertising",
      "Marketing",
      "Construction",
      "Internet",
      "Banking",
      "Finance",
      "Logistics",
      "Transportation",
      "Dental",
      "Medical",
      "Hospital",
      "Human Resources",
      "Recruiting",
      "Staffing Agency",
      "Property Management",
      "Accounting",
      "Freight Service",
      "Wholesale",
      "Mechanical Engineering",
      "Wellness",
    ],
    // Crunchbase는 region 사용 (country 컬럼에 저장됨)
    countries: [
      "Southern US",
      "Western US",
      "Northeastern US",
      "Midwestern US",
      "Great Lakes",
      "and Africa (EMEA)",
      "Asia-Pacific (APAC)",
      "Latin America",
      "Australasia",
      "Middle East and North Africa (MENA)",
      "Southeast Asia",
      "Middle East",
      "Central America",
      "Nordic Countries",
    ],
    employeeRanges: [
      "c_00001_00010",
      "c_00011_00050",
      "c_00051_00100",
      "c_00101_00250",
      "c_00251_00500",
      "c_00501_01000",
      "c_01001_05000",
      "c_05001_10000",
      "c_10001_max",
    ],
    revenueRanges: [], // Crunchbase에는 revenue 데이터 없음
  },
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  sql?: string
  results?: Record<string, unknown>[]
  totalCount?: number
  timestamp: Date
  isLoading?: boolean
}

type LeadResult = {
  // 공통 필드
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  industry?: string
  country?: string
  revenue?: string
  // B2B Leads 전용 필드
  company_name?: string
  web_address?: string
  sub_industry?: string
  primary_city?: string
  primary_state?: string
  employee?: string
  middle_name?: string
  mailing_address?: string
  zip_code?: string
  // Crunchbase 전용 필드
  company?: string
  website?: string
  employees?: string
  description?: string
  linkedin?: string
  facebook?: string
  twitter?: string
  title?: string
  [key: string]: string | number | boolean | undefined
}

// localStorage 키
const STORAGE_KEY = "bigquery-search-messages"
const COLLAPSED_STORAGE_KEY = "bigquery-search-collapsed"

// localStorage에서 메시지 불러오기
const loadMessagesFromStorage = (): Message[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // timestamp를 Date 객체로 변환
      return parsed.map((msg: Message) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }))
    }
  } catch (error) {
    console.error("Failed to load messages from localStorage:", error)
  }
  return []
}

// localStorage에 메시지 저장
const saveMessagesToStorage = (messages: Message[]) => {
  try {
    // isLoading인 메시지는 저장하지 않음
    const messagesToSave = messages.filter((msg) => !msg.isLoading)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToSave))
  } catch (error) {
    console.error("Failed to save messages to localStorage:", error)
  }
}

// localStorage에서 접힌 상태 불러오기
const loadCollapsedFromStorage = (): Set<string> => {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY)
    if (stored) {
      return new Set(JSON.parse(stored))
    }
  } catch (error) {
    console.error("Failed to load collapsed state from localStorage:", error)
  }
  return new Set()
}

// localStorage에 접힌 상태 저장
const saveCollapsedToStorage = (collapsed: Set<string>) => {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed]))
  } catch (error) {
    console.error("Failed to save collapsed state to localStorage:", error)
  }
}

// 예시 질문 키 목록 (실제 텍스트는 t() 함수로 가져옴)
const EXAMPLE_QUERY_KEYS = [
  "examples.query1",
  "examples.query2",
  "examples.query3",
  "examples.query4",
]

// 입력 컴포넌트 분리 - inputValue 변경 시 메시지 목록 리렌더링 방지
type ChatInputProps = {
  onSubmit: (value: string) => void
  isLoading: boolean
}

const ChatInput = memo(function ChatInput({ onSubmit, isLoading }: ChatInputProps) {
  const { t } = useTranslation()
  const [localInput, setLocalInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!localInput.trim() || isLoading) {
        return
      }
      onSubmit(localInput.trim())
      setLocalInput("")
    },
    [localInput, isLoading, onSubmit],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (localInput.trim() && !isLoading) {
          onSubmit(localInput.trim())
          setLocalInput("")
        }
      }
    },
    [localInput, isLoading, onSubmit],
  )

  return (
    <form className="mx-auto max-w-4xl" onSubmit={handleSubmit}>
      <div className="relative rounded-2xl border bg-background shadow-sm">
        <Textarea
          className="max-h-[200px] min-h-[44px] resize-none rounded-2xl border-0 bg-transparent py-2.5 pr-14 pl-4 leading-6 focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={isLoading}
          id={inputId}
          onChange={(e) => setLocalInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("bigquery-search.input.placeholder")}
          ref={textareaRef}
          value={localInput}
        />
        <Button
          className="-translate-y-1/2 absolute top-1/2 right-3 h-8 w-8 rounded-full"
          disabled={!localInput.trim() || isLoading}
          size="icon"
          type="submit"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Sparkles className="h-3 w-3" />
          <span>{t("bigquery-search.input.hint.nlToSql")}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Database className="h-3 w-3" />
          <span>{t("bigquery-search.input.hint.leadCount", { total: "1,048,575" })}</span>
        </div>
      </div>
    </form>
  )
})

export default function BigQuerySearchPage() {
  const { t, i18n } = useTranslation()

  const welcomeMessage: Message = {
    id: "welcome",
    role: "assistant",
    content: `${t("bigquery-search.welcome.greeting")}

${t("bigquery-search.welcome.description")}

${t("bigquery-search.welcome.exampleHint")}`,
    timestamp: new Date(),
  }

  const [messages, setMessages] = useState<Message[]>(() => {
    const storedMessages = loadMessagesFromStorage()
    return storedMessages.length > 0 ? storedMessages : [welcomeMessage]
  })
  const [isLoading, setIsLoading] = useState(false)
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set())
  const [customerGroups, setCustomerGroups] = useState<Array<{ id: string; name: string }>>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [isAddingToCampaign, setIsAddingToCampaign] = useState(false)
  const [expandedSql, setExpandedSql] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [collapsedResults, setCollapsedResults] = useState<Set<string>>(() =>
    loadCollapsedFromStorage(),
  )

  // 선택된 데이터베이스
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseType>("b2b_leads")
  const currentDataDictionary = DATA_DICTIONARIES[selectedDatabase]

  // Enrichment 상태
  const [enrichmentModalOpen, setEnrichmentModalOpen] = useState(false)
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentResult | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)
  const [selectedLeadForEnrichment, setSelectedLeadForEnrichment] = useState<LeadResult | null>(
    null,
  )

  // 페이지네이션 상태 (메시지 ID별로 관리)
  const [paginationState, setPaginationState] = useState<
    Record<string, { page: number; pageSize: number }>
  >({})

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const workspaceId = localStorage.getItem("selectedWorkspace") || ""

  // 스크롤 자동 이동
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  // messages 변경 시 localStorage에 저장
  useEffect(() => {
    saveMessagesToStorage(messages)
  }, [messages])

  // collapsedResults 변경 시 localStorage에 저장
  useEffect(() => {
    saveCollapsedToStorage(collapsedResults)
  }, [collapsedResults])

  // 고객 그룹 목록 가져오기
  const fetchCustomerGroups = useCallback(async () => {
    if (!workspaceId || workspaceId === "all") {
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/customer-groups/workspace/${workspaceId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error("Failed to fetch customer groups")
      }

      const result = await response.json()

      if (Array.isArray(result)) {
        setCustomerGroups(result)
      } else if (result.data && Array.isArray(result.data)) {
        setCustomerGroups(result.data)
      } else {
        setCustomerGroups([])
      }
    } catch (error) {
      console.error("Failed to fetch customer groups:", error)
      setCustomerGroups([])
    }
  }, [workspaceId])

  useEffect(() => {
    fetchCustomerGroups()
  }, [fetchCustomerGroups])

  // 메시지 전송 - ChatInput 컴포넌트에서 값을 직접 받음
  // biome-ignore lint/correctness/useExhaustiveDependencies: i18n.language triggers update on language change, t is stable
  const handleChatSubmit = useCallback(
    async (messageContent: string) => {
      if (!messageContent.trim() || isLoading) {
        return
      }

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: messageContent.trim(),
        timestamp: new Date(),
      }

      const loadingMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      }

      setMessages((prev) => [...prev, userMessage, loadingMessage])
      setIsLoading(true)

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/bigquery/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify({
            query: userMessage.content,
            dataDictionary: currentDataDictionary,
          }),
        })

        if (!response.ok) {
          throw new Error(t("bigquery-search.error.searchFailed"))
        }

        const result = await response.json()

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessage.id
              ? {
                  ...msg,
                  content: result.explanation || t("bigquery-search.result.default"),
                  sql: result.sql,
                  results: result.results,
                  totalCount: result.totalCount,
                  isLoading: false,
                }
              : msg,
          ),
        )
      } catch (error) {
        console.error("Search error:", error)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessage.id
              ? {
                  ...msg,
                  content: t("bigquery-search.error.searchError"),
                  isLoading: false,
                }
              : msg,
          ),
        )
        toast.error(t("bigquery-search.error.toast"))
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, i18n.language],
  )

  // SQL 복사
  const handleCopySql = async (sql: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(sql)
      setCopiedId(messageId)
      toast.success(t("bigquery-search.sql.copied"))
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error(t("bigquery-search.sql.copyFailed"))
    }
  }

  // SQL 토글
  const toggleSqlExpand = (messageId: string) => {
    setExpandedSql((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // 결과 선택
  const toggleResultSelect = (index: number) => {
    setSelectedResults((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  // 전체 선택
  const toggleSelectAll = (results: LeadResult[]) => {
    if (selectedResults.size === results.length) {
      setSelectedResults(new Set())
    } else {
      setSelectedResults(new Set(results.map((_, i) => i)))
    }
  }

  // 결과 테이블 접기/펼치기
  const toggleResultsCollapse = (messageId: string) => {
    setCollapsedResults((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // 엑셀 다운로드
  const handleDownloadExcel = (results: LeadResult[], messageId: string) => {
    const dataToExport =
      selectedResults.size > 0 ? results.filter((_, i) => selectedResults.has(i)) : results

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Results")
    XLSX.writeFile(wb, `bigquery_results_${messageId}.xlsx`)
    toast.success(t("bigquery-search.download.excelComplete", { count: dataToExport.length }))
  }

  // CSV 다운로드
  const handleDownloadCSV = (results: LeadResult[], messageId: string) => {
    const dataToExport =
      selectedResults.size > 0 ? results.filter((_, i) => selectedResults.has(i)) : results

    if (dataToExport.length === 0) {
      toast.error(t("bigquery-search.download.noData"))
      return
    }

    // CSV 헤더
    const headers = Object.keys(dataToExport[0])
    const csvRows = [headers.join(",")]

    // CSV 데이터
    for (const row of dataToExport) {
      const values = headers.map((header) => {
        const value = row[header]
        // 쉼표, 줄바꿈, 따옴표가 포함된 경우 따옴표로 감싸기
        const stringValue = value === null || value === undefined ? "" : String(value)
        if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      csvRows.push(values.join(","))
    }

    const csvContent = csvRows.join("\n")
    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `bigquery_results_${messageId}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success(t("bigquery-search.download.csvComplete", { count: dataToExport.length }))
  }

  // 리드 정보 조회 (Enrichment)
  const handleEnrichLead = async (lead: LeadResult) => {
    const webAddress = lead.web_address || lead.website
    const companyName = lead.company_name || lead.company || ""

    if (!webAddress) {
      toast.error(t("bigquery-search.enrichment.noWebsite"))
      return
    }

    setSelectedLeadForEnrichment(lead)
    setEnrichmentModalOpen(true)
    setIsEnriching(true)
    setEnrichmentData(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/lead-enrichment/enrich`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          webAddress,
          companyName,
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
        setEnrichmentData(result.data)
      } else {
        toast.error(result.error || t("bigquery-search.enrichment.failed"))
      }
    } catch (error) {
      console.error("Enrichment error:", error)
      toast.error(t("bigquery-search.enrichment.error"))
    } finally {
      setIsEnriching(false)
    }
  }

  // 캠페인에 추가
  const handleAddToCampaign = async (results: LeadResult[]) => {
    if (!selectedGroupId) {
      toast.error(t("bigquery-search.campaign.selectGroup"))
      return
    }

    const leadsToAdd =
      selectedResults.size > 0 ? results.filter((_, i) => selectedResults.has(i)) : results

    if (leadsToAdd.length === 0) {
      toast.error(t("bigquery-search.campaign.selectLeads"))
      return
    }

    setIsAddingToCampaign(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/bigquery/add-to-group`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          groupId: selectedGroupId,
          leads: leadsToAdd.map((lead) => ({
            email: lead.email,
            firstName: lead.first_name,
            lastName: lead.last_name,
            companyName: lead.company_name || lead.company,
            phone: lead.phone,
            country: lead.country,
            city: lead.primary_city,
            industry: lead.industry,
            webAddress: lead.web_address || lead.website,
          })),
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to add leads")
      }

      toast.success(t("bigquery-search.campaign.addedSuccess", { count: result.addedCount }))
      setSelectedResults(new Set())
    } catch (error) {
      console.error("Error adding to campaign:", error)
      toast.error(t("bigquery-search.campaign.addFailed"))
    } finally {
      setIsAddingToCampaign(false)
    }
  }

  // 마지막 결과 가져오기
  const getLastResults = (): LeadResult[] => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const results = messages[i].results
      if (results && results.length > 0) {
        return results as LeadResult[]
      }
    }
    return []
  }

  const lastResults = getLastResults()

  // 페이지네이션 함수들
  const getPageState = (messageId: string) =>
    paginationState[messageId] || { page: 1, pageSize: 25 }

  const setPage = (messageId: string, page: number) => {
    setPaginationState((prev) => ({
      ...prev,
      [messageId]: { ...getPageState(messageId), page },
    }))
  }

  const setPageSize = (messageId: string, pageSize: number) => {
    setPaginationState((prev) => ({
      ...prev,
      [messageId]: { page: 1, pageSize },
    }))
  }

  const getPaginatedResults = (results: LeadResult[], messageId: string) => {
    const { page, pageSize } = getPageState(messageId)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    return results.slice(startIndex, endIndex)
  }

  const getTotalPages = (results: LeadResult[], messageId: string) => {
    const { pageSize } = getPageState(messageId)
    return Math.ceil(results.length / pageSize)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* 헤더 */}
      <div className="flex-none border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">{t("bigquery-search.header.title")}</h1>
                <p className="text-muted-foreground text-sm">
                  {t("bigquery-search.header.description")}
                </p>
              </div>
            </div>

            {/* DB 선택 드롭다운 */}
            <Select
              onValueChange={(value: DatabaseType) => setSelectedDatabase(value)}
              value={selectedDatabase}
            >
              <SelectTrigger className="w-[220px] border-dashed">
                <div className="flex items-center gap-2">
                  <span>{DATABASE_OPTIONS[selectedDatabase].icon}</span>
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">
                      {DATABASE_OPTIONS[selectedDatabase].label}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {DATABASE_OPTIONS[selectedDatabase].description}
                    </span>
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DATABASE_OPTIONS) as DatabaseType[]).map((dbKey) => (
                  <SelectItem key={dbKey} value={dbKey}>
                    <div className="flex items-center gap-2">
                      <span>{DATABASE_OPTIONS[dbKey].icon}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{DATABASE_OPTIONS[dbKey].label}</span>
                        <span className="text-muted-foreground text-xs">
                          {DATABASE_OPTIONS[dbKey].description}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 캠페인 추가 버튼 */}
          {lastResults.length > 0 && (
            <div className="flex items-center gap-3">
              <Select onValueChange={setSelectedGroupId} value={selectedGroupId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("bigquery-search.header.selectGroup")} />
                </SelectTrigger>
                <SelectContent>
                  {customerGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="gap-2"
                disabled={isAddingToCampaign || !selectedGroupId}
                onClick={() => handleAddToCampaign(lastResults)}
              >
                {isAddingToCampaign ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t("bigquery-search.header.addToCampaign")}{" "}
                {selectedResults.size > 0 && `(${selectedResults.size})`}
              </Button>
              <Button
                className="gap-2"
                onClick={() => handleDownloadExcel(lastResults, messages.at(-1)?.id || "results")}
                variant="outline"
              >
                <Download className="h-4 w-4" />
                Excel
              </Button>
              <Button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY)
                  localStorage.removeItem(COLLAPSED_STORAGE_KEY)
                  setMessages([welcomeMessage])
                  setSelectedResults(new Set())
                  setCollapsedResults(new Set())
                  toast.success(t("bigquery-search.campaign.historyCleared"))
                }}
                size="icon"
                title={t("bigquery-search.header.clearHistory")}
                variant="ghost"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 메시지 영역 */}
      <ScrollArea className="flex-1 px-6 py-4">
        <div className="mx-auto max-w-5xl space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex items-center gap-4",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
                exit={{ opacity: 0, y: -20 }}
                initial={{ opacity: 0, y: 20 }}
                key={message.id}
                transition={{ duration: 0.3 }}
              >
                {message.role === "assistant" && (
                  <div className="flex-none">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-2",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5",
                      message.role === "user"
                        ? "max-w-[80%] bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    {message.isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                        <div
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                          style={{ animationDelay: "0.2s" }}
                        />
                        <div
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                          style={{ animationDelay: "0.4s" }}
                        />
                        <span className="ml-1 text-muted-foreground text-sm">
                          {t("bigquery-search.loading.searching")}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                        {/* Welcome 메시지일 때 예시 질문 버튼 표시 */}
                        {message.id === "welcome" && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {EXAMPLE_QUERY_KEYS.map((key) => (
                              <button
                                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary text-xs transition-colors hover:border-primary/40 hover:bg-primary/20"
                                key={key}
                                onClick={() => handleChatSubmit(t(`bigquery-search.${key}`))}
                                type="button"
                              >
                                {t(`bigquery-search.${key}`)}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* SQL 쿼리 표시 */}
                  {message.sql && (
                    <div className="w-full">
                      <button
                        className="flex items-center gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground"
                        onClick={() => toggleSqlExpand(message.id)}
                        type="button"
                      >
                        {expandedSql.has(message.id) ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        {t("bigquery-search.sql.viewQuery")}
                      </button>

                      <AnimatePresence>
                        {expandedSql.has(message.id) && (
                          <motion.div
                            animate={{ height: "auto", opacity: 1 }}
                            className="overflow-hidden"
                            exit={{ height: 0, opacity: 0 }}
                            initial={{ height: 0, opacity: 0 }}
                          >
                            <div className="group relative mt-2">
                              <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-gray-100 text-xs dark:bg-gray-950">
                                <code>{message.sql}</code>
                              </pre>
                              <button
                                className="absolute top-2 right-2 rounded-md bg-gray-800 p-1.5 opacity-0 transition-colors hover:bg-gray-700 group-hover:opacity-100"
                                onClick={() => handleCopySql(message.sql ?? "", message.id)}
                                type="button"
                              >
                                {copiedId === message.id ? (
                                  <Check className="h-3.5 w-3.5 text-green-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* 결과 없음 메시지 */}
                  {message.results &&
                    message.results.length === 0 &&
                    message.sql &&
                    (() => {
                      // 이전 user 메시지에서 원래 쿼리 가져오기
                      const messageIndex = messages.findIndex((m) => m.id === message.id)
                      const userQuery = messageIndex > 0 ? messages[messageIndex - 1]?.content : ""

                      return (
                        <Card className="mt-2 w-full border-0 shadow-lg">
                          <CardContent className="py-12">
                            <div className="flex flex-col items-center justify-center gap-4 text-center">
                              <Database className="mb-2 h-12 w-12 text-muted-foreground" />
                              <div className="space-y-2">
                                <p className="font-medium text-lg text-muted-foreground">
                                  {t("bigquery-search.empty.title")}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                  {t("bigquery-search.empty.description", { query: userQuery })}
                                </p>
                              </div>
                              <div className="mt-2 w-full max-w-2xl">
                                <p className="mb-3 font-medium text-muted-foreground text-xs">
                                  {t("bigquery-search.empty.industries")}
                                </p>
                                <div className="flex flex-wrap justify-center gap-1.5">
                                  {currentDataDictionary.industries.slice(0, 12).map((industry) => (
                                    <Badge
                                      className="cursor-pointer text-xs transition-colors hover:bg-primary/20"
                                      key={industry}
                                      onClick={() =>
                                        handleChatSubmit(
                                          t("bigquery-search.empty.industryQuery", { industry }),
                                        )
                                      }
                                      variant="secondary"
                                    >
                                      {industry}
                                    </Badge>
                                  ))}
                                  {currentDataDictionary.industries.length > 12 && (
                                    <Badge
                                      className="text-muted-foreground text-xs"
                                      variant="outline"
                                    >
                                      {t("bigquery-search.empty.moreIndustries", {
                                        count: currentDataDictionary.industries.length - 12,
                                      })}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })()}

                  {/* 결과 테이블 */}
                  {message.results &&
                    message.results.length > 0 &&
                    (() => {
                      const results = message.results as LeadResult[]
                      const paginatedResults = getPaginatedResults(results, message.id)
                      const totalPages = getTotalPages(results, message.id)
                      const { page, pageSize } = getPageState(message.id)
                      const startIndex = (page - 1) * pageSize

                      return (
                        <Card className="mt-2 w-full overflow-hidden border-0 shadow-lg transition-shadow hover:shadow-xl">
                          <CardHeader
                            className="cursor-pointer select-none bg-muted py-3"
                            onClick={() => toggleResultsCollapse(message.id)}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                                  <Table className="h-4 w-4" />
                                </div>
                                <div>
                                  <CardTitle className="font-semibold text-sm">
                                    {t("bigquery-search.results.title")}
                                  </CardTitle>
                                  <CardDescription className="text-xs">
                                    {t("bigquery-search.results.count", {
                                      total: message.totalCount?.toLocaleString() || results.length,
                                      loaded: results.length,
                                    })}
                                  </CardDescription>
                                </div>
                                <button
                                  className="ml-2 rounded p-1 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleResultsCollapse(message.id)
                                  }}
                                  type="button"
                                >
                                  {collapsedResults.has(message.id) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>
                              </div>

                              {/* 페이지 크기 선택 및 CSV 다운로드 */}
                              {!collapsedResults.has(message.id) && (
                                /* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation only */
                                <div
                                  className="flex items-center gap-3"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <span className="text-muted-foreground text-xs">
                                    {t("bigquery-search.results.pageSize")}
                                  </span>
                                  <Select
                                    onValueChange={(v) => setPageSize(message.id, Number(v))}
                                    value={pageSize.toString()}
                                  >
                                    <SelectTrigger className="h-8 w-[80px] text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[10, 25, 50, 100].map((size) => (
                                        <SelectItem key={size} value={size.toString()}>
                                          {t("bigquery-search.results.perPage", { size })}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => handleDownloadCSV(results, message.id)}
                                    size="sm"
                                    variant="outline"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    CSV
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <AnimatePresence>
                            {!collapsedResults.has(message.id) && (
                              <motion.div
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                initial={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <CardContent className="p-0">
                                  <div className="overflow-x-auto">
                                    <UITable>
                                      <TableHeader>
                                        <TableRow className="bg-gray-50 dark:bg-gray-700">
                                          <TableHead className="w-[50px]">
                                            <Checkbox
                                              checked={
                                                selectedResults.size === results.length &&
                                                results.length > 0
                                              }
                                              onCheckedChange={() => toggleSelectAll(results)}
                                            />
                                          </TableHead>
                                          <TableHead className="font-semibold">#</TableHead>
                                          <TableHead className="font-semibold">
                                            {t("bigquery-search.table.companyName")}
                                          </TableHead>
                                          <TableHead className="font-semibold">
                                            {t("bigquery-search.table.website")}
                                          </TableHead>
                                          <TableHead className="font-semibold">
                                            {t("bigquery-search.table.name")}
                                          </TableHead>
                                          <TableHead className="font-semibold">
                                            {t("bigquery-search.table.email")}
                                          </TableHead>
                                          <TableHead className="font-semibold">
                                            {t("bigquery-search.table.industry")}
                                          </TableHead>
                                          <TableHead className="font-semibold">
                                            {t("bigquery-search.table.location")}
                                          </TableHead>
                                          <TableHead className="font-semibold">
                                            {t("bigquery-search.table.employees")}
                                          </TableHead>
                                          <TableHead className="text-center font-semibold">
                                            {t("bigquery-search.table.info")}
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {paginatedResults.map((result, index) => {
                                          const globalIndex = startIndex + index
                                          return (
                                            <TableRow
                                              className={cn(
                                                "transition-colors hover:bg-gray-50 dark:hover:bg-gray-700",
                                                selectedResults.has(globalIndex) &&
                                                  "bg-blue-50/50 dark:bg-blue-950/30",
                                              )}
                                              key={globalIndex}
                                            >
                                              <TableCell>
                                                <Checkbox
                                                  checked={selectedResults.has(globalIndex)}
                                                  onCheckedChange={() =>
                                                    toggleResultSelect(globalIndex)
                                                  }
                                                />
                                              </TableCell>
                                              <TableCell className="font-mono text-muted-foreground text-xs">
                                                {globalIndex + 1}
                                              </TableCell>
                                              <TableCell className="max-w-[200px] truncate font-medium">
                                                {result.company_name || result.company || "-"}
                                              </TableCell>
                                              <TableCell className="max-w-[180px]">
                                                {result.web_address || result.website ? (
                                                  <a
                                                    className="inline-flex items-center gap-1 text-blue-600 text-xs hover:text-blue-800 hover:underline"
                                                    href={
                                                      (
                                                        result.web_address ||
                                                        result.website ||
                                                        ""
                                                      ).startsWith("http")
                                                        ? result.web_address || result.website
                                                        : `https://${result.web_address || result.website}`
                                                    }
                                                    rel="noopener noreferrer"
                                                    target="_blank"
                                                    title={result.web_address || result.website}
                                                  >
                                                    <span className="max-w-[140px] truncate">
                                                      {(
                                                        result.web_address ||
                                                        result.website ||
                                                        ""
                                                      ).replace(/^https?:\/\//, "")}
                                                    </span>
                                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                                  </a>
                                                ) : (
                                                  <span className="text-muted-foreground text-xs">
                                                    -
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                {[result.first_name, result.last_name]
                                                  .filter(Boolean)
                                                  .join(" ") || "-"}
                                              </TableCell>
                                              <TableCell className="max-w-[200px] truncate font-mono text-xs">
                                                {result.email || "-"}
                                              </TableCell>
                                              <TableCell>
                                                <div className="flex flex-col">
                                                  <span className="text-xs">
                                                    {result.industry || "-"}
                                                  </span>
                                                  {result.sub_industry && (
                                                    <span className="max-w-[150px] truncate text-muted-foreground text-xs">
                                                      {result.sub_industry}
                                                    </span>
                                                  )}
                                                </div>
                                              </TableCell>
                                              <TableCell>
                                                <div className="flex flex-col text-xs">
                                                  <span>{result.country || "-"}</span>
                                                  <span className="text-muted-foreground">
                                                    {result.primary_city}
                                                    {result.primary_state &&
                                                      `, ${result.primary_state}`}
                                                  </span>
                                                </div>
                                              </TableCell>
                                              <TableCell>
                                                <Badge
                                                  className="font-normal text-xs"
                                                  variant="outline"
                                                >
                                                  {result.employee || result.employees || "-"}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-center">
                                                <Button
                                                  className="h-7 w-7 p-0"
                                                  disabled={!(result.web_address || result.website)}
                                                  onClick={() => handleEnrichLead(result)}
                                                  size="sm"
                                                  title={
                                                    result.web_address || result.website
                                                      ? t("bigquery-search.tooltip.viewCompanyInfo")
                                                      : t("bigquery-search.tooltip.noWebsite")
                                                  }
                                                  type="button"
                                                  variant="ghost"
                                                >
                                                  <Info className="h-4 w-4" />
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          )
                                        })}
                                      </TableBody>
                                    </UITable>
                                  </div>

                                  {/* 페이지네이션 UI */}
                                  {totalPages > 1 && (
                                    <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-3">
                                      <div className="text-muted-foreground text-xs">
                                        <span className="font-medium text-foreground">
                                          {startIndex + 1}-
                                          {Math.min(startIndex + pageSize, results.length)}
                                        </span>{" "}
                                        {t("bigquery-search.results.itemCount", {
                                          count: results.length,
                                        })}
                                      </div>

                                      <div className="flex items-center gap-1">
                                        {/* 처음으로 */}
                                        <Button
                                          className="h-8 w-8"
                                          disabled={page === 1}
                                          onClick={() => setPage(message.id, 1)}
                                          size="icon"
                                          variant="ghost"
                                        >
                                          <ChevronsLeft className="h-4 w-4" />
                                        </Button>

                                        {/* 이전 */}
                                        <Button
                                          className="h-8 w-8"
                                          disabled={page === 1}
                                          onClick={() => setPage(message.id, page - 1)}
                                          size="icon"
                                          variant="ghost"
                                        >
                                          <ChevronLeft className="h-4 w-4" />
                                        </Button>

                                        {/* 페이지 번호들 */}
                                        <div className="mx-1 flex items-center gap-1">
                                          {(() => {
                                            const pages: (number | string)[] = []
                                            const showPages = 5
                                            let start = Math.max(
                                              1,
                                              page - Math.floor(showPages / 2),
                                            )
                                            const end = Math.min(totalPages, start + showPages - 1)

                                            if (end - start + 1 < showPages) {
                                              start = Math.max(1, end - showPages + 1)
                                            }

                                            if (start > 1) {
                                              pages.push(1)
                                              if (start > 2) {
                                                pages.push("...")
                                              }
                                            }

                                            for (let i = start; i <= end; i++) {
                                              pages.push(i)
                                            }

                                            if (end < totalPages) {
                                              if (end < totalPages - 1) {
                                                pages.push("...")
                                              }
                                              pages.push(totalPages)
                                            }

                                            return pages.map((p, idx) => {
                                              if (p === "...") {
                                                return (
                                                  <span
                                                    className="px-2 text-muted-foreground"
                                                    key={`ellipsis-${idx < 3 ? "start" : "end"}`}
                                                  >
                                                    ⋯
                                                  </span>
                                                )
                                              }
                                              return (
                                                <Button
                                                  className={cn(
                                                    "h-8 w-8 font-medium text-xs transition-all",
                                                    page !== p &&
                                                      "hover:bg-gray-100 dark:hover:bg-gray-800",
                                                  )}
                                                  key={p}
                                                  onClick={() => setPage(message.id, p as number)}
                                                  size="icon"
                                                  variant={page === p ? "default" : "ghost"}
                                                >
                                                  {p}
                                                </Button>
                                              )
                                            })
                                          })()}
                                        </div>

                                        {/* 다음 */}
                                        <Button
                                          className="h-8 w-8"
                                          disabled={page === totalPages}
                                          onClick={() => setPage(message.id, page + 1)}
                                          size="icon"
                                          variant="ghost"
                                        >
                                          <ChevronRight className="h-4 w-4" />
                                        </Button>

                                        {/* 마지막으로 */}
                                        <Button
                                          className="h-8 w-8"
                                          disabled={page === totalPages}
                                          onClick={() => setPage(message.id, totalPages)}
                                          size="icon"
                                          variant="ghost"
                                        >
                                          <ChevronsRight className="h-4 w-4" />
                                        </Button>
                                      </div>

                                      <div className="text-muted-foreground text-xs">
                                        {t("bigquery-search.results.pageInfo", {
                                          page,
                                          total: totalPages,
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      )
                    })()}
                </div>

                {message.role === "user" && (
                  <div className="flex-none">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 입력 영역 - 별도 컴포넌트로 분리하여 리렌더링 최적화 */}
      <div className="flex-none border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ChatInput isLoading={isLoading} onSubmit={handleChatSubmit} />
      </div>

      {/* 회사 정보 조회 모달 */}
      <Dialog onOpenChange={setEnrichmentModalOpen} open={enrichmentModalOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              {selectedLeadForEnrichment?.company_name ||
                selectedLeadForEnrichment?.company ||
                t("bigquery-search.enrichment.title")}
            </DialogTitle>
            <DialogDescription>
              {(selectedLeadForEnrichment?.web_address || selectedLeadForEnrichment?.website) && (
                <a
                  className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                  href={
                    (
                      selectedLeadForEnrichment.web_address ||
                      selectedLeadForEnrichment.website ||
                      ""
                    ).startsWith("http")
                      ? selectedLeadForEnrichment.web_address || selectedLeadForEnrichment.website
                      : `https://${selectedLeadForEnrichment.web_address || selectedLeadForEnrichment.website}`
                  }
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {selectedLeadForEnrichment.web_address || selectedLeadForEnrichment.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
            {isEnriching ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <div className="text-center">
                  <p className="font-medium">{t("bigquery-search.enrichment.loading")}</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {t("bigquery-search.enrichment.loadingDesc")}
                  </p>
                </div>
              </div>
            ) : enrichmentData ? (
              <div className="space-y-6 py-4">
                {/* 회사 설명 */}
                {enrichmentData.companyInfo?.description && (
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 font-semibold">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      {t("bigquery-search.enrichment.companyIntro")}
                    </h4>
                    <p className="rounded-lg bg-gray-50 p-4 text-muted-foreground text-sm leading-relaxed dark:bg-gray-900">
                      {enrichmentData.companyInfo.description}
                    </p>
                    {enrichmentData.companyInfo?.industry && (
                      <Badge className="text-xs" variant="secondary">
                        {enrichmentData.companyInfo.industry}
                      </Badge>
                    )}
                  </div>
                )}

                {/* 이메일 목록 */}
                {enrichmentData.emails && enrichmentData.emails.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 font-semibold">
                      <Mail className="h-4 w-4 text-blue-500" />
                      {t("bigquery-search.enrichment.emailsFound", {
                        count: enrichmentData.emails.length,
                      })}
                    </h4>
                    <div className="space-y-2">
                      {enrichmentData.emails.map((email, idx) => (
                        <div
                          className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
                          key={email.value}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-muted-foreground text-xs">
                              {idx + 1}
                            </span>
                            <a
                              className="font-mono text-blue-600 text-sm hover:underline"
                              href={`mailto:${email.value}`}
                            >
                              {email.value}
                            </a>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              className="text-xs"
                              variant={email.type === "generic" ? "default" : "secondary"}
                            >
                              {email.type === "generic"
                                ? t("bigquery-search.enrichment.emailGeneric")
                                : email.type}
                            </Badge>
                            {email.confidence !== undefined && email.confidence > 0 && (
                              <span className="text-muted-foreground text-xs">
                                {Math.round(email.confidence)}%
                              </span>
                            )}
                            <Button
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                navigator.clipboard.writeText(email.value)
                                toast.success(t("bigquery-search.enrichment.emailCopied"))
                              }}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 이메일 없음 */}
                {(!enrichmentData.emails || enrichmentData.emails.length === 0) && (
                  <div className="rounded-lg bg-amber-50 py-6 text-center dark:bg-amber-950/30">
                    <Mail className="mx-auto mb-2 h-8 w-8 text-amber-500" />
                    <p className="text-amber-700 text-sm dark:text-amber-400">
                      {t("bigquery-search.enrichment.noEmails")}
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {t("bigquery-search.enrichment.hunterHint")}
                    </p>
                  </div>
                )}

                {/* 기존 리드 정보 */}
                {selectedLeadForEnrichment && (
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 font-semibold">
                      <User className="h-4 w-4 text-gray-500" />
                      {t("bigquery-search.enrichment.existingLead")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedLeadForEnrichment.email && (
                        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                          <span className="text-muted-foreground text-xs">
                            {t("bigquery-search.lead.email")}
                          </span>
                          <p className="truncate font-mono">{selectedLeadForEnrichment.email}</p>
                        </div>
                      )}
                      {selectedLeadForEnrichment.phone && (
                        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                          <span className="text-muted-foreground text-xs">
                            {t("bigquery-search.lead.phone")}
                          </span>
                          <p>{selectedLeadForEnrichment.phone}</p>
                        </div>
                      )}
                      {selectedLeadForEnrichment.industry && (
                        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                          <span className="text-muted-foreground text-xs">
                            {t("bigquery-search.lead.industry")}
                          </span>
                          <p>{selectedLeadForEnrichment.industry}</p>
                        </div>
                      )}
                      {selectedLeadForEnrichment.employee && (
                        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                          <span className="text-muted-foreground text-xs">
                            {t("bigquery-search.lead.employees")}
                          </span>
                          <p>{selectedLeadForEnrichment.employee}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <X className="h-8 w-8 text-red-500" />
                <p className="text-muted-foreground text-sm">
                  {t("bigquery-search.enrichment.loadFailed")}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
