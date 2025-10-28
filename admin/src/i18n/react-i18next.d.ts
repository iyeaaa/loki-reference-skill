/**
 * react-i18next 타입 정의
 * TypeScript에서 번역 키에 대한 타입 체킹 제공
 */

import "react-i18next"
import type translation from "./generated/ko.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation"
    resources: {
      translation: typeof translation
    }
  }
}
