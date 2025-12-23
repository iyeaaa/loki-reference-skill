import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Wand2,
} from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  useGenerateEmailDraft,
  useGenerateFollowup,
  useGenerateSummary,
  useGenerateTemplate,
} from "@/lib/api/hooks/ai-email"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

// Validation constants
const VALIDATION = {
  MIN_PROMPT_LENGTH: 10,
  TEXTAREA_ROWS: 6,
  TEMPLATE_PROMPT_ROWS: 4,
  SCROLL_DELAY_MS: 100,
  COPIED_FEEDBACK_DURATION_MS: 2000,
} as const

// Sample data for quick testing
const SAMPLE_DATA = {
  reply: {
    fromEmail: "john.buyer@example.com",
    subject: "RE: Product Inquiry - Custom Manufacturing Solutions",
    content: `Hi,

Thank you for reaching out about your manufacturing solutions. We are currently looking for a reliable supplier for custom metal parts.

Could you please provide more information about:
1. Your minimum order quantities
2. Lead times for custom orders
3. Quality certifications you hold

We have an urgent project starting next month and need to finalize our supplier selection soon.

Best regards,
John Smith
Procurement Manager
ABC Industries`,
  },
  template: {
    country: "United States",
    prompts: [
      {
        label: "Cold outreach - Initial contact",
        value:
          "Write a professional cold email to introduce our company and request a meeting to discuss potential partnership opportunities.",
      },
      {
        label: "Follow-up after meeting",
        value:
          "Write a follow-up email after an initial meeting, summarizing key discussion points and proposing next steps.",
      },
      {
        label: "Product introduction",
        value:
          "Write an email introducing our new product line and highlighting key benefits for the recipient's business.",
      },
      {
        label: "Trade show invitation",
        value:
          "Write an email inviting the recipient to visit our booth at an upcoming trade show, mentioning special offers for attendees.",
      },
    ],
  },
}

export function EmailDraftTest() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle>{t("settings.emailDraftTest.title")}</CardTitle>
          </div>
          <CardDescription>{t("settings.emailDraftTest.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs className="w-full" defaultValue="reply">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger className="flex items-center gap-1" value="reply">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">{t("settings.emailDraftTest.tabs.reply")}</span>
              </TabsTrigger>
              <TabsTrigger className="flex items-center gap-1" value="template">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("settings.emailDraftTest.tabs.template")}
                </span>
              </TabsTrigger>
              <TabsTrigger className="flex items-center gap-1" value="followup">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("settings.emailDraftTest.tabs.followup")}
                </span>
              </TabsTrigger>
              <TabsTrigger className="flex items-center gap-1" value="summary">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("settings.emailDraftTest.tabs.summary")}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent className="mt-4" value="reply">
              <EmailReplyTestForm />
            </TabsContent>

            <TabsContent className="mt-4" value="template">
              <TemplateGenerationTestForm />
            </TabsContent>

            <TabsContent className="mt-4" value="followup">
              <FollowupTestForm />
            </TabsContent>

            <TabsContent className="mt-4" value="summary">
              <SummaryTestForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Copy to clipboard with toast feedback
 */
function useCopyToClipboard() {
  const { t } = useTranslation()
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copy = useCallback(
    (text: string, fieldName?: string) => {
      navigator.clipboard.writeText(text)
      toast.success(t("settings.emailDraftTest.copied"))
      if (fieldName) {
        setCopiedField(fieldName)
        setTimeout(() => setCopiedField(null), VALIDATION.COPIED_FEEDBACK_DURATION_MS)
      }
    },
    [t],
  )

  return { copy, copiedField }
}

/**
 * Copy button with feedback
 */
