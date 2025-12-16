// Lead Detail Types (contacts, social media, etc.)

export type ContactType = "phone" | "email" | "fax" | "other"
export type SocialMediaPlatform = "facebook" | "instagram" | "twitter" | "linkedin"

export type LeadContact = {
  id: string
  leadId: string
  contactType: ContactType
  contactValue: string
  contactName?: string | null
  label?: string | null
  isPrimary: boolean
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

export type LeadSocialMedia = {
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

export type LeadProduct = {
  id: string
  leadId: string
  productName: string
  description?: string | null
  createdAt: string
}

export type LeadBusinessSector = {
  id: string
  leadId: string
  sectorName: string
  createdAt: string
}

export type LeadProductCategory = {
  id: string
  leadId: string
  categoryName: string
  createdAt: string
}

export type LeadIndustryType = {
  id: string
  leadId: string
  industryName: string
  createdAt: string
}
