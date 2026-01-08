import { useState } from "react"

type CompanyAvatarProps = {
  companyName: string
  websiteUrl?: string
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "h-5 w-5 text-[10px]",
  md: "h-6 w-6 text-xs",
  lg: "h-8 w-8 text-sm",
}

export function CompanyAvatar({ companyName, websiteUrl, size = "md" }: CompanyAvatarProps) {
  const [imageError, setImageError] = useState(false)

  const getFaviconUrl = (url?: string) => {
    if (!url) {
      return null
    }
    try {
      const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`)
      return `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`
    } catch {
      return null
    }
  }

  const faviconUrl = getFaviconUrl(websiteUrl)
  const sizeClass = sizeClasses[size]

  if (faviconUrl && !imageError) {
    return (
      <img
        alt={`${companyName} favicon`}
        className={`${sizeClass} shrink-0 rounded-full`}
        onError={() => setImageError(true)}
        src={faviconUrl}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600`}
    >
      {companyName.charAt(0).toUpperCase()}
    </div>
  )
}