function CopyButton({
  text,
  fieldName,
  copiedField,
  onCopy,
}: {
  text: string
  fieldName: string
  copiedField: string | null
  onCopy: (text: string, fieldName: string) => void
}) {
  const isCopied = copiedField === fieldName

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="h-6 px-2"
            onClick={() => onCopy(text, fieldName)}
            size="sm"
            variant="ghost"
          >
            {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isCopied ? "Copied!" : "Copy"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Email Reply Draft Generation Test Form
 */
function EmailReplyTestForm() {
  const { t } = useTranslation()
  const fromEmailId = useId()
  const subjectId = useId()
  const contentId = useId()
  const resultRef = useRef<HTMLDivElement>(null)

  const generateDraft = useGenerateEmailDraft()
  const { copy, copiedField } = useCopyToClipboard()

  const [fromEmail, setFromEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [result, setResult] = useState<{ body: string; subject: string } | null>(null)
  const [showResult, setShowResult] = useState(true)

  const canSubmit =
    fromEmail.trim().length > 0 && content.trim().length > 0 && !generateDraft.isPending

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    try {
      const trimmedSubject = subject.trim()
      const response = await generateDraft.mutateAsync({
        fromEmail: fromEmail.trim(),
        subject: trimmedSubject.length > 0 ? trimmedSubject : undefined,
        content: content.trim(),
      })
      setResult(response)
      setShowResult(true)
      // Scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, VALIDATION.SCROLL_DELAY_MS)
    } catch (error) {
      console.error("Failed to generate email draft:", error)
      setResult(null)
    }
  }

  const handleFillSample = () => {
    setFromEmail(SAMPLE_DATA.reply.fromEmail)
    setSubject(SAMPLE_DATA.reply.subject)
    setContent(SAMPLE_DATA.reply.content)
    toast.success(t("settings.emailDraftTest.sampleFilled"))
  }

  const handleReset = () => {
    setFromEmail("")
    setSubject("")
    setContent("")
    setResult(null)
  }

  // Keyboard shortcut: Cmd/Ctrl + Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault()
      handleGenerate(e as unknown as React.FormEvent)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Keyboard shortcut handler for form submission
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            {t("settings.emailDraftTest.reply.hint")}
          </p>
        </div>
        <div className="flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleFillSample} size="sm" variant="outline">
                  <Wand2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("settings.emailDraftTest.fillSample")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleReset} size="sm" variant="outline">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("settings.emailDraftTest.reset")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleGenerate}>
        <div className="space-y-2">
          <Label htmlFor={fromEmailId}>{t("settings.emailDraftTest.reply.fromEmail")}</Label>
          <Input
            id={fromEmailId}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="sender@example.com"
            required
            type="email"
            value={fromEmail}
          />
          <p className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.reply.fromEmailHint")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={subjectId}>{t("settings.emailDraftTest.reply.subject")}</Label>
          <Input
            id={subjectId}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("settings.emailDraftTest.reply.subjectPlaceholder")}
            value={subject}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={contentId}>{t("settings.emailDraftTest.reply.content")}</Label>
          <Textarea
            id={contentId}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("settings.emailDraftTest.reply.contentPlaceholder")}
            required
            rows={VALIDATION.TEXTAREA_ROWS}
            value={content}
          />
          <p className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.reply.contentHint")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button className="w-full sm:w-auto" disabled={!canSubmit} type="submit">
            {generateDraft.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {generateDraft.isPending
              ? t("settings.emailDraftTest.generating")
              : t("settings.emailDraftTest.generate")}
          </Button>
          <span className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.shortcutHint")}
          </span>
        </div>
      </form>

      {result && (
        <div ref={resultRef}>
          <Separator />
          <ResultCard
            onToggle={() => setShowResult(!showResult)}
            show={showResult}
            title={t("settings.emailDraftTest.result.title")}
          >
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">
                    {t("settings.emailDraftTest.result.subject")}
                  </Label>
                  <CopyButton
                    copiedField={copiedField}
                    fieldName="reply-subject"
                    onCopy={copy}
                    text={result.subject}
                  />
                </div>
                <div className="rounded-md bg-muted p-3 text-sm">{result.subject}</div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">
                    {t("settings.emailDraftTest.result.body")}
                  </Label>
                  <CopyButton
                    copiedField={copiedField}
                    fieldName="reply-body"
                    onCopy={copy}
                    text={result.body}
                  />
                </div>
                <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                  {result.body}
                </div>
              </div>
            </div>
          </ResultCard>
        </div>
      )}
    </div>
  )
}

