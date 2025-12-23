import { Check, Globe } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const languages = [
  { code: "ko", name: "한국어", flag: "🇰🇷", description: "Korean" },
  { code: "en", name: "English", flag: "🇺🇸", description: "영어" },
]

export function LanguageSettings() {
  const { t, i18n } = useTranslation()

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode)
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-1.5">
          <Globe className="h-4 w-4" />
          <CardTitle className="text-base">{t("settings.language.title")}</CardTitle>
        </div>
        <CardDescription className="text-xs">{t("settings.language.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid max-w-md gap-3">
          {languages.map((language) => {
            const isActive = i18n.language === language.code
            return (
              <button
                className={cn(
                  "flex items-center justify-between rounded-lg border p-4 text-left transition-all hover:border-primary/50 hover:bg-accent/50",
                  isActive && "border-primary bg-primary/5",
                )}
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                type="button"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{language.flag}</span>
                  <div>
                    <div className="font-medium">{language.name}</div>
                    <div className="text-muted-foreground text-sm">{language.description}</div>
                  </div>
                </div>
                {isActive && <Check className="h-5 w-5 text-primary" />}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
