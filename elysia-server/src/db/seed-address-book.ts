import { db } from './drizzle'
import { addressBookContacts, addressBookGroups } from './schema'

const userIds = [
  'f1243741-8a53-4375-9c1b-efdda29cf8f6',
  'e6eeebcd-12be-4a9e-8e97-6fec0925ec71',
  'b55b829b-77c3-4476-a0fa-845f1e3d3f59',
  '589e9610-5c44-4e29-b475-674cb9f81a7c',
  '403fbb3d-d041-4868-9f68-b0a79147b879',
  '39e8efee-2200-490c-b52f-e8c9e71d4379',
]

const fashionAgencies = [
  {
    company: 'inBeat Agency',
    email: 'contact@inbeat.agency',
    industryType: '패션의류',
    productCategory: '에이전시',
    description:
      '패션 브랜드를 전문으로 하는 인플루언서 마케팅 에이전시로, 미국에 본사를 두고 있으며 New Balance, Uniqlo 등 패션 브랜드와 협력하여 소셜 미디어 마케팅 서비스를 제공하는 에이전시입니다.',
    websiteUrl: 'https://inbeat.agency/',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/inbeat-agency',
    facebookUrl: 'https://facebook.com/inbeatagency',
    instagramUrl: 'https://instagram.com/inbeatagency',
  },
  {
    company: 'Web Tonic',
    email: 'hello@webtonic.io',
    industryType: '패션의류',
    productCategory: '에이전시',
    description:
      '패션 마케팅 전문 에이전시로 미국에서 활동하며, 패션 브랜드의 디지털 마케팅, SEO, PPC 광고, 소셜 미디어 관리 등을 통해 브랜드 성장을 지원하는 에이전시 서비스를 제공합니다.',
    websiteUrl: 'https://www.webtonic.io/en',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/webtonic',
    facebookUrl: 'https://facebook.com/webtonic',
    instagramUrl: 'https://instagram.com/webtonic',
  },
  {
    company: 'Fabric PR',
    email: 'holly@fabricpr.com',
    industryType: '패션의류',
    productCategory: '에이전시',
    description:
      '런던에 본사를 두고 있지만 미국 시장에서도 활동하는 패션 PR 및 마케팅 에이전시로, 패션 브랜드를 위한 전략적 마케팅 및 커뮤니케이션 서비스를 제공하는 전문 에이전시입니다.',
    websiteUrl: 'https://fabricpr.com/',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/fabric-pr',
    facebookUrl: 'https://facebook.com/fabricpr',
    instagramUrl: 'https://instagram.com/fabricpr',
  },
  {
    company: 'AM:PR New York',
    email: 'alison@amprnewyork.com',
    industryType: '패션의류',
    productCategory: '에이전시',
    description:
      '뉴욕에 본사를 둔 패션 전문 PR 에이전시로, 패션 디자이너와 브랜드를 위한 브랜딩, 셀러브리티 PR, 에디토리얼 및 이벤트 중심의 퍼블릭 릴레이션즈 서비스를 제공하는 에이전시입니다.',
    websiteUrl: 'http://www.amprnewyork.com/',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/ampr-new-york',
    facebookUrl: 'https://facebook.com/amprnewyork',
    instagramUrl: 'https://instagram.com/amprnewyork',
  },
  {
    company: 'BPM-PR Firm',
    email: 'mtatum@bpm-prfirm.com',
    industryType: '패션의류',
    productCategory: '에이전시',
    description:
      '뉴욕에 본사를 둔 Forbes 선정 미국 최고의 PR 회사 중 하나로, 패션 브랜드를 포함한 다양한 클라이언트에게 전문적인 PR 및 마케팅 에이전시 서비스를 제공합니다.',
    websiteUrl: 'https://www.bpm-prfirm.com/',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/bpm-pr-firm',
    facebookUrl: 'https://facebook.com/bpmprfirm',
    instagramUrl: 'https://instagram.com/bpmprfirm',
  },
]

