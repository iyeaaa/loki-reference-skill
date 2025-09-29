import { BarChart, ChevronDown, ChevronUp, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export type EmailMetrics = {
  sent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
}

export type RecipientMetrics = {
  email: string
  name: string | undefined
  delivered: boolean
  opened: boolean
  clicked: boolean
  replied: boolean
  openTime?: string
  clickTime?: string
  replyTime?: string
}

export const generateMockMetrics = (
  recipients: { email: string; name?: string }[]
): { metrics: EmailMetrics; recipientMetrics: RecipientMetrics[] } => {
  const totalSent = recipients.length

  const totalDelivered = 1
  const totalOpened = 1
  const totalClicked = 1
  const totalReplied = 1

  const metrics: EmailMetrics = {
    sent: totalSent,
    delivered: totalDelivered,
    opened: totalOpened,
    clicked: totalClicked,
    replied: totalReplied,
  }

  const recipientMetrics: RecipientMetrics[] = recipients.map((recipient) => {
    const delivered = true
    const opened = true
    const clicked = true
    const replied = true

    const now = new Date()
    const getRandomPastTime = () => {
      const pastTime = new Date(now.getTime() - Math.random() * 3600000)
      return pastTime.toLocaleTimeString()
    }

    return {
      email: recipient.email,
      name: recipient.name || recipient.email.split("@")[0],
      delivered,
      opened,
      clicked,
      replied,
      openTime: opened ? getRandomPastTime() : undefined,
      clickTime: clicked ? getRandomPastTime() : undefined,
      replyTime: replied ? getRandomPastTime() : undefined,
    }
  })

  return { metrics, recipientMetrics }
}

interface EmailMetricsDisplayProps {
  recipients: { email: string; name?: string }[]
  visible?: boolean
}

export const EmailMetricsDisplay = ({ recipients, visible = true }: EmailMetricsDisplayProps) => {
  const [showMetrics, setShowMetrics] = useState(true)
  const [showRecipientDetails, setShowRecipientDetails] = useState(false)
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null)
  const [recipientMetrics, setRecipientMetrics] = useState<RecipientMetrics[]>([])

  useEffect(() => {
    if (recipients.length > 0) {
      const { metrics, recipientMetrics } = generateMockMetrics(recipients)
      setMetrics(metrics)
      setRecipientMetrics(recipientMetrics)
    }
  }, [recipients])

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  if (!metrics || !visible) return null

  const deliveredRate = calculatePercentage(metrics.delivered, metrics.sent)
  const openRate = calculatePercentage(metrics.opened, metrics.delivered)
  const clickRate = calculatePercentage(metrics.clicked, metrics.opened)
  const replyRate = calculatePercentage(metrics.replied, metrics.sent)

  return (
    <div className="mt-4 space-y-3 border rounded-md p-3 bg-muted/20">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <BarChart className="h-4 w-4 text-primary" />
          <span className="font-medium">이메일 성과</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5"
          onClick={() => setShowMetrics(!showMetrics)}
        >
          {showMetrics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {showMetrics && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col border rounded p-2">
              <span className="text-muted-foreground">전달율</span>
              <div className="flex items=end gap-1">
                <span className="text-lg font-semibold">{deliveredRate}%</span>
                <span className="text-xs text-muted-foreground">
                  ({metrics.delivered}/{metrics.sent})
                </span>
              </div>
              <div className="w-full bg-muted h-1.5 mt-1 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${deliveredRate}%` }}
                ></div>
              </div>
            </div>

            <div className="flex flex-col border rounded p-2">
              <span className="text-muted-foreground">오픈율</span>
              <div className="flex items=end gap-1">
                <span className="text-lg font-semibold">{openRate}%</span>
                <span className="text-xs text-muted-foreground">
                  ({metrics.opened}/{metrics.delivered})
                </span>
              </div>
              <div className="w-full bg-muted h-1.5 mt-1 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${openRate}%` }}
                ></div>
              </div>
            </div>

            <div className="flex flex-col border rounded p-2">
              <span className="text-muted-foreground">클릭율</span>
              <div className="flex items=end gap-1">
                <span className="text-lg font-semibold">{clickRate}%</span>
                <span className="text-xs text-muted-foreground">
                  ({metrics.clicked}/{metrics.opened})
                </span>
              </div>
              <div className="w-full bg-muted h-1.5 mt-1 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${clickRate}%` }}
                ></div>
              </div>
            </div>

            <div className="flex flex-col border rounded p-2">
              <span className="text-muted-foreground">답변율</span>
              <div className="flex items=end gap-1">
                <span className="text-lg font-semibold">{replyRate}%</span>
                <span className="text-xs text-muted-foreground">
                  ({metrics.replied}/{metrics.sent})
                </span>
              </div>
              <div className="w-full bg-muted h-1.5 mt-1 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${replyRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">수신자별 지표</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5"
                onClick={() => setShowRecipientDetails(!showRecipientDetails)}
              >
                {showRecipientDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>

            {showRecipientDetails && (
              <div className="border rounded max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-1.5">수신자</th>
                      <th className="text-center p-1.5">전달</th>
                      <th className="text-center p-1.5">오픈</th>
                      <th className="text-center p-1.5">클릭</th>
                      <th className="text-center p-1.5">답변</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipientMetrics.map((recipient) => (
                      <tr key={recipient.email} className="border-t">
                        <td className="p-1.5">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {recipient.name || recipient.email.split("@")[0]}
                            </span>
                            <span className="text-muted-foreground text-[10px]">
                              {recipient.email}
                            </span>
                          </div>
                        </td>
                        <td className="text-center p-1.5">
                          {recipient.delivered ? (
                            <span className="text-green-500">✓</span>
                          ) : (
                            <span className="text-red-500">✗</span>
                          )}
                        </td>
                        <td className="text-center p-1.5">
                          {recipient.opened ? (
                            <div className="flex flex-col items-center">
                              <span className="text-green-500">✓</span>
                              {recipient.openTime && (
                                <span className="text-[10px] text-muted-foreground">
                                  {recipient.openTime}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-red-500">✗</span>
                          )}
                        </td>
                        <td className="text-center p-1.5">
                          {recipient.clicked ? (
                            <div className="flex flex-col items=center">
                              <span className="text-green-500">✓</span>
                              {recipient.clickTime && (
                                <span className="text-[10px] text-muted-foreground">
                                  {recipient.clickTime}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-red-500">✗</span>
                          )}
                        </td>
                        <td className="text-center p-1.5">
                          {recipient.replied ? (
                            <div className="flex flex-col items=center">
                              <span className="text-green-500">✓</span>
                              {recipient.replyTime && (
                                <span className="text-[10px] text-muted-foreground">
                                  {recipient.replyTime}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-red-500">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
