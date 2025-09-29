// Lead Detail Types (contacts, social media, etc.)

export type ContactType = "phone" | "email" | "fax" | "other"
export type SocialMediaPlatform = "facebook" | "instagram" | "twitter" | "linkedin"

export interface LeadContact {
  id: string
  leadId: string
  contactType: ContactType
  contactValue: string
  label?: string | null
  isPrimary: boolean
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface LeadSocialMedia {
  id: string
  leadId: string
  platform: SocialMediaPlatform
  url: string
  username?: string | null
  followerCount?: string | null
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface LeadProduct {
  id: string
  leadId: string
  productName: string
  description?: string | null
  createdAt: string
}

export interface LeadBusinessSector {
  id: string
  leadId: string
  sectorName: string
  createdAt: string
}

export interface LeadProductCategory {
  id: string
  leadId: string
  categoryName: string
  createdAt: string
}

export interface LeadIndustryType {
  id: string
  leadId: string
  industryName: string
  createdAt: string
}
