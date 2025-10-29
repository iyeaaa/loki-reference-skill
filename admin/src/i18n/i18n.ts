/**
 * i18next 초기화 설정
 */

import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import enTranslation from "./generated/en.json"
// 생성된 번역 파일 import
import koTranslation from "./generated/ko.json"

const resources = {
  ko: {
    translation: koTranslation,
  },
  en: {
    translation: enTranslation,
  },
}

i18n
  // 브라우저 언어 감지
  .use(LanguageDetector)
  // React와 연동
  .use(initReactI18next)
  // 초기화
  .init({
    resources,
    fallbackLng: "ko", // 기본 언어
    supportedLngs: ["ko", "en"], // 지원 언어

    // 언어 감지 설정
    detection: {
      order: ["localStorage", "navigator"], // localStorage 우선, 그 다음 브라우저 설정
      caches: ["localStorage"], // localStorage에 저장
      lookupLocalStorage: "i18nextLng", // localStorage 키 이름
    },

    interpolation: {
      escapeValue: false, // React는 자동으로 XSS 방어
    },

    pluralSeparator: "_",

    // 디버그 모드 (개발 환경에서만 활성화)
    debug: import.meta.env.DEV,

    // 네임스페이스 설정
    defaultNS: "translation",
    ns: ["translation"],
  })

export default i18n
