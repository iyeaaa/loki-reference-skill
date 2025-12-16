import { Calendar, Globe, Target, TrendingUp, Users } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TargetBuyer = {
  industry: string
  country: string
  countryCode: string
  companyCount: number
}

type EmailScheduleItem = {
  day: string
  title: string
  description: string
}

type SalesStrategy = {
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

// Default email schedule template
const defaultEmailSchedule: EmailScheduleItem[] = [
  { day: "D+0", title: "Introduction", description: "Company introduction and value proposition" },
  { day: "D+3", title: "Product Details", description: "Detailed product/service information" },
  { day: "D+7", title: "Case Studies", description: "Success stories and testimonials" },
  { day: "D+14", title: "Meeting Request", description: "Schedule a discovery call" },
]

// Dummy strategies data inspired by workspace.service.ts generateStrategiesFromEnrichment
const dummyStrategies: SalesStrategy[] = [
  {
    id: "strategy-us-1",
    countryCode: "US",
    countryName: "United States",
    companiesTargeted: 245,
    description:
      "This B2B sales strategy targets United States market for your company's products. Focusing on enterprise customers with emphasis on quality and innovation.",
    metrics: {
      openRate: 38.5,
      responseRate: 12.3,
      meetingRate: 4.2,
    },
    isSuggested: true,
    targetBuyers: [
      {
        industry: "Manufacturing",
        country: "United States",
        countryCode: "US",
        companyCount: 450_000,
      },
      {
        industry: "Technology",
        country: "United States",
        countryCode: "US",
        companyCount: 320_000,
      },
    ],
    emailSchedule: defaultEmailSchedule,
  },
  {
    id: "strategy-de-2",
    countryCode: "DE",
    countryName: "Germany",
    companiesTargeted: 178,
    description:
      "Expansion opportunity in Germany market based on your company's growth goals. Target market aligned with European expansion strategy.",
    metrics: {
      openRate: 42.1,
      responseRate: 15.8,
      meetingRate: 5.1,
    },
    isSuggested: false,
    targetBuyers: [
      { industry: "Automotive", country: "Germany", countryCode: "DE", companyCount: 280_000 },
      {
        industry: "Industrial Equipment",
        country: "Germany",
        countryCode: "DE",
        companyCount: 195_000,
      },
    ],
    emailSchedule: defaultEmailSchedule,
  },
  {
    id: "strategy-sg-3",
    countryCode: "SG",
    countryName: "Singapore",
    companiesTargeted: 92,
    description:
      "Strategic entry point for Asia-Pacific market. Singapore serves as a hub for expanding into Southeast Asian markets with strong B2B infrastructure.",
    metrics: {
      openRate: 35.7,
      responseRate: 10.5,
      meetingRate: 3.8,
    },
    isSuggested: false,
    targetBuyers: [
      {
        industry: "Finance & Banking",
        country: "Singapore",
        countryCode: "SG",
        companyCount: 85_000,
      },
      { industry: "Logistics", country: "Singapore", countryCode: "SG", companyCount: 62_000 },
    ],
    emailSchedule: defaultEmailSchedule,
  },
]

export function SalesStrategyTab() {
  const { t } = useTranslation()
  const strategies = dummyStrategies
  const [selectedStrategy, setSelectedStrategy] = useState<SalesStrategy | null>(null)

  if (strategies.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="font-medium text-lg">
            {t("app.dashboard.noStrategies", "No sales strategies available")}
          </h3>
          <p className="mt-1 text-muted-foreground text-sm">
            {t(
              "app.dashboard.noStrategiesDesc",
              "Complete the onboarding process to generate sales strategies",
            )}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {strategies.map((strategy) => (
        <Card className="relative" key={strategy.id}>
          {strategy.isSuggested && (
            <Badge className="-top-2 -right-2 absolute bg-primary">
              {t("app.dashboard.suggested", "Suggested")}
            </Badge>
          )}
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{strategy.countryName}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="line-clamp-3 text-muted-foreground text-sm">{strategy.description}</p>

            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span>
                <span className="font-medium">{strategy.companiesTargeted}</span>
                <span className="text-muted-foreground">
                  {" "}
                  {t("app.dashboard.companiesTargeted", "companies targeted")}
                </span>
              </span>
            </div>

            <Button
              className="w-full"
              onClick={() => setSelectedStrategy(strategy)}
              variant="outline"
            >
              {t("app.dashboard.viewDetails", "View Details")}
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Strategy Details Dialog */}
      <Dialog onOpenChange={(open) => !open && setSelectedStrategy(null)} open={!!selectedStrategy}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          {selectedStrategy && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <DialogTitle>{selectedStrategy.countryName}</DialogTitle>
                  {selectedStrategy.isSuggested && (
                    <Badge className="bg-primary">
                      {t("app.dashboard.suggested", "Suggested")}
                    </Badge>
                  )}
                </div>
                <DialogDescription>{selectedStrategy.description}</DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                {/* Metrics */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 font-medium">
                    <TrendingUp className="h-4 w-4" />
                    {t("app.dashboard.metrics", "Performance Metrics")}
                  </h4>
                  <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 py-4 text-center">
                    <div>
                      <div className="font-bold text-2xl text-green-600">
                        {selectedStrategy.metrics.openRate}%
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {t("app.dashboard.openRate", "Open Rate")}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-2xl text-blue-600">
                        {selectedStrategy.metrics.responseRate}%
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {t("app.dashboard.responseRate", "Response")}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-2xl text-purple-600">
                        {selectedStrategy.metrics.meetingRate}%
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {t("app.dashboard.meetingRate", "Meeting")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Target Buyers */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4" />
                    {t("app.dashboard.targetBuyers", "Target Buyers")}
                  </h4>
                  <div className="space-y-2">
                    {selectedStrategy.targetBuyers.map((buyer, idx) => (
                      <div
                        className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                        key={idx}
                      >
                        <div>
                          <div className="font-medium">{buyer.industry}</div>
                          <div className="text-muted-foreground text-sm">{buyer.country}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{buyer.companyCount.toLocaleString()}</div>
                          <div className="text-muted-foreground text-sm">
                            {t("app.dashboard.companies", "companies")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Email Schedule */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4" />
                    {t("app.dashboard.emailSchedule", "Email Schedule")}
                  </h4>
                  <div className="space-y-2">
                    {selectedStrategy.emailSchedule.map((item, idx) => (
                      <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3" key={idx}>
                        <Badge className="shrink-0" variant="outline">
                          {item.day}
                        </Badge>
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-muted-foreground text-sm">{item.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