/**
 * Template Generation Test Form
 */
function TemplateGenerationTestForm() {
  const { t } = useTranslation()
  const countryId = useId()
  const promptId = useId()
  const modelId = useId()
  const temperatureId = useId()
  const resultRef = useRef<HTMLDivElement>(null)

  const { data: workspaces, isLoading: workspacesLoading } = useUserWorkspaces(true)
  const generateTemplate = useGenerateTemplate()
  const { copy, copiedField } = useCopyToClipboard()

  const [workspaceId, setWorkspaceId] = useState("")
  const [country, setCountry] = useState("")
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState("gpt-4o-mini")
  const [temperature, setTemperature] = useState("0.7")
  const [result, setResult] = useState<{
    emailSubject: string
    emailBodyText: string
    emailBodyHtml: string
    detectedLanguage: string
  } | null>(null)
  const [showResult, setShowResult] = useState(true)

  // Auto-select first workspace
  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !workspaceId) {
      setWorkspaceId(workspaces[0].id)
    }
  }, [workspaces, workspaceId])

  const canSubmit =
    workspaceId.trim().length > 0 &&
    country.trim().length > 0 &&
    prompt.trim().length >= VALIDATION.MIN_PROMPT_LENGTH &&
    !generateTemplate.isPending

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    try {
      const trimmedModel = model.trim()
      const trimmedTemperature = temperature.trim()
      const response = await generateTemplate.mutateAsync({
        workspaceId: workspaceId.trim(),
        country: country.trim(),
        prompt: prompt.trim(),
        model: trimmedModel.length > 0 ? trimmedModel : undefined,
        temperature:
          trimmedTemperature.length > 0 ? Number.parseFloat(trimmedTemperature) : undefined,
      })
      setResult(response)
      setShowResult(true)
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, VALIDATION.SCROLL_DELAY_MS)
    } catch (error) {
      console.error("Failed to generate email template:", error)
      setResult(null)
    }
  }

  const handleFillSample = () => {
    setCountry(SAMPLE_DATA.template.country)
    setPrompt(SAMPLE_DATA.template.prompts[0].value)
    toast.success(t("settings.emailDraftTest.sampleFilled"))
  }

  const handleReset = () => {
    setCountry("")
    setPrompt("")
    setResult(null)
  }

  const handleSelectPrompt = (promptValue: string) => {
    setPrompt(promptValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault()
      handleGenerate(e as unknown as React.FormEvent)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Keyboard shortcut handler for form submission
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
          <p className="text-green-800 text-sm dark:text-green-200">
            {t("settings.emailDraftTest.template.hint")}
          </p>
        </div>
        <div className="flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleFillSample} size="sm" variant="outline">
                  <Wand2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("settings.emailDraftTest.fillSample")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleReset} size="sm" variant="outline">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("settings.emailDraftTest.reset")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleGenerate}>
        <div className="space-y-2">
          <Label>{t("settings.emailDraftTest.template.workspace")}</Label>
          <Select onValueChange={setWorkspaceId} value={workspaceId}>
            <SelectTrigger>
              <SelectValue
                placeholder={t("settings.emailDraftTest.template.workspacePlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {workspacesLoading ? (
                <SelectItem disabled value="loading">
                  {t("common.loading")}
                </SelectItem>
              ) : (
                workspaces?.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.template.workspaceHint")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={countryId}>{t("settings.emailDraftTest.template.country")}</Label>
          <Input
            id={countryId}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t("settings.emailDraftTest.template.countryPlaceholder")}
            required
            value={country}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={promptId}>{t("settings.emailDraftTest.template.prompt")}</Label>
            <Select onValueChange={handleSelectPrompt} value="">
              <SelectTrigger className="h-7 w-auto gap-1 text-xs">
                <Sparkles className="h-3 w-3" />
                <SelectValue placeholder={t("settings.emailDraftTest.examplePrompts")} />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_DATA.template.prompts.map((p, i) => (
                  <SelectItem key={i} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            id={promptId}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("settings.emailDraftTest.template.promptPlaceholder")}
            required
            rows={VALIDATION.TEMPLATE_PROMPT_ROWS}
            value={prompt}
          />
          <p className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.template.promptHint")}
            <span className="ml-1 text-muted-foreground/70">
              ({prompt.length}/{VALIDATION.MIN_PROMPT_LENGTH} {t("settings.emailDraftTest.chars")})
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={modelId}>{t("settings.emailDraftTest.template.model")}</Label>
            <Select onValueChange={setModel} value={model}>
              <SelectTrigger id={modelId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={temperatureId}>
              {t("settings.emailDraftTest.template.temperature")}
            </Label>
            <Input
              id={temperatureId}
              max="2"
              min="0"
              onChange={(e) => setTemperature(e.target.value)}
              step="0.1"
              type="number"
              value={temperature}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button className="w-full sm:w-auto" disabled={!canSubmit} type="submit">
            {generateTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {generateTemplate.isPending
              ? t("settings.emailDraftTest.generating")
              : t("settings.emailDraftTest.generate")}
          </Button>
          <span className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.shortcutHint")}
          </span>
        </div>
      </form>

      {result && (
        <div ref={resultRef}>
          <Separator />
          <ResultCard
            onToggle={() => setShowResult(!showResult)}
            show={showResult}
            title={t("settings.emailDraftTest.result.title")}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{result.detectedLanguage}</Badge>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">
                    {t("settings.emailDraftTest.result.subject")}
                  </Label>
                  <CopyButton
                    copiedField={copiedField}
                    fieldName="template-subject"
                    onCopy={copy}
                    text={result.emailSubject}
                  />
                </div>
                <div className="rounded-md bg-muted p-3 text-sm">{result.emailSubject}</div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">
                    {t("settings.emailDraftTest.result.bodyText")}
                  </Label>
                  <CopyButton
                    copiedField={copiedField}
                    fieldName="template-bodyText"
                    onCopy={copy}
                    text={result.emailBodyText}
                  />
                </div>
                <div className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                  {result.emailBodyText}
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">
                    {t("settings.emailDraftTest.result.bodyHtml")}
                  </Label>
                  <CopyButton
                    copiedField={copiedField}
                    fieldName="template-bodyHtml"
                    onCopy={copy}
                    text={result.emailBodyHtml}
                  />
                </div>
                <iframe
                  className="max-h-60 w-full overflow-auto rounded-md border bg-white dark:bg-zinc-950"
                  sandbox=""
                  srcDoc={result.emailBodyHtml}
                  title="HTML Preview"
                />
              </div>
            </div>
          </ResultCard>
        </div>
      )}
    </div>
  )
}

/**
 * Follow-up Generation Test Form
 */
function FollowupTestForm() {
  const { t } = useTranslation()
  const threadIdId = useId()
  const resultRef = useRef<HTMLDivElement>(null)

  const { data: workspaces, isLoading: workspacesLoading } = useUserWorkspaces(true)
  const generateFollowup = useGenerateFollowup()
  const { copy, copiedField } = useCopyToClipboard()

  const [threadId, setThreadId] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")
  const [result, setResult] = useState<{
    threadId: string
    subject: string
    emailCount: number
    rawResponse: string
  } | null>(null)
  const [showResult, setShowResult] = useState(true)

  const canSubmit = threadId.trim().length > 0 && !generateFollowup.isPending

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    try {
      const trimmedWorkspaceId = workspaceId.trim()
      const response = await generateFollowup.mutateAsync({
        threadId: threadId.trim(),
        workspaceId: trimmedWorkspaceId.length > 0 ? trimmedWorkspaceId : undefined,
      })
      setResult(response)
      setShowResult(true)
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, VALIDATION.SCROLL_DELAY_MS)
    } catch (error) {
      console.error("Failed to generate follow-up email:", error)
      setResult(null)
    }
  }

  const handleReset = () => {
    setThreadId("")
    setWorkspaceId("")
    setResult(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault()
      handleGenerate(e as unknown as React.FormEvent)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Keyboard shortcut handler for form submission
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950">
          <p className="text-purple-800 text-sm dark:text-purple-200">
            {t("settings.emailDraftTest.followup.hint")}
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleReset} size="sm" variant="outline">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("settings.emailDraftTest.reset")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <form className="space-y-4" onSubmit={handleGenerate}>
        <div className="space-y-2">
          <Label htmlFor={threadIdId}>{t("settings.emailDraftTest.followup.threadId")}</Label>
          <Input
            id={threadIdId}
            onChange={(e) => setThreadId(e.target.value)}
            placeholder={t("settings.emailDraftTest.followup.threadIdPlaceholder")}
            required
            value={threadId}
          />
          <p className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.followup.threadIdHint")}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t("settings.emailDraftTest.followup.workspace")}</Label>
          <Select onValueChange={setWorkspaceId} value={workspaceId}>
            <SelectTrigger>
              <SelectValue
                placeholder={t("settings.emailDraftTest.followup.workspacePlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("settings.emailDraftTest.followup.allWorkspaces")}
              </SelectItem>
              {workspacesLoading ? (
                <SelectItem disabled value="loading">
                  {t("common.loading")}
                </SelectItem>
              ) : (
                workspaces?.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button className="w-full sm:w-auto" disabled={!canSubmit} type="submit">
            {generateFollowup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {generateFollowup.isPending
              ? t("settings.emailDraftTest.generating")
              : t("settings.emailDraftTest.generate")}
          </Button>
          <span className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.shortcutHint")}
          </span>
        </div>
      </form>

      {result && (
        <div ref={resultRef}>
          <Separator />
          <ResultCard
            onToggle={() => setShowResult(!showResult)}
            show={showResult}
            title={t("settings.emailDraftTest.result.title")}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Thread: {result.threadId.slice(0, 8)}...</Badge>
                <Badge variant="secondary">
                  {result.emailCount} {t("settings.emailDraftTest.result.emails")}
                </Badge>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">
                    {t("settings.emailDraftTest.result.subject")}
                  </Label>
                </div>
                <div className="rounded-md bg-muted p-3 text-sm">{result.subject}</div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">
                    {t("settings.emailDraftTest.result.followupSuggestion")}
                  </Label>
                  <CopyButton
                    copiedField={copiedField}
                    fieldName="followup-response"
                    onCopy={copy}
                    text={result.rawResponse}
                  />
                </div>
                <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                  {result.rawResponse}
                </div>
              </div>
            </div>
          </ResultCard>
        </div>
      )}
    </div>
  )
}

/**
 * Summary Generation Test Form
 */
function SummaryTestForm() {
  const { t } = useTranslation()
  const threadIdId = useId()
  const resultRef = useRef<HTMLDivElement>(null)

  const { data: workspaces, isLoading: workspacesLoading } = useUserWorkspaces(true)
  const generateSummary = useGenerateSummary()
  const { copy, copiedField } = useCopyToClipboard()

  const [threadId, setThreadId] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")
  const [language, setLanguage] = useState("ko")
  const [result, setResult] = useState<{
    threadId: string
    subject: string
    emailCount: number
    summary: string
  } | null>(null)
  const [showResult, setShowResult] = useState(true)

  const canSubmit = threadId.trim().length > 0 && !generateSummary.isPending

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      return
    }

    try {
      const trimmedWorkspaceId = workspaceId.trim()
      const trimmedLanguage = language.trim()
      const response = await generateSummary.mutateAsync({
        threadId: threadId.trim(),
        workspaceId: trimmedWorkspaceId.length > 0 ? trimmedWorkspaceId : undefined,
        language: trimmedLanguage.length > 0 ? trimmedLanguage : undefined,
      })
      setResult(response)
      setShowResult(true)
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, VALIDATION.SCROLL_DELAY_MS)
    } catch (error) {
      console.error("Failed to generate conversation summary:", error)
      setResult(null)
    }
  }

  const handleReset = () => {
    setThreadId("")
    setWorkspaceId("")
    setResult(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault()
      handleGenerate(e as unknown as React.FormEvent)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Keyboard shortcut handler for form submission
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-amber-800 text-sm dark:text-amber-200">
            {t("settings.emailDraftTest.summary.hint")}
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleReset} size="sm" variant="outline">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("settings.emailDraftTest.reset")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <form className="space-y-4" onSubmit={handleGenerate}>
        <div className="space-y-2">
          <Label htmlFor={threadIdId}>{t("settings.emailDraftTest.summary.threadId")}</Label>
          <Input
            id={threadIdId}
            onChange={(e) => setThreadId(e.target.value)}
            placeholder={t("settings.emailDraftTest.summary.threadIdPlaceholder")}
            required
            value={threadId}
          />
          <p className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.summary.threadIdHint")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("settings.emailDraftTest.summary.workspace")}</Label>
            <Select onValueChange={setWorkspaceId} value={workspaceId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={t("settings.emailDraftTest.summary.workspacePlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("settings.emailDraftTest.summary.allWorkspaces")}
                </SelectItem>
                {workspacesLoading ? (
                  <SelectItem disabled value="loading">
                    {t("common.loading")}
                  </SelectItem>
                ) : (
                  workspaces?.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.emailDraftTest.summary.language")}</Label>
            <Select onValueChange={setLanguage} value={language}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button className="w-full sm:w-auto" disabled={!canSubmit} type="submit">
            {generateSummary.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {generateSummary.isPending
              ? t("settings.emailDraftTest.generating")
              : t("settings.emailDraftTest.generate")}
          </Button>
          <span className="text-muted-foreground text-xs">
            {t("settings.emailDraftTest.shortcutHint")}
          </span>
        </div>
      </form>

      {result && (
        <div ref={resultRef}>
          <Separator />
          <ResultCard
            onToggle={() => setShowResult(!showResult)}
            show={showResult}
            title={t("settings.emailDraftTest.result.title")}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Thread: {result.threadId.slice(0, 8)}...</Badge>
                <Badge variant="secondary">
                  {result.emailCount} {t("settings.emailDraftTest.result.emails")}
                </Badge>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">
                    {t("settings.emailDraftTest.result.subject")}
                  </Label>
                </div>
                <div className="rounded-md bg-muted p-3 text-sm">{result.subject}</div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">
                    {t("settings.emailDraftTest.result.summary")}
                  </Label>
                  <CopyButton
                    copiedField={copiedField}
                    fieldName="summary-result"
                    onCopy={copy}
                    text={result.summary}
                  />
                </div>
                <div className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                  {result.summary}
                </div>
              </div>
            </div>
          </ResultCard>
        </div>
      )}
    </div>
  )
}

/**
 * Result Card Component
 */
function ResultCard({
  title,
  show,
  onToggle,
  children,
}: {
  title: string
  show: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mt-4 rounded-lg border bg-card">
      <button
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <span className="font-medium">{title}</span>
        {show ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {show && <div className="border-t p-4">{children}</div>}
    </div>
  )
}
