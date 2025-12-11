import { ArrowLeft, ArrowRight, Eye, Mail, Target, Zap } from "lucide-react"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface TargetBuyer {
  industry: string
  country: string
  countryCode: string
  companyCount: number
}

interface EmailScheduleItem {
  day: string
  title: string
  description: string
}

interface Strategy {
  id: string
  countryCode: string
  countryName: string
  companiesTargeted: number
  description: string
  metrics: {
    openRate: number
    responseRate: number
    meetingRate: number
  }
  isSuggested: boolean
  targetBuyers: TargetBuyer[]
  emailSchedule: EmailScheduleItem[]
}

// Mock data - will be replaced with API call later
const mockStrategies: Strategy[] = [
  {
    id: "1",
    countryCode: "DE",
    countryName: "germany",
    companiesTargeted: 157,
    description:
      "This B2B sales strategy emphasizes quality and technological prowess, targeting German enterprises that value precision engineering and reliability.",
    metrics: { openRate: 32, responseRate: 8, meetingRate: 2.5 },
    isSuggested: true,
    targetBuyers: [
      { industry: "manufacturing", country: "germany", countryCode: "DE", companyCount: 890000 },
      { industry: "auto parts", country: "germany", countryCode: "DE", companyCount: 420000 },
      {
        industry: "industrial equipment",
        country: "germany",
        countryCode: "DE",
        companyCount: 260000,
      },
    ],
    emailSchedule: [
      {
        day: "D+0",
        title: "First greeting email",
        description: "Company Introduction and Cooperation Proposal",
      },
      {
        day: "D+3",
        title: "Product Details",
        description: "Technical specifications and certification information",
      },
      {
        day: "D+7",
        title: "Reference sharing",
        description: "Existing Customer Cases and Reviews",
      },
      {
        day: "D+14",
        title: "Meeting proposal",
        description: "Coordinating video meeting schedules",
      },
    ],
  },
  {
    id: "2",
    countryCode: "GB",
    countryName: "uk",
    companiesTargeted: 142,
    description:
      "Targeting 1.42 million tech companies in central London, this strategy focuses on financial services and fintech sectors.",
    metrics: { openRate: 38, responseRate: 12, meetingRate: 4 },
    isSuggested: false,
    targetBuyers: [
      { industry: "fintech", country: "uk", countryCode: "GB", companyCount: 520000 },
      { industry: "financial services", country: "uk", countryCode: "GB", companyCount: 380000 },
      { industry: "software", country: "uk", countryCode: "GB", companyCount: 520000 },
    ],
    emailSchedule: [
      {
        day: "D+0",
        title: "First greeting email",
        description: "Company Introduction and Cooperation Proposal",
      },
      {
        day: "D+3",
        title: "Product Details",
        description: "Technical specifications and certification information",
      },
      {
        day: "D+7",
        title: "Reference sharing",
        description: "Existing Customer Cases and Reviews",
      },
      {
        day: "D+14",
        title: "Meeting proposal",
        description: "Coordinating video meeting schedules",
      },
    ],
  },
  {
    id: "3",
    countryCode: "SG",
    countryName: "Singapore",
    companiesTargeted: 28,
    description:
      "Starting with 280,000 businesses in Singapore, we aim to expand into the Southeast Asian market through regional partnerships.",
    metrics: { openRate: 35, responseRate: 10, meetingRate: 3 },
    isSuggested: false,
    targetBuyers: [
      { industry: "logistics", country: "Singapore", countryCode: "SG", companyCount: 120000 },
      { industry: "trading", country: "Singapore", countryCode: "SG", companyCount: 95000 },
      { industry: "technology", country: "Singapore", countryCode: "SG", companyCount: 65000 },
    ],
    emailSchedule: [
      {
        day: "D+0",
        title: "First greeting email",
        description: "Company Introduction and Cooperation Proposal",
      },
      {
        day: "D+3",
        title: "Product Details",
        description: "Technical specifications and certification information",
      },
      {
        day: "D+7",
        title: "Reference sharing",
        description: "Existing Customer Cases and Reviews",
      },
      {
        day: "D+14",
        title: "Meeting proposal",
        description: "Coordinating video meeting schedules",
      },
    ],
  },
]

interface StrategyCardProps {
  strategy: Strategy
  isSelected: boolean
  onSelect: () => void
}

