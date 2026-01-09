/**
 * Country Name Normalizer
 * ISO 3166-1 기반 국가명 정규화 유틸리티
 *
 * 다양한 형태의 국가명(ISO 코드, 한국어, 영어, 현지어 등)을 표준 영문명으로 변환
 */

import countries from "i18n-iso-countries"
import bgLocale from "i18n-iso-countries/langs/bg.json" // Bulgarian
import csLocale from "i18n-iso-countries/langs/cs.json" // Czech
import deLocale from "i18n-iso-countries/langs/de.json" // German
import enLocale from "i18n-iso-countries/langs/en.json" // English
import esLocale from "i18n-iso-countries/langs/es.json" // Spanish
import frLocale from "i18n-iso-countries/langs/fr.json" // French
import itLocale from "i18n-iso-countries/langs/it.json" // Italian
import jaLocale from "i18n-iso-countries/langs/ja.json" // Japanese
import koLocale from "i18n-iso-countries/langs/ko.json" // Korean
import nlLocale from "i18n-iso-countries/langs/nl.json" // Dutch
import plLocale from "i18n-iso-countries/langs/pl.json" // Polish
import ptLocale from "i18n-iso-countries/langs/pt.json" // Portuguese
import roLocale from "i18n-iso-countries/langs/ro.json" // Romanian
import ruLocale from "i18n-iso-countries/langs/ru.json" // Russian
import trLocale from "i18n-iso-countries/langs/tr.json" // Turkish
import ukLocale from "i18n-iso-countries/langs/uk.json" // Ukrainian
import viLocale from "i18n-iso-countries/langs/vi.json" // Vietnamese
import zhLocale from "i18n-iso-countries/langs/zh.json" // Chinese

// Register all locales for comprehensive country name lookups
countries.registerLocale(enLocale)
countries.registerLocale(koLocale)
countries.registerLocale(jaLocale)
countries.registerLocale(zhLocale)
countries.registerLocale(deLocale)
countries.registerLocale(frLocale)
countries.registerLocale(esLocale)
countries.registerLocale(itLocale)
countries.registerLocale(ptLocale)
countries.registerLocale(ruLocale)
countries.registerLocale(bgLocale)
countries.registerLocale(csLocale)
countries.registerLocale(plLocale)
countries.registerLocale(nlLocale)
countries.registerLocale(trLocale)
countries.registerLocale(viLocale)
countries.registerLocale(ukLocale)
countries.registerLocale(roLocale)

// All registered locales for iteration
const REGISTERED_LOCALES = [
  "en",
  "ko",
  "ja",
  "zh",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "ru",
  "bg",
  "cs",
  "pl",
  "nl",
  "tr",
  "vi",
  "uk",
  "ro",
]

/**
 * Custom mappings for edge cases not covered by i18n-iso-countries
 * Includes: common abbreviations, typos, alternate names, native scripts
 */
