// Lead Management API Types (aligned with backend database schema)

import type {
  LeadBusinessSector,
  LeadContact,
  LeadIndustryType,
  LeadProduct,
  LeadProductCategory,
  LeadSocialMedia,
} from "./lead-detail"

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "unqualified"
  | "converted"
  | "lost"
  | "unsubscribed"

export interface Lead {
  id: string
  workspaceId: string
  workspaceName?: string | null
  // Company information
  companyName?: string | null
  foundCompanyName?: string | null
  websiteUrl?: string | null
  finalUrl?: string | null
  httpStatus?: number | null
  nameUrlMatch?: boolean | null
  businessType?: string | null
  isBusinessTypeMatched?: boolean | null
  description?: string | null
  // Location
  address?: string | null
  country?: string | null
  city?: string | null
  state?: string | null
  foundedYear?: number | null
  // Business details
  employeeCount?: string | null
  // Lead management
  leadSource?: string | null
  leadStatus: LeadStatus
  leadScore?: number | null
  notes?: string | null
  // Processing metadata
  crawlTimeSeconds?: string | null
  gptTimeSeconds?: string | null
  collectedAt?: string | null
  errorMessage?: string | null
  // Audit fields
  createdBy?: string | null
  createdByUsername?: string | null
  createdByEmail?: string | null
  createdAt: string
  updatedAt: string
  lastContactedAt?: string | null
  // Related data
  contacts?: LeadContact[]
  socialMedia?: LeadSocialMedia[]
  products?: LeadProduct[]
  businessSectors?: LeadBusinessSector[]
  productCategories?: LeadProductCategory[]
  industryTypes?: LeadIndustryType[]
}

export interface CreateLeadRequest {
  workspaceId: string
  companyName?: string | null
  foundCompanyName?: string | null
  websiteUrl?: string | null
  finalUrl?: string | null
  httpStatus?: number | null
  nameUrlMatch?: boolean | null
  businessType?: string | null
  isBusinessTypeMatched?: boolean | null
  description?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  state?: string | null
  foundedYear?: number | null
  employeeCount?: string | null
  leadSource?: string | null
  leadStatus?: LeadStatus
  leadScore?: number | null
  notes?: string | null
  crawlTimeSeconds?: string | null
  gptTimeSeconds?: string | null
  collectedAt?: string | null
  errorMessage?: string | null
  createdBy?: string | null
  contacts?: Partial<LeadContact>[]
  socialMedia?: Partial<LeadSocialMedia>[]
}

export interface UpdateLeadRequest {
  companyName?: string | null
  foundCompanyName?: string | null
  websiteUrl?: string | null
  finalUrl?: string | null
  httpStatus?: number | null
  nameUrlMatch?: boolean | null
  businessType?: string | null
  isBusinessTypeMatched?: boolean | null
  description?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  state?: string | null
  foundedYear?: number | null
  employeeCount?: string | null
  leadSource?: string | null
  leadStatus?: LeadStatus
  leadScore?: number | null
  notes?: string | null
  contacts?: Partial<LeadContact>[]
  socialMedia?: Partial<LeadSocialMedia>[]
}

export interface LeadsResponse {
  data: Lead[]
  total: number
  limit: number
  offset: number
}

export interface LeadsParams {
  page?: number
  limit?: number
  leadStatus?: LeadStatus | "all"
  businessType?: string
  country?: string
  city?: string
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
  customerGroupId?: string
  sortField?: string
  sortOrder?: "asc" | "desc"
}

export interface BulkUpdateLeadStatusRequest {
  leadIds: string[]
  leadStatus: LeadStatus
}

export interface BulkUpdateBusinessTypeRequest {
  leadIds: string[]
  businessType: string
}
