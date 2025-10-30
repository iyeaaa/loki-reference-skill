import type {
  LeadBusinessSector,
  LeadContact,
  LeadIndustryType,
  LeadProduct,
  LeadProductCategory,
  LeadSocialMedia,
} from "../db/schema/lead-details"
import type { leadStatusEnum } from "../db/schema/leads"

/**
 * Runtime result from lead search queries (with Date objects from Drizzle)
 * This is the actual shape returned by the service before serialization
 */
export type LeadSearchResultRuntime = {
  id: string
  workspaceId: string
  workspaceName: string
  companyName: string | null
  foundCompanyName: string | null
  contactName: string | null
  websiteUrl: string | null
  finalUrl: string | null
  httpStatus: number | null
  nameUrlMatch: boolean | null
  businessType: string | null
  isBusinessTypeMatched: boolean | null
  description: string | null
  address: string | null
  country: string | null
  city: string | null
  state: string | null
  foundedYear: number | null
  employeeCount: string | null
  leadSource: string | null
  leadStatus: (typeof leadStatusEnum.enumValues)[number] | null
  leadScore: number | null
  notes: string | null
  crawlTimeSeconds: string | null
  gptTimeSeconds: string | null
  collectedAt: Date | null // Date object from Drizzle
  errorMessage: string | null
  createdBy: string | null
  createdByUsername: string | null
  createdByEmail: string | null
  createdAt: Date // Date object from Drizzle
  updatedAt: Date // Date object from Drizzle
  lastContactedAt: Date | null // Date object from Drizzle
  // Related data
  contacts: LeadContact[]
  socialMedia: LeadSocialMedia[]
  products: LeadProduct[]
  businessSectors: LeadBusinessSector[]
  productCategories: LeadProductCategory[]
  industryTypes: LeadIndustryType[]
}

/**
 * Serialized result for API responses (with ISO date strings)
 * This is the shape after manual serialization in the route handler
 */
export type LeadSearchResult = {
  id: string
  workspaceId: string
  workspaceName: string
  companyName: string | null
  foundCompanyName: string | null
  contactName: string | null
  websiteUrl: string | null
  finalUrl: string | null
  httpStatus: number | null
  nameUrlMatch: boolean | null
  businessType: string | null
  isBusinessTypeMatched: boolean | null
  description: string | null
  address: string | null
  country: string | null
  city: string | null
  state: string | null
  foundedYear: number | null
  employeeCount: string | null
  leadSource: string | null
  leadStatus: (typeof leadStatusEnum.enumValues)[number] | null
  leadScore: number | null
  notes: string | null
  crawlTimeSeconds: string | null
  gptTimeSeconds: string | null
  collectedAt: string | null // ISO 8601 date-time string
  errorMessage: string | null
  createdBy: string | null
  createdByUsername: string | null
  createdByEmail: string | null
  createdAt: string // ISO 8601 date-time string
  updatedAt: string // ISO 8601 date-time string
  lastContactedAt: string | null // ISO 8601 date-time string
  // Related data
  contacts: LeadContact[]
  socialMedia: LeadSocialMedia[]
  products: LeadProduct[]
  businessSectors: LeadBusinessSector[]
  productCategories: LeadProductCategory[]
  industryTypes: LeadIndustryType[]
}

/**
 * Base lead data from the main query (before adding related data)
 */
export type LeadBaseQueryResult = Omit<
  LeadSearchResult,
  | "contacts"
  | "socialMedia"
  | "products"
  | "businessSectors"
  | "productCategories"
  | "industryTypes"
>