const CUSTOM_COUNTRY_MAPPINGS: Record<string, string> = {
  // === United States ===
  usa: "US",
  미국: "US",
  america: "US",
  "united states of america": "US",
  "the united states": "US",
  "u.s.": "US",
  "u.s.a.": "US",

  // === South Korea ===
  korea: "KR",
  한국: "KR",
  "south korea": "KR",
  "korea, south": "KR",
  "korea republic": "KR",
  "korea (south)": "KR",
  "republic of korea": "KR",
  대한민국: "KR",
  rok: "KR",

  // === North Korea ===
  "north korea": "KP",
  "korea, north": "KP",
  "korea (north)": "KP",
  북한: "KP",
  조선민주주의인민공화국: "KP",

  // === United Kingdom ===
  uk: "GB",
  영국: "GB",
  britain: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",

  // === China ===
  중국: "CN",
  prc: "CN",
  "people's republic of china": "CN",
  "mainland china": "CN",
  中国: "CN",
  中國: "CN",

  // === Japan ===
  일본: "JP",
  nippon: "JP",
  nihon: "JP",
  日本: "JP",

  // === Germany ===
  독일: "DE",
  deutschland: "DE",

  // === France ===
  프랑스: "FR",

  // === Canada ===
  캐나다: "CA",

  // === Australia ===
  호주: "AU",
  오스트레일리아: "AU",

  // === Netherlands ===
  네덜란드: "NL",
  holland: "NL",
  "the netherlands": "NL",

  // === Italy ===
  이탈리아: "IT",
  italia: "IT",

  // === Spain ===
  스페인: "ES",
  españa: "ES",
  espana: "ES",

  // === Brazil ===
  브라질: "BR",
  brasil: "BR",

  // === India ===
  인도: "IN",
  भारत: "IN",

  // === Mexico ===
  멕시코: "MX",
  méxico: "MX",

  // === Singapore ===
  싱가포르: "SG",

  // === Taiwan ===
  대만: "TW",
  taiwan: "TW",
  "chinese taipei": "TW",
  "taiwan, province of china": "TW",
  中華民國: "TW",
  臺灣: "TW",
  台湾: "TW",

  // === Hong Kong ===
  홍콩: "HK",
  "hong kong": "HK",
  香港: "HK",

  // === Vietnam ===
  베트남: "VN",
  vietnam: "VN",
  "viet nam": "VN",
  "việt nam": "VN",

  // === Thailand ===
  태국: "TH",
  ประเทศไทย: "TH",

  // === Indonesia ===
  인도네시아: "ID",

  // === Malaysia ===
  말레이시아: "MY",

  // === Philippines ===
  필리핀: "PH",

  // === Russia ===
  러시아: "RU",
  russia: "RU",
  "russian federation": "RU",
  россия: "RU",
  "российская федерация": "RU",

  // === Turkey ===
  터키: "TR",
  turkey: "TR",
  türkiye: "TR",
  turkiye: "TR",
  튀르키예: "TR",

  // === Saudi Arabia ===
  사우디아라비아: "SA",
  "saudi arabia": "SA",
  사우디: "SA",
  السعودية: "SA",

  // === UAE ===
  아랍에미리트: "AE",
  uae: "AE",
  "united arab emirates": "AE",
  두바이: "AE", // Dubai is in UAE
  الإمارات: "AE",

  // === Switzerland ===
  스위스: "CH",
  switzerland: "CH",
  suisse: "CH",
  schweiz: "CH",

  // === Sweden ===
  스웨덴: "SE",
  sverige: "SE",

  // === Poland ===
  폴란드: "PL",
  polska: "PL",

  // === Belgium ===
  벨기에: "BE",
  belgique: "BE",
  belgië: "BE",

  // === Austria ===
  오스트리아: "AT",
  österreich: "AT",

  // === New Zealand ===
  뉴질랜드: "NZ",
  "new zealand": "NZ",
  aotearoa: "NZ",

  // === Norway ===
  노르웨이: "NO",
  norge: "NO",

  // === Denmark ===
  덴마크: "DK",
  danmark: "DK",

  // === Finland ===
  핀란드: "FI",
  suomi: "FI",

  // === Ireland ===
  아일랜드: "IE",
  éire: "IE",
  eire: "IE",

  // === Portugal ===
  포르투갈: "PT",

  // === Czech Republic ===
  체코: "CZ",
  czechia: "CZ",
  "czech republic": "CZ",
  "česká republika": "CZ",
  "ceska republika": "CZ",

  // === Greece ===
  그리스: "GR",
  ελλάδα: "GR",
  hellas: "GR",

  // === Israel ===
  이스라엘: "IL",
  ישראל: "IL",

  // === Argentina ===
  아르헨티나: "AR",

  // === Chile ===
  칠레: "CL",

  // === Colombia ===
  콜롬비아: "CO",

  // === South Africa ===
  남아프리카: "ZA",
  남아공: "ZA",
  "south africa": "ZA",
  남아프리카공화국: "ZA",
  "남아프리카 공화국": "ZA",

  // === Egypt ===
  이집트: "EG",
  مصر: "EG",

  // === Nigeria ===
  나이지리아: "NG",

  // === Pakistan ===
  파키스탄: "PK",
  پاکستان: "PK",

  // === Bangladesh ===
  방글라데시: "BD",
  বাংলাদেশ: "BD",

  // === Ukraine ===
  우크라이나: "UA",
  україна: "UA",
  украина: "UA",

  // === Romania ===
  루마니아: "RO",
  românia: "RO",

  // === Hungary ===
  헝가리: "HU",
  magyarország: "HU",

  // === Bulgaria ===
  불가리아: "BG",
  българия: "BG",
  bulgariya: "BG",

  // === Slovakia ===
  슬로바키아: "SK",
  slovensko: "SK",

  // === Slovenia ===
  슬로베니아: "SI",
  slovenija: "SI",

  // === Croatia ===
  크로아티아: "HR",
  hrvatska: "HR",

  // === Serbia ===
  세르비아: "RS",
  србија: "RS",
  srbija: "RS",

  // === Lithuania ===
  리투아니아: "LT",
  lietuva: "LT",

  // === Latvia ===
  라트비아: "LV",
  latvija: "LV",

  // === Estonia ===
  에스토니아: "EE",
  eesti: "EE",

  // === Belarus ===
  벨라루스: "BY",
  беларусь: "BY",
  белоруссия: "BY",

  // === Moldova ===
  몰도바: "MD",

  // === Georgia ===
  조지아: "GE",
  საქართველო: "GE",
  грузия: "GE",

  // === Armenia ===
  아르메니아: "AM",
  հայաdelays: "AM",

  // === Azerbaijan ===
  아제르바이잔: "AZ",

  // === Kazakhstan ===
  카자흐스탄: "KZ",
  казахстан: "KZ",

  // === Uzbekistan ===
  우즈베키스탄: "UZ",

  // === Turkmenistan ===
  투르크메니스탄: "TM",

  // === Kyrgyzstan ===
  키르기스스탄: "KG",

  // === Tajikistan ===
  타지키스탄: "TJ",

  // === Peru ===
  페루: "PE",
  perú: "PE",

  // === Venezuela ===
  베네수엘라: "VE",

  // === Ecuador ===
  에콰도르: "EC",

  // === Bolivia ===
  볼리비아: "BO",

  // === Paraguay ===
  파라과이: "PY",

  // === Uruguay ===
  우루과이: "UY",

  // === Costa Rica ===
  코스타리카: "CR",

  // === Panama ===
  파나마: "PA",

  // === Cuba ===
  쿠바: "CU",

  // === Dominican Republic ===
  도미니카: "DO",
  도미니카공화국: "DO",

  // === Jamaica ===
  자메이카: "JM",

  // === Trinidad and Tobago ===
  트리니다드토바고: "TT",

  // === Morocco ===
  모로코: "MA",
  المغرب: "MA",

  // === Algeria ===
  알제리: "DZ",
  الجزائر: "DZ",

  // === Tunisia ===
  튀니지: "TN",
  تونس: "TN",

  // === Kenya ===
  케냐: "KE",

  // === Tanzania ===
  탄자니아: "TZ",

  // === Ethiopia ===
  에티오피아: "ET",

  // === Qatar ===
  카타르: "QA",
  قطر: "QA",

  // === Kuwait ===
  쿠웨이트: "KW",
  الكويت: "KW",

  // === Bahrain ===
  바레인: "BH",
  البحرين: "BH",

  // === Oman ===
  오만: "OM",
  عمان: "OM",

  // === Jordan ===
  요르단: "JO",
  الأردن: "JO",

  // === Lebanon ===
  레바논: "LB",
  لبنان: "LB",

  // === Iran ===
  이란: "IR",
  ایران: "IR",

  // === Iraq ===
  이라크: "IQ",
  العراق: "IQ",

  // === Afghanistan ===
  아프가니스탄: "AF",

  // === Sri Lanka ===
  스리랑카: "LK",

  // === Nepal ===
  네팔: "NP",

  // === Myanmar ===
  미얀마: "MM",
  버마: "MM",
  burma: "MM",

  // === Cambodia ===
  캄보디아: "KH",

  // === Laos ===
  라오스: "LA",

  // === Mongolia ===
  몽골: "MN",

  // === Papua New Guinea ===
  파푸아뉴기니: "PG",
  뉴기니: "PG",

  // === Fiji ===
  피지: "FJ",

  // === New Caledonia ===
  뉴칼레도니아: "NC",

  // === Guam ===
  괌: "GU",

  // === Puerto Rico ===
  푸에르토리코: "PR",

  // === Iceland ===
  아이슬란드: "IS",
  ísland: "IS",

  // === Luxembourg ===
  룩셈부르크: "LU",

  // === Malta ===
  몰타: "MT",

  // === Cyprus ===
  키프로스: "CY",
  사이프러스: "CY",
  κύπρος: "CY",

  // === Albania ===
  알바니아: "AL",
  shqipëria: "AL",

  // === North Macedonia ===
  북마케도니아: "MK",
  마케도니아: "MK",
  македонија: "MK",

  // === Bosnia and Herzegovina ===
  보스니아: "BA",
  "보스니아 헤르체고비나": "BA",

  // === Montenegro ===
  몬테네그로: "ME",

  // === Kosovo ===
  코소보: "XK",

  // === San Marino ===
  산마리노: "SM",

  // === Monaco ===
  모나코: "MC",

  // === Liechtenstein ===
  리히텐슈타인: "LI",

  // === Andorra ===
  안도라: "AD",

  // === Guatemala ===
  과테말라: "GT",

  // === Honduras ===
  온두라스: "HN",

  // === El Salvador ===
  엘살바도르: "SV",

  // === Nicaragua ===
  니카라과: "NI",

  // === Belize ===
  벨리즈: "BZ",

  // === Cayman Islands ===
  케이맨제도: "KY",
  "케이맨 제도": "KY",

  // === Bermuda ===
  버뮤다: "BM",

  // === Bahamas ===
  바하마: "BS",

  // === Barbados ===
  바베이도스: "BB",

  // === Brunei ===
  브루나이: "BN",

  // === Macao ===
  마카오: "MO",
  澳門: "MO",
  澳门: "MO",
}

