import { Globe } from "lucide-react"
import { useContext } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarContext } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const languages = [
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "en", name: "English", flag: "🇺🇸" },
]

type LanguageSwitcherProps = {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const sidebarContext = useContext(SidebarContext)
  const state = sidebarContext?.state
  const isMobile = sidebarContext?.isMobile

  const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0]

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode)
  }

  const button = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            "h-10 justify-start px-3 py-2 hover:bg-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2",
            className,
          )}
          size="sm"
          variant="ghost"
        >
          <Globe className="mr-3 h-4 w-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:mr-0" />
          <span className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <span>{currentLanguage.flag}</span>
            <span className="font-normal">{currentLanguage.name}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right">
        {languages.map((language) => (
          <DropdownMenuItem
            className={i18n.language === language.code ? "bg-accent" : ""}
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
          >
            <span className="mr-2">{language.flag}</span>
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Show tooltip only when collapsed
  if (state === "collapsed" && !isMobile) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent align="center" side="right">
          {currentLanguage.name}
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}
