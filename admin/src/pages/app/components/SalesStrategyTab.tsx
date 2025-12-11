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

interface SalesStrategy {
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
        companyCount: 450000,
      },
      { industry: "Technology", country: "United States", countryCode: "US", companyCount: 320000 },
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
      { industry: "Automotive", country: "Germany", countryCode: "DE", companyCount: 280000 },
      {
        industry: "Industrial Equipment",
        country: "Germany",
        countryCode: "DE",
        companyCount: 195000,
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
        companyCount: 85000,
      },
      { industry: "Logistics", country: "Singapore", countryCode: "SG", companyCount: 62000 },
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
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">
            {t("app.dashboard.noStrategies", "No sales strategies available")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
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
        <Card key={strategy.id} className="relative">
          {strategy.isSuggested && (
            <Badge className="absolute -top-2 -right-2 bg-primary">
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
            <p className="text-sm text-muted-foreground line-clamp-3">{strategy.description}</p>

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
              variant="outline"
              className="w-full"
              onClick={() => setSelectedStrategy(strategy)}
            >
              {t("app.dashboard.viewDetails", "View Details")}
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Strategy Details Dialog */}
      <Dialog open={!!selectedStrategy} onOpenChange={(open) => !open && setSelectedStrategy(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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

              <div className="space-y-6 mt-4">
                {/* Metrics */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {t("app.dashboard.metrics", "Performance Metrics")}
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-center py-4 bg-muted/50 rounded-lg">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {selectedStrategy.metrics.openRate}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("app.dashboard.openRate", "Open Rate")}
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedStrategy.metrics.responseRate}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("app.dashboard.responseRate", "Response")}
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedStrategy.metrics.meetingRate}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("app.dashboard.meetingRate", "Meeting")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Target Buyers */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t("app.dashboard.targetBuyers", "Target Buyers")}
                  </h4>
                  <div className="space-y-2">
                    {selectedStrategy.targetBuyers.map((buyer, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{buyer.industry}</div>
                          <div className="text-sm text-muted-foreground">{buyer.country}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{buyer.companyCount.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("app.dashboard.companies", "companies")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Email Schedule */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t("app.dashboard.emailSchedule", "Email Schedule")}
                  </h4>
                  <div className="space-y-2">
                    {selectedStrategy.emailSchedule.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <Badge variant="outline" className="shrink-0">
                          {item.day}
                        </Badge>
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-sm text-muted-foreground">{item.description}</div>
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