const techCompanies = [
  {
    company: 'Google',
    email: 'business@google.com',
    industryType: '기술',
    productCategory: '검색/클라우드',
    description:
      '세계 최대의 검색 엔진 및 클라우드 서비스 제공업체로, AI, 머신러닝, 광고 기술 등 다양한 혁신적인 기술 솔루션을 제공하는 글로벌 기술 기업입니다.',
    websiteUrl: 'https://www.google.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/google',
    facebookUrl: 'https://facebook.com/Google',
    instagramUrl: 'https://instagram.com/google',
  },
  {
    company: 'Microsoft',
    email: 'info@microsoft.com',
    industryType: '기술',
    productCategory: '소프트웨어/클라우드',
    description:
      '전 세계적으로 사용되는 Windows 운영체제와 Office 제품군, Azure 클라우드 서비스를 제공하는 글로벌 소프트웨어 및 클라우드 기술 기업입니다.',
    websiteUrl: 'https://www.microsoft.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/microsoft',
    facebookUrl: 'https://facebook.com/Microsoft',
    instagramUrl: 'https://instagram.com/microsoft',
  },
  {
    company: 'Apple',
    email: 'contact@apple.com',
    industryType: '기술',
    productCategory: '하드웨어/소프트웨어',
    description:
      'iPhone, iPad, Mac 등 혁신적인 하드웨어 제품과 iOS, macOS 등의 운영체제를 개발하는 세계적인 기술 기업입니다.',
    websiteUrl: 'https://www.apple.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/apple',
    facebookUrl: 'https://facebook.com/Apple',
    instagramUrl: 'https://instagram.com/apple',
  },
  {
    company: 'Meta',
    email: 'business@meta.com',
    industryType: '기술',
    productCategory: '소셜미디어/VR',
    description:
      'Facebook, Instagram, WhatsApp을 운영하며 메타버스 기술 개발에 주력하는 소셜 미디어 및 가상현실 기술 기업입니다.',
    websiteUrl: 'https://about.meta.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/meta',
    facebookUrl: 'https://facebook.com/Meta',
    instagramUrl: 'https://instagram.com/meta',
  },
  {
    company: 'Amazon',
    email: 'aws-sales@amazon.com',
    industryType: '기술',
    productCategory: '이커머스/클라우드',
    description:
      '세계 최대의 이커머스 플랫폼이자 AWS 클라우드 서비스를 제공하는 글로벌 기술 및 물류 기업입니다.',
    websiteUrl: 'https://www.amazon.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/amazon',
    facebookUrl: 'https://facebook.com/Amazon',
    instagramUrl: 'https://instagram.com/amazon',
  },
]