/**
 * Extract the first/primary country from a multi-country string
 * e.g., "캐나다, 미국" → "캐나다"
 */
function extractPrimaryCountry(country: string): string {
  // Common separators for multi-country strings
  const separators = [",", "/", ";", "&", " and ", " 및 ", " 또는 "]

  for (const sep of separators) {
    if (country.includes(sep)) {
      const parts = country.split(sep)
      if (parts.length > 0 && parts[0]) {
        return parts[0].trim()
      }
    }
  }

  return country
}

/**
 * Normalize a country name to its standard English name
 * Uses ISO 3166-1 standard via i18n-iso-countries library
 *
 * @param country - Raw country name from database (can be ISO code, Korean, English, etc.)
 * @returns Normalized country name in English
 */
export function normalizeCountryName(country: string | null): string {
  if (!country) return "Unknown"

  const trimmed = country.trim()
  if (trimmed.length === 0) return "Unknown"

  // Extract primary country if it's a multi-country string
  const primaryCountry = extractPrimaryCountry(trimmed)
  const lowerCase = primaryCountry.toLowerCase()

  // 1. Check custom mappings first (for edge cases)
  const customMapping = CUSTOM_COUNTRY_MAPPINGS[lowerCase]
  if (customMapping) {
    const name = countries.getName(customMapping, "en")
    return name || primaryCountry
  }

  // 2. Try to get ISO alpha-2 code from the input
  // Check if it's already an ISO alpha-2 code (2 letters)
  if (primaryCountry.length === 2) {
    const alpha2Upper = primaryCountry.toUpperCase()
    const name = countries.getName(alpha2Upper, "en")
    if (name) return name
  }

  // 3. Check if it's an ISO alpha-3 code (3 letters)
  if (primaryCountry.length === 3) {
    const alpha3Upper = primaryCountry.toUpperCase()
    const alpha2 = countries.alpha3ToAlpha2(alpha3Upper)
    if (alpha2) {
      const name = countries.getName(alpha2, "en")
      if (name) return name
    }
  }

  // 4. Try to find the country by name in all registered locales
  for (const locale of REGISTERED_LOCALES) {
    const alpha2 = countries.getAlpha2Code(primaryCountry, locale)
    if (alpha2) {
      const name = countries.getName(alpha2, "en")
      if (name) return name
    }
  }

  // 5. If no match found, capitalize and return as-is
  return primaryCountry
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

/**
 * Get ISO alpha-2 code for a country name
 * @param country - Country name in any supported format
 * @returns ISO alpha-2 code or null if not found
 */
export function getCountryCode(country: string | null): string | null {
  if (!country) return null

  const trimmed = country.trim()
  if (trimmed.length === 0) return null

  const primaryCountry = extractPrimaryCountry(trimmed)
  const lowerCase = primaryCountry.toLowerCase()

  // Check custom mappings
  const customMapping = CUSTOM_COUNTRY_MAPPINGS[lowerCase]
  if (customMapping) return customMapping

  // Check if already alpha-2
  if (primaryCountry.length === 2) {
    const alpha2Upper = primaryCountry.toUpperCase()
    if (countries.getName(alpha2Upper, "en")) return alpha2Upper
  }

  // Check if alpha-3
  if (primaryCountry.length === 3) {
    const alpha2 = countries.alpha3ToAlpha2(primaryCountry.toUpperCase())
    if (alpha2) return alpha2
  }

  // Try all locales
  for (const locale of REGISTERED_LOCALES) {
    const alpha2 = countries.getAlpha2Code(primaryCountry, locale)
    if (alpha2) return alpha2
  }

  return null
}

export { countries }
