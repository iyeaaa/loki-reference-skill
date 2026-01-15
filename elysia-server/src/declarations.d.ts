declare module "@ai-sdk/google" {
  import type { LanguageModel } from "ai"
  export function createGoogleGenerativeAI(options: {
    apiKey: string
  }): (modelId: string) => LanguageModel
}

declare module "@aws-sdk/client-s3" {
  export class S3Client {
    constructor(config: {
      region: string
      credentials: {
        accessKeyId: string
        secretAccessKey: string
      }
    })
    send(command: unknown): Promise<unknown>
  }

  export class PutObjectCommand {
    constructor(input: {
      Bucket: string
      Key: string
      Body: Buffer | Uint8Array | string
      ContentType?: string
      CacheControl?: string
    })
  }

  export class GetObjectCommand {
    constructor(input: {
      Bucket: string
      Key: string
    })
  }

  export class DeleteObjectCommand {
    constructor(input: {
      Bucket: string
      Key: string
    })
  }
}

declare module "i18n-iso-countries" {
  export function registerLocale(locale: {
    locale: string
    countries: Record<string, string>
  }): void
  export function getName(code: string, lang: string): string | undefined
  export function getAlpha2Code(name: string, lang: string): string | undefined
  export function alpha3ToAlpha2(alpha3: string): string | undefined
  export function isValid(code: string): boolean
  export function getNames(lang: string): Record<string, string>
}

declare module "i18n-iso-countries/langs/bg.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/cs.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/de.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/en.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/es.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/fr.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/it.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/ja.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/ko.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/nl.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/pl.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/pt.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/ro.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/ru.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/tr.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/uk.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/vi.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}

declare module "i18n-iso-countries/langs/zh.json" {
  const locale: { locale: string; countries: Record<string, string> }
  export default locale
}