const consultingFirms = [
  {
    company: 'McKinsey & Company',
    email: 'info@mckinsey.com',
    industryType: '컨설팅',
    productCategory: '전략컨설팅',
    description:
      '세계 최고의 경영 컨설팅 회사 중 하나로, 전략, 운영, 조직, 기술 등 다양한 분야에서 글로벌 기업들에게 컨설팅 서비스를 제공합니다.',
    websiteUrl: 'https://www.mckinsey.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/mckinsey',
    facebookUrl: 'https://facebook.com/McKinseyCompany',
    instagramUrl: 'https://instagram.com/mckinsey_co',
  },
  {
    company: 'Boston Consulting Group',
    email: 'contact@bcg.com',
    industryType: '컨설팅',
    productCategory: '전략컨설팅',
    description:
      '혁신적인 비즈니스 전략과 디지털 트랜스포메이션 솔루션을 제공하는 글로벌 경영 컨설팅 회사입니다.',
    websiteUrl: 'https://www.bcg.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/boston-consulting-group',
    facebookUrl: 'https://facebook.com/BostonConsultingGroup',
    instagramUrl: 'https://instagram.com/bostonConsultinggroup',
  },
  {
    company: 'Bain & Company',
    email: 'info@bain.com',
    industryType: '컨설팅',
    productCategory: '전략컨설팅',
    description:
      '결과 중심의 컨설팅 접근법으로 유명한 글로벌 경영 컨설팅 회사로, 전략, 운영, 조직 개발 등의 서비스를 제공합니다.',
    websiteUrl: 'https://www.bain.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/bain-and-company',
    facebookUrl: 'https://facebook.com/BainandCompany',
    instagramUrl: 'https://instagram.com/bainandcompany',
  },
  {
    company: 'Deloitte',
    email: 'info@deloitte.com',
    industryType: '컨설팅',
    productCategory: '종합컨설팅',
    description:
      '감사, 컨설팅, 세무, 리스크 관리 등 다양한 전문 서비스를 제공하는 글로벌 전문 서비스 기업입니다.',
    websiteUrl: 'https://www.deloitte.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/deloitte',
    facebookUrl: 'https://facebook.com/deloitte',
    instagramUrl: 'https://instagram.com/deloitte',
  },
  {
    company: 'PwC',
    email: 'info@pwc.com',
    industryType: '컨설팅',
    productCategory: '종합컨설팅',
    description:
      '감사, 세무, 컨설팅 서비스를 제공하는 글로벌 전문 서비스 네트워크로, 다양한 산업 분야의 기업들에게 전문적인 솔루션을 제공합니다.',
    websiteUrl: 'https://www.pwc.com',
    country: '미국',
    linkedinUrl: 'https://linkedin.com/company/pwc',
    facebookUrl: 'https://facebook.com/PwC',
    instagramUrl: 'https://instagram.com/pwc',
  },
]

async function seedAddressBook() {
  console.log('🌱 Starting address book seeding...')

  try {
    for (const userId of userIds) {
      console.log(`📝 Creating groups for user: ${userId}`)

      // Create groups for each user
      const [fashionGroup] = await db
        .insert(addressBookGroups)
        .values({
          userId,
          name: '패션 에이전시',
          description: '패션 및 마케팅 관련 에이전시들',
        })
        .returning()

      const [techGroup] = await db
        .insert(addressBookGroups)
        .values({
          userId,
          name: '기술 회사',
          description: 'IT 및 기술 관련 기업들',
        })
        .returning()

      const [consultingGroup] = await db
        .insert(addressBookGroups)
        .values({
          userId,
          name: '컨설팅 회사',
          description: '전략 컨설팅 및 비즈니스 서비스 기업들',
        })
        .returning()

      console.log(`👥 Adding contacts for user: ${userId}`)

      // Add fashion agency contacts
      for (const company of fashionAgencies) {
        await db.insert(addressBookContacts).values({
          userId,
          groupId: fashionGroup.id,
          ...company,
        })
      }

      // Add tech company contacts
      for (const company of techCompanies) {
        await db.insert(addressBookContacts).values({
          userId,
          groupId: techGroup.id,
          ...company,
        })
      }

      // Add consulting firm contacts
      for (const company of consultingFirms) {
        await db.insert(addressBookContacts).values({
          userId,
          groupId: consultingGroup.id,
          ...company,
        })
      }

      console.log(`✅ Completed seeding for user: ${userId}`)
    }

    console.log('🎉 Address book seeding completed successfully!')
    console.log(`📊 Summary:`)
    console.log(`   - ${userIds.length} users`)
    console.log(`   - ${userIds.length * 3} groups created`)
    console.log(`   - ${userIds.length * 15} contacts created`)
  } catch (error) {
    console.error('❌ Error seeding address book:', error)
    throw error
  }
}

// Run the seeding function
if (require.main === module) {
  seedAddressBook()
    .then(() => {
      console.log('🏁 Seeding completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error)
      process.exit(1)
    })
}

export { seedAddressBook }
