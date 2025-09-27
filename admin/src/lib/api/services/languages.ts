import { apiFetch } from "@/lib/api/client"
import type { Language } from "../types/user"

export const languagesApi = {
  list: () => {
    // Since there's no languages table in the backend schema,
    // return a static list of common languages for now
    return Promise.resolve<Language[]>([
      { id: "1", code: "ko", name: "한국어", nativeName: "한국어", isActive: true },
      { id: "2", code: "en", name: "영어", nativeName: "English", isActive: true },
      { id: "3", code: "ja", name: "일본어", nativeName: "日本語", isActive: true },
      { id: "4", code: "zh", name: "중국어", nativeName: "中文", isActive: true },
      { id: "5", code: "es", name: "스페인어", nativeName: "Español", isActive: true },
      { id: "6", code: "fr", name: "프랑스어", nativeName: "Français", isActive: true },
      { id: "7", code: "de", name: "독일어", nativeName: "Deutsch", isActive: true },
    ])
  },

  get: (id: string) => {
    return languagesApi.list().then((languages) => {
      const language = languages.find((l) => l.id === id)
      if (!language) throw new Error("Language not found")
      return language
    })
  },
}
