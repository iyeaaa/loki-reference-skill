import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type CountryFlagProps = {
  countryName?: string
  size?: "sm" | "md" | "lg"
  showText?: boolean
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
}

// Country name to ISO Alpha-2 code mapping
const countryCodeMap: Record<string, string> = {
  japan: "JP",
  germany: "DE",
  "united states": "US",
  usa: "US",
  "united kingdom": "GB",
  uk: "GB",
  france: "FR",
  italy: "IT",
  spain: "ES",
  canada: "CA",
  australia: "AU",
  brazil: "BR",
  india: "IN",
  china: "CN",
  "south korea": "KR",
  korea: "KR",
  mexico: "MX",
  netherlands: "NL",
  switzerland: "CH",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  austria: "AT",
  belgium: "BE",
  poland: "PL",
  portugal: "PT",
  ireland: "IE",
  "new zealand": "NZ",
  singapore: "SG",
  "hong kong": "HK",
  taiwan: "TW",
  thailand: "TH",
  vietnam: "VN",
  philippines: "PH",
  indonesia: "ID",
  malaysia: "MY",
  israel: "IL",
  "saudi arabia": "SA",
  "united arab emirates": "AE",
  uae: "AE",
  turkey: "TR",
  russia: "RU",
  "south africa": "ZA",
  egypt: "EG",
  argentina: "AR",
  chile: "CL",
  colombia: "CO",
  peru: "PE",
}

function getCountryCode(countryName: string): string | null {
  return countryCodeMap[countryName.toLowerCase()] || null
}

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127_397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export function CountryFlag({ countryName, size = "md", showText = false }: CountryFlagProps) {
  if (!countryName) {
    if (showText) {
      return <span className="text-gray-400">-</span>
    }
    return null
  }

  const countryCode = getCountryCode(countryName)
  const flagEmoji = countryCode ? getFlagEmoji(countryCode) : "🌐"
  const sizeClass = sizeClasses[size]

  if (showText) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={sizeClass}>{flagEmoji}</span>
        <span>{countryName}</span>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`${sizeClass} inline-block cursor-default`}>{flagEmoji}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{countryName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
