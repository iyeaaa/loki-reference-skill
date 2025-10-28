import { Globe } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Language = "ko" | "en"

interface LanguageToggleProps {
  className?: string
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>("ko")

  const languages = [
    { code: "ko", name: "한국어", flag: "🇰🇷" },
    { code: "en", name: "English", flag: "🇺🇸" },
  ] as const

  const handleLanguageChange = (language: Language) => {
    setCurrentLanguage(language)
    // 여기에 실제 언어 변경 로직을 추가할 수 있습니다
    console.log("Language changed to:", language)
  }

  const currentLangData = languages.find((lang) => lang.code === currentLanguage)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={`h-8 w-auto px-2 ${className}`}>
          <Globe className="h-4 w-4 mr-1" />
          <span className="hidden group-data-[collapsible=icon]:hidden">
            {currentLangData?.flag} {currentLangData?.name}
          </span>
          <span className="group-data-[collapsible=icon]:block hidden">
            {currentLangData?.flag}
          </span>
          <span>{currentLangData?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code as Language)}
            className={`flex items-center gap-2 ${
              currentLanguage === language.code ? "bg-accent" : ""
            }`}
          >
            <span>{language.flag}</span>
            <span>{language.name}</span>
            {currentLanguage === language.code && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