function StrategyCard({ strategy, isSelected, onSelect }: StrategyCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col p-5 rounded-xl border bg-white text-left transition-all",
        "hover:shadow-md cursor-pointer",
        isSelected ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md" : "border-gray-200",
      )}
    >
      {strategy.isSuggested && (
        <span className="absolute -top-2 left-4 px-2 py-0.5 text-xs font-medium bg-amber-400 text-amber-900 rounded-full">
          suggestion
        </span>
      )}

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-gray-400">{strategy.countryCode}</span>
        <span className="text-lg font-semibold text-gray-900">{strategy.countryName}</span>
      </div>

      <p className="text-sm text-gray-500 mb-4">{strategy.companiesTargeted} companies targeted</p>

      <p className="text-sm text-gray-600 line-clamp-3 mb-6 flex-1">{strategy.description}</p>

      <div className="grid grid-cols-3 gap-2">
        <MetricBox label="Open rate" value={`${strategy.metrics.openRate}%`} />
        <MetricBox label="Response rate" value={`${strategy.metrics.responseRate}%`} />
        <MetricBox label="Meeting rate" value={`${strategy.metrics.meetingRate}%`} />
      </div>
    </button>
  )
}

interface MetricBoxProps {
  label: string
  value: string
}

function MetricBox({ label, value }: MetricBoxProps) {
  return (
    <div className="flex flex-col items-center p-2 bg-gray-50 rounded-lg">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-blue-600">{value}</span>
    </div>
  )
}

// Strategy Detail View Component
interface StrategyDetailViewProps {
  strategy: Strategy
  onBack: () => void
  onGetStarted: () => void
}

function StrategyDetailView({ strategy, onBack, onGetStarted }: StrategyDetailViewProps) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Link */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>To the list of strategies</span>
      </button>

      {/* Main Content Card */}
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Target Buyer List */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Target Buyer List</h3>
              </div>
              <div className="space-y-3">
                {strategy.targetBuyers.map((buyer, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-400">{buyer.countryCode}</span>
                      <div>
                        <p className="font-medium text-gray-900">{buyer.industry}</p>
                        <p className="text-sm text-gray-500">{buyer.country}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                      {buyer.companyCount.toLocaleString()} companies
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Sending Schedule */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Email sending schedule</h3>
              </div>
              <div className="space-y-3">
                {strategy.emailSchedule.map((item, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg min-w-[60px] text-center">
                      {item.day}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button size="lg" onClick={onGetStarted} className="px-8 bg-blue-600 hover:bg-blue-700">
          <Zap className="w-4 h-4 mr-2" />
          Start your business with this strategy
        </Button>
      </div>
    </div>
  )
}

export function Step3StrategySelection() {
  const [, _setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(
    mockStrategies.find((s) => s.isSuggested)?.id || null,
  )
  const [viewMode, setViewMode] = useState<"list" | "detail">("list")

  const selectedStrategy = mockStrategies.find((s) => s.id === selectedStrategyId)

  const handleGetStarted = () => {
    if (!selectedStrategyId) return

    // TODO: Save selected strategy to backend
    // For now, navigate to dashboard or complete onboarding
    console.log("Selected strategy:", selectedStrategyId)
    navigate("/dashboard")

    // Navigate to dashboard or next step
    // window.location.href = "/dashboard"
  }

  const handleViewDetail = () => {
    if (selectedStrategyId) {
      setViewMode("detail")
    }
  }

  // Show detail view
  if (viewMode === "detail" && selectedStrategy) {
    return (
      <StrategyDetailView
        strategy={selectedStrategy}
        onBack={() => setViewMode("list")}
        onGetStarted={handleGetStarted}
      />
    )
  }

  // Show list view
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Sales strategies proposed by RINDA
        </h2>
        <p className="text-gray-500">
          Based on the market data analyzed above, we have prepared three strategies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {mockStrategies.map((strategy) => (
          <StrategyCard
            key={strategy.id}
            strategy={strategy}
            isSelected={selectedStrategyId === strategy.id}
            onSelect={() => setSelectedStrategyId(strategy.id)}
          />
        ))}
      </div>

      {/* Action Buttons - shown when a strategy is selected */}
      {selectedStrategyId && (
        <div className="flex justify-center gap-4">
          <Button variant="outline" size="lg" onClick={handleViewDetail} className="px-6">
            <Eye className="w-4 h-4 mr-2" />
            View detailed strategy
          </Button>
          <Button
            size="lg"
            onClick={handleGetStarted}
            className="px-6 bg-blue-600 hover:bg-blue-700"
          >
            Get started with this strategy
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
