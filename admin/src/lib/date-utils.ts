export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return "-"

  const now = new Date()
  const targetDate = typeof date === "string" ? new Date(date) : date
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return "방금 전"
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}분 전`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}시간 전`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}일 전`
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return `${diffInWeeks}주 전`
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths}개월 전`
  }

  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears}년 전`
}

// 한국 시간대로 날짜/시간 표시: "10월 6일 (월) 오후 9:56 (2시간 전)"
export function formatKoreanDateTime(date: Date | string | null): string {
  if (!date) return "-"

  const targetDate = typeof date === "string" ? new Date(date) : date

  // 한국 시간대로 변환
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  const parts = formatter.formatToParts(targetDate)
  const month = parts.find((p) => p.type === "month")?.value || ""
  const day = parts.find((p) => p.type === "day")?.value || ""
  const weekday = parts.find((p) => p.type === "weekday")?.value || ""
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value || ""
  const hour = parts.find((p) => p.type === "hour")?.value || ""
  const minute = parts.find((p) => p.type === "minute")?.value || ""

  // 상대적 시간
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000)

  let relativeTime = ""
  if (diffInSeconds < 60) {
    relativeTime = "방금 전"
  } else {
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      relativeTime = `${diffInMinutes}분 전`
    } else {
      const diffInHours = Math.floor(diffInMinutes / 60)
      if (diffInHours < 24) {
        relativeTime = `${diffInHours}시간 전`
      } else {
        const diffInDays = Math.floor(diffInHours / 24)
        if (diffInDays < 7) {
          relativeTime = `${diffInDays}일 전`
        } else if (diffInDays < 30) {
          const diffInWeeks = Math.floor(diffInDays / 7)
          relativeTime = `${diffInWeeks}주 전`
        } else if (diffInDays < 365) {
          const diffInMonths = Math.floor(diffInDays / 30)
          relativeTime = `${diffInMonths}개월 전`
        } else {
          const diffInYears = Math.floor(diffInDays / 365)
          relativeTime = `${diffInYears}년 전`
        }
      }
    }
  }

  return `${month} ${day}일 (${weekday}) ${dayPeriod} ${hour}:${minute} (${relativeTime})`
}

export function formatDateTime(date: Date | string): string {
  const targetDate = typeof date === "string" ? new Date(date) : date
  return targetDate.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDate(date: Date | string): string {
  const targetDate = typeof date === "string" ? new Date(date) : date
  return targetDate.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}
