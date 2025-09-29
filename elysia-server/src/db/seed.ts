import { eq } from 'drizzle-orm'
import { db } from './index'
import {
  customerGroupMembers,
  customerGroups,
  departments,
  emailTemplates,
  leadBusinessSectors,
  leadContacts,
  leadIndustryTypes,
  leadProductCategories,
  leadProducts,
  leadSocialMedia,
  leads,
  sequenceSteps,
  sequences,
  userEmailAccounts,
  users,
  workspaceMembers,
  workspaces,
} from './schema'

async function seed() {
  console.log('🌱 시드 데이터 생성 시작...\n')

  try {
    // 1. 부서 데이터 생성
    console.log('📁 부서 데이터 생성 중...')
    const departmentSeeds = [
      {
        name: '커뮤니케이션팀',
        code: 'COMM',
        description: '그린다에이아이 커뮤니케이션팀',
        isActive: true,
      },
      {
        name: '프로덕트팀',
        code: 'PROD',
        description: '그린다에이아이 프로덕트팀',
        isActive: true,
      },
      { name: 'SDR팀', code: 'SDR', description: '그린다에이아이 SDR팀', isActive: true },
      {
        name: '경영지원팀',
        code: 'MGMT',
        description: '그린다에이아이 경영지원팀',
        isActive: true,
      },
      { name: '개발팀', code: 'DEV', description: '그린다에이아이 개발팀', isActive: true },
    ]

    const insertedDepartments: (typeof departments.$inferSelect)[] = []
    for (const dept of departmentSeeds) {
      const existing = await db
        .select()
        .from(departments)
        .where(eq(departments.name, dept.name))
        .limit(1)
      if (existing.length === 0) {
        const [inserted] = await db.insert(departments).values(dept).returning()
        insertedDepartments.push(inserted!)
      } else {
        console.log(`  ⏭️  부서 '${dept.name}' 이미 존재, 건너뜀`)
        insertedDepartments.push(existing[0]!)
      }
    }
    console.log(`✅ ${insertedDepartments.length}개 부서 처리 완료\n`)

    // 2. 사용자 데이터 생성
    console.log('👤 사용자 데이터 생성 중...')
    const userSeeds = [
      {
        username: '김철수',
        email: 'chulsoo.kim@greenda.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        userRole: 'admin' as const,
        departmentId: insertedDepartments[0]!.id,
        employeeId: 'EMP001',
        isActive: true,
      },
      {
        username: '이영희',
        email: 'younghee.lee@greenda.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        userRole: 'user' as const,
        departmentId: insertedDepartments[1]!.id,
        employeeId: 'EMP002',
        isActive: true,
      },
      {
        username: '박민수',
        email: 'minsoo.park@greenda.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        userRole: 'user' as const,
        departmentId: insertedDepartments[2]!.id,
        employeeId: 'EMP003',
        isActive: true,
      },
      {
        username: '정수진',
        email: 'sujin.jung@greenda.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        userRole: 'user' as const,
        departmentId: insertedDepartments[3]!.id,
        employeeId: 'EMP004',
        isActive: true,
      },
      {
        username: '최동훈',
        email: 'donghoon.choi@greenda.ai',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        userRole: 'user' as const,
        departmentId: insertedDepartments[4]!.id,
        employeeId: 'EMP005',
        isActive: true,
      },
    ]

    const insertedUsers: (typeof users.$inferSelect)[] = []
    for (const user of userSeeds) {
      const existing = await db.select().from(users).where(eq(users.email, user.email)).limit(1)
      if (existing.length === 0) {
        const [inserted] = await db.insert(users).values(user).returning()
        insertedUsers.push(inserted!)
      } else {
        console.log(`  ⏭️  사용자 '${user.email}' 이미 존재, 건너뜀`)
        insertedUsers.push(existing[0]!)
      }
    }
    console.log(`✅ ${insertedUsers.length}명 사용자 처리 완료\n`)

    // 3. 워크스페이스 데이터 생성
    console.log('🏢 워크스페이스 데이터 생성 중...')
    const workspaceSeeds = [
      {
        name: '퓨어글로우 코스메틱',
        description: '천연 화장품 전문 브랜드의 해외 바이어 개척 워크스페이스',
        ownerId: insertedUsers[0]!.id,
        isActive: true,
      },
      {
        name: '블룸에센스',
        description: 'K-뷰티 스킨케어 브랜드의 글로벌 B2B 영업 워크스페이스',
        ownerId: insertedUsers[1]!.id,
        isActive: true,
      },
      {
        name: '루나뷰티랩',
        description: '기능성 화장품 ODM/OEM 전문기업 해외 파트너 발굴',
        ownerId: insertedUsers[2]!.id,
        isActive: true,
      },
      {
        name: '아쿠아실크',
        description: '수분크림 전문 브랜드의 동남아/중동 바이어 컨택',
        ownerId: insertedUsers[0]!.id,
        isActive: true,
      },
      {
        name: '센티드가든',
        description: '향수 및 바디케어 브랜드의 유럽/미주 시장 진출',
        ownerId: insertedUsers[3]!.id,
        isActive: true,
      },
    ]

    const insertedWorkspaces: (typeof workspaces.$inferSelect)[] = []
    for (const workspace of workspaceSeeds) {
      const existing = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.name, workspace.name))
        .limit(1)
      if (existing.length === 0) {
        const [inserted] = await db.insert(workspaces).values(workspace).returning()
        insertedWorkspaces.push(inserted!)
      } else {
        console.log(`  ⏭️  워크스페이스 '${workspace.name}' 이미 존재, 건너뜀`)
        insertedWorkspaces.push(existing[0]!)
      }
    }
    console.log(`✅ ${insertedWorkspaces.length}개 워크스페이스 처리 완료\n`)

    // 4. 워크스페이스 멤버 데이터 생성
    console.log('👥 워크스페이스 멤버 데이터 생성 중...')
    const memberSeeds = [
      {
        workspaceId: insertedWorkspaces[0]!.id,
        userId: insertedUsers[0]!.id,
        role: 'owner' as const,
        invitedBy: insertedUsers[0]!.id,
        joinedAt: new Date(),
        status: 'active' as const,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        userId: insertedUsers[1]!.id,
        role: 'admin' as const,
        invitedBy: insertedUsers[0]!.id,
        joinedAt: new Date(),
        status: 'active' as const,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        userId: insertedUsers[2]!.id,
        role: 'member' as const,
        invitedBy: insertedUsers[0]!.id,
        joinedAt: new Date(),
        status: 'active' as const,
      },
      {
        workspaceId: insertedWorkspaces[1]!.id,
        userId: insertedUsers[1]!.id,
        role: 'owner' as const,
        invitedBy: insertedUsers[1]!.id,
        joinedAt: new Date(),
        status: 'active' as const,
      },
      {
        workspaceId: insertedWorkspaces[2]!.id,
        userId: insertedUsers[2]!.id,
        role: 'owner' as const,
        invitedBy: insertedUsers[2]!.id,
        joinedAt: new Date(),
        status: 'active' as const,
      },
    ]
    const insertedMembers = await db.insert(workspaceMembers).values(memberSeeds).returning()
    console.log(`✅ ${insertedMembers.length}명 워크스페이스 멤버 생성 완료\n`)

    // 5. 이메일 계정 데이터 생성
    console.log('📧 이메일 계정 데이터 생성 중...')
    const emailAccountSeeds = [
      {
        userId: insertedUsers[0]!.id,
        workspaceId: insertedWorkspaces[0]!.id,
        emailAddress: 'sales@greenda.ai',
        displayName: '그린다AI 영업팀',
        apiKey: 'SG.test_api_key_1234567890',
        sendgridVerifiedSenderId: 'sender_id_001',
        isVerified: true,
        isDefault: true,
        dailyLimit: 500,
        monthlyLimit: 10000,
        status: 'active' as const,
      },
      {
        userId: insertedUsers[1]!.id,
        workspaceId: insertedWorkspaces[0]!.id,
        emailAddress: 'marketing@greenda.ai',
        displayName: '그린다AI 마케팅팀',
        apiKey: 'SG.test_api_key_2234567890',
        sendgridVerifiedSenderId: 'sender_id_002',
        isVerified: true,
        isDefault: false,
        dailyLimit: 1000,
        monthlyLimit: 20000,
        status: 'active' as const,
      },
      {
        userId: insertedUsers[2]!.id,
        workspaceId: insertedWorkspaces[2]!.id,
        emailAddress: 'global@greenda.ai',
        displayName: '그린다AI 글로벌팀',
        apiKey: 'SG.test_api_key_3234567890',
        sendgridVerifiedSenderId: 'sender_id_003',
        isVerified: true,
        isDefault: true,
        dailyLimit: 300,
        monthlyLimit: 8000,
        status: 'active' as const,
      },
      {
        userId: insertedUsers[3]!.id,
        workspaceId: insertedWorkspaces[4]!.id,
        emailAddress: 'success@greenda.ai',
        displayName: '그린다AI 고객성공팀',
        apiKey: 'SG.test_api_key_4234567890',
        isVerified: false,
        isDefault: true,
        dailyLimit: 200,
        monthlyLimit: 5000,
        status: 'inactive' as const,
      },
      {
        userId: insertedUsers[0]!.id,
        workspaceId: insertedWorkspaces[3]!.id,
        emailAddress: 'events@greenda.ai',
        displayName: '그린다AI 이벤트팀',
        apiKey: 'SG.test_api_key_5234567890',
        sendgridVerifiedSenderId: 'sender_id_005',
        isVerified: true,
        isDefault: true,
        dailyLimit: 800,
        monthlyLimit: 15000,
        status: 'active' as const,
      },
    ]
    const insertedEmailAccounts = await db
      .insert(userEmailAccounts)
      .values(emailAccountSeeds)
      .returning()
    console.log(`✅ ${insertedEmailAccounts.length}개 이메일 계정 생성 완료\n`)

    // 6. 리드 데이터 생성 (해외 바이어)
    console.log('🎯 리드 데이터 생성 중...')
    const leadSeeds = [
      {
        workspaceId: insertedWorkspaces[0]!.id,
        companyName: 'Sephora Asia Pacific',
        foundCompanyName: 'Sephora Asia Pacific Ltd.',
        websiteUrl: 'https://sephora.sg',
        finalUrl: 'https://sephora.sg',
        httpStatus: 200,
        nameUrlMatch: true,
        businessType: '뷰티 리테일',
        isBusinessTypeMatched: true,
        description: '동남아시아 최대 뷰티 리테일 체인',
        address: '8 Marina View, Marina Bay Financial Centre',
        country: '싱가포르',
        city: 'Singapore',
        state: 'Singapore',
        foundedYear: 2010,
        employeeCount: '1000-5000',
        leadSource: 'website_crawl',
        leadStatus: 'new' as const,
        leadScore: 95,
        createdBy: insertedUsers[0]!.id,
        collectedAt: new Date(),
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        companyName: 'Beauty Bay',
        foundCompanyName: 'Beauty Bay Ltd.',
        websiteUrl: 'https://beautybay.com',
        finalUrl: 'https://beautybay.com',
        httpStatus: 200,
        nameUrlMatch: true,
        businessType: '온라인 뷰티 리테일',
        isBusinessTypeMatched: true,
        description: '영국 기반 글로벌 온라인 뷰티 플랫폼',
        address: 'Manchester Science Park, Manchester',
        country: '영국',
        city: 'Manchester',
        state: 'England',
        foundedYear: 1999,
        employeeCount: '200-500',
        leadSource: 'referral',
        leadStatus: 'contacted' as const,
        leadScore: 85,
        createdBy: insertedUsers[1]!.id,
        collectedAt: new Date(),
      },
      {
        workspaceId: insertedWorkspaces[1]!.id,
        companyName: 'Watsons Thailand',
        foundCompanyName: 'Watsons Personal Care Stores (Thailand) Ltd.',
        websiteUrl: 'https://watsons.co.th',
        finalUrl: 'https://watsons.co.th',
        httpStatus: 200,
        nameUrlMatch: true,
        businessType: '드럭스토어 체인',
        isBusinessTypeMatched: true,
        description: '태국 최대 헬스&뷰티 리테일 체인',
        address: 'Central World, Bangkok',
        country: '태국',
        city: 'Bangkok',
        state: 'Bangkok',
        foundedYear: 1996,
        employeeCount: '5000-10000',
        leadSource: 'linkedin',
        leadStatus: 'qualified' as const,
        leadScore: 90,
        createdBy: insertedUsers[2]!.id,
        collectedAt: new Date(),
      },
      {
        workspaceId: insertedWorkspaces[2]!.id,
        companyName: 'Douglas GmbH',
        foundCompanyName: 'Douglas Holding AG',
        websiteUrl: 'https://douglas.de',
        finalUrl: 'https://douglas.de',
        httpStatus: 200,
        nameUrlMatch: true,
        businessType: '퍼퓸&코스메틱 리테일',
        isBusinessTypeMatched: true,
        description: '유럽 최대 향수 및 화장품 유통업체',
        address: 'Kabeler Straße 4, Düsseldorf',
        country: '독일',
        city: 'Düsseldorf',
        state: 'North Rhine-Westphalia',
        foundedYear: 1910,
        employeeCount: '10000+',
        leadSource: 'event',
        leadStatus: 'new' as const,
        leadScore: 88,
        createdBy: insertedUsers[1]!.id,
        collectedAt: new Date(),
      },
      {
        workspaceId: insertedWorkspaces[3]!.id,
        companyName: 'Noon UAE',
        foundCompanyName: 'Noon E-Commerce',
        websiteUrl: 'https://noon.com',
        finalUrl: 'https://noon.com',
        httpStatus: 200,
        nameUrlMatch: true,
        businessType: '이커머스 플랫폼',
        isBusinessTypeMatched: true,
        description: '중동 지역 대표 이커머스 플랫폼',
        address: 'Emaar Square, Downtown Dubai',
        country: '아랍에미리트',
        city: 'Dubai',
        state: 'Dubai',
        foundedYear: 2016,
        employeeCount: '1000-5000',
        leadSource: 'partner',
        leadStatus: 'contacted' as const,
        leadScore: 82,
        createdBy: insertedUsers[2]!.id,
        collectedAt: new Date(),
      },
    ]
    const insertedLeads = await db.insert(leads).values(leadSeeds).returning()
    console.log(`✅ ${insertedLeads.length}개 리드 생성 완료\n`)

    // 7. 리드 연락처 데이터 생성
    console.log('📞 리드 연락처 데이터 생성 중...')
    const contactSeeds = [
      {
        leadId: insertedLeads[0]!.id,
        contactType: 'email' as const,
        contactValue: 'contact@techstartup.co.kr',
        label: 'main',
        isPrimary: true,
        isVerified: true,
      },
      {
        leadId: insertedLeads[0]!.id,
        contactType: 'phone' as const,
        contactValue: '02-1234-5678',
        label: 'office',
        isPrimary: false,
        isVerified: true,
      },
      {
        leadId: insertedLeads[1]!.id,
        contactType: 'email' as const,
        contactValue: 'info@globalcommerce.com',
        label: 'main',
        isPrimary: true,
        isVerified: true,
      },
      {
        leadId: insertedLeads[1]!.id,
        contactType: 'phone' as const,
        contactValue: '02-2345-6789',
        label: 'sales',
        isPrimary: false,
        isVerified: false,
      },
      {
        leadId: insertedLeads[2]!.id,
        contactType: 'email' as const,
        contactValue: 'hello@smartfactory.co.kr',
        label: 'main',
        isPrimary: true,
        isVerified: true,
      },
      {
        leadId: insertedLeads[3]!.id,
        contactType: 'email' as const,
        contactValue: 'contact@healthinno.com',
        label: 'main',
        isPrimary: true,
        isVerified: false,
      },
      {
        leadId: insertedLeads[4]!.id,
        contactType: 'email' as const,
        contactValue: 'business@fintechsolutions.io',
        label: 'main',
        isPrimary: true,
        isVerified: true,
      },
    ]
    const insertedContacts = await db.insert(leadContacts).values(contactSeeds).returning()
    console.log(`✅ ${insertedContacts.length}개 리드 연락처 생성 완료\n`)

    // 8. 리드 소셜미디어 데이터 생성
    console.log('📱 리드 소셜미디어 데이터 생성 중...')
    const socialMediaSeeds = [
      {
        leadId: insertedLeads[0]!.id,
        platform: 'linkedin' as const,
        url: 'https://linkedin.com/company/techstartup',
        username: 'techstartup',
        isVerified: true,
      },
      {
        leadId: insertedLeads[0]!.id,
        platform: 'twitter' as const,
        url: 'https://twitter.com/techstartup',
        username: '@techstartup',
        isVerified: false,
      },
      {
        leadId: insertedLeads[1]!.id,
        platform: 'facebook' as const,
        url: 'https://facebook.com/globalcommerce',
        username: 'globalcommerce',
        followerCount: '10K',
        isVerified: true,
      },
      {
        leadId: insertedLeads[1]!.id,
        platform: 'instagram' as const,
        url: 'https://instagram.com/globalcommerce',
        username: '@globalcommerce',
        followerCount: '15K',
        isVerified: true,
      },
      {
        leadId: insertedLeads[2]!.id,
        platform: 'linkedin' as const,
        url: 'https://linkedin.com/company/smartfactory',
        username: 'smartfactory',
        isVerified: true,
      },
      {
        leadId: insertedLeads[3]!.id,
        platform: 'instagram' as const,
        url: 'https://instagram.com/healthinno',
        username: '@healthinno',
        followerCount: '5K',
        isVerified: false,
      },
      {
        leadId: insertedLeads[4]!.id,
        platform: 'linkedin' as const,
        url: 'https://linkedin.com/company/fintechsolutions',
        username: 'fintechsolutions',
        isVerified: true,
      },
    ]
    const insertedSocialMedia = await db
      .insert(leadSocialMedia)
      .values(socialMediaSeeds)
      .returning()
    console.log(`✅ ${insertedSocialMedia.length}개 소셜미디어 생성 완료\n`)

    // 9. 리드 제품 데이터 생성
    console.log('📦 리드 제품 데이터 생성 중...')
    const productSeeds = [
      {
        leadId: insertedLeads[0]!.id,
        productName: 'CRM 솔루션',
        description: '영업 및 고객 관리 통합 솔루션',
      },
      {
        leadId: insertedLeads[0]!.id,
        productName: '마케팅 자동화 도구',
        description: '이메일 및 소셜미디어 마케팅 자동화',
      },
      {
        leadId: insertedLeads[1]!.id,
        productName: '온라인 쇼핑몰 플랫폼',
        description: 'B2C 이커머스 플랫폼',
      },
      {
        leadId: insertedLeads[2]!.id,
        productName: 'AI 품질검사 시스템',
        description: '딥러닝 기반 제품 품질 검사',
      },
      {
        leadId: insertedLeads[3]!.id,
        productName: '원격 진료 플랫폼',
        description: '화상 진료 및 처방전 발급',
      },
      {
        leadId: insertedLeads[4]!.id,
        productName: '디지털 자산 거래소',
        description: '암호화폐 거래 플랫폼',
      },
    ]
    const insertedProducts = await db.insert(leadProducts).values(productSeeds).returning()
    console.log(`✅ ${insertedProducts.length}개 제품 생성 완료\n`)

    // 10. 리드 비즈니스 섹터 데이터 생성
    console.log('🏭 리드 비즈니스 섹터 데이터 생성 중...')
    const sectorSeeds = [
      { leadId: insertedLeads[0]!.id, sectorName: 'Enterprise Software' },
      { leadId: insertedLeads[1]!.id, sectorName: 'E-commerce' },
      { leadId: insertedLeads[1]!.id, sectorName: 'Retail' },
      { leadId: insertedLeads[2]!.id, sectorName: 'Manufacturing' },
      { leadId: insertedLeads[3]!.id, sectorName: 'Healthcare' },
      { leadId: insertedLeads[4]!.id, sectorName: 'Financial Services' },
    ]
    const insertedSectors = await db.insert(leadBusinessSectors).values(sectorSeeds).returning()
    console.log(`✅ ${insertedSectors.length}개 비즈니스 섹터 생성 완료\n`)

    // 11. 리드 제품 카테고리 데이터 생성
    console.log('🏷️ 리드 제품 카테고리 데이터 생성 중...')
    const categorySeeds = [
      { leadId: insertedLeads[0]!.id, categoryName: 'SaaS' },
      { leadId: insertedLeads[0]!.id, categoryName: 'B2B Software' },
      { leadId: insertedLeads[1]!.id, categoryName: 'Online Marketplace' },
      { leadId: insertedLeads[2]!.id, categoryName: 'Industrial IoT' },
      { leadId: insertedLeads[3]!.id, categoryName: 'Digital Health' },
      { leadId: insertedLeads[4]!.id, categoryName: 'Blockchain' },
    ]
    const insertedCategories = await db
      .insert(leadProductCategories)
      .values(categorySeeds)
      .returning()
    console.log(`✅ ${insertedCategories.length}개 제품 카테고리 생성 완료\n`)

    // 12. 리드 산업 유형 데이터 생성
    console.log('🏢 리드 산업 유형 데이터 생성 중...')
    const industrySeeds = [
      { leadId: insertedLeads[0]!.id, industryName: 'Information Technology' },
      { leadId: insertedLeads[1]!.id, industryName: 'E-commerce & Retail' },
      { leadId: insertedLeads[2]!.id, industryName: 'Manufacturing & Industry 4.0' },
      { leadId: insertedLeads[3]!.id, industryName: 'Healthcare & Medical' },
      { leadId: insertedLeads[4]!.id, industryName: 'Finance & Banking' },
    ]
    const insertedIndustries = await db.insert(leadIndustryTypes).values(industrySeeds).returning()
    console.log(`✅ ${insertedIndustries.length}개 산업 유형 생성 완료\n`)

    // 13. 고객 그룹 데이터 생성
    console.log('👥 고객 그룹 데이터 생성 중...')
    const groupSeeds = [
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: 'VIP 고객',
        description: '매출 상위 10% 핵심 고객',
        criteria: { leadScore: { min: 80 } },
        isDynamic: true,
        createdBy: insertedUsers[0]!.id,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: 'IT 업계',
        description: 'IT 및 소프트웨어 업계 리드',
        criteria: { businessType: ['IT서비스', '금융IT'] },
        isDynamic: false,
        createdBy: insertedUsers[0]!.id,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: '미응답 고객',
        description: '3회 이상 연락 시도했으나 미응답',
        criteria: { lastContactedAt: { days: 30 } },
        isDynamic: true,
        createdBy: insertedUsers[1]!.id,
      },
      {
        workspaceId: insertedWorkspaces[1]!.id,
        name: '파트너 후보',
        description: '파트너십 제안 대상',
        criteria: { employeeCount: ['100-500', '200-500'] },
        isDynamic: false,
        createdBy: insertedUsers[1]!.id,
      },
      {
        workspaceId: insertedWorkspaces[2]!.id,
        name: '해외 진출 타겟',
        description: '글로벌 시장 진출 가능 리드',
        criteria: { leadScore: { min: 70 } },
        isDynamic: true,
        createdBy: insertedUsers[2]!.id,
      },
    ]
    const insertedGroups = await db.insert(customerGroups).values(groupSeeds).returning()
    console.log(`✅ ${insertedGroups.length}개 고객 그룹 생성 완료\n`)

    // 14. 고객 그룹 멤버 데이터 생성
    console.log('👤 고객 그룹 멤버 데이터 생성 중...')
    const groupMemberSeeds = [
      {
        groupId: insertedGroups[0]!.id,
        leadId: insertedLeads[1]!.id,
        addedBy: insertedUsers[0]!.id,
      },
      {
        groupId: insertedGroups[0]!.id,
        leadId: insertedLeads[2]!.id,
        addedBy: insertedUsers[0]!.id,
      },
      {
        groupId: insertedGroups[1]!.id,
        leadId: insertedLeads[0]!.id,
        addedBy: insertedUsers[0]!.id,
      },
      {
        groupId: insertedGroups[1]!.id,
        leadId: insertedLeads[4]!.id,
        addedBy: insertedUsers[0]!.id,
      },
      {
        groupId: insertedGroups[2]!.id,
        leadId: insertedLeads[3]!.id,
        addedBy: insertedUsers[1]!.id,
      },
    ]
    const insertedGroupMembers = await db
      .insert(customerGroupMembers)
      .values(groupMemberSeeds)
      .returning()
    console.log(`✅ ${insertedGroupMembers.length}개 그룹 멤버 생성 완료\n`)

    // 15. 이메일 템플릿 데이터 생성
    console.log('✉️ 이메일 템플릿 데이터 생성 중...')
    const templateSeeds = [
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: '첫 연락 템플릿',
        description: '신규 리드에게 보내는 첫 소개 이메일',
        subject: '안녕하세요, {{company_name}}님! 그린다AI 소개드립니다',
        bodyText:
          '{{company_name}} 담당자님께,\n\n그린다AI의 AI 기반 영업 자동화 솔루션을 소개드립니다...',
        bodyHtml:
          '<p>{{company_name}} 담당자님께,</p><p>그린다AI의 AI 기반 영업 자동화 솔루션을 소개드립니다...</p>',
        variables: { company_name: 'string', contact_name: 'string' },
        category: 'outreach',
        isShared: true,
        createdBy: insertedUsers[0]!.id,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: '팔로우업 템플릿',
        description: '첫 이메일 후 후속 연락용',
        subject: '{{company_name}}님, 제안서를 공유드립니다',
        bodyText:
          '안녕하세요,\n\n지난번 연락 드린 {{contact_name}}입니다. 제안서를 첨부해 드립니다...',
        bodyHtml:
          '<p>안녕하세요,</p><p>지난번 연락 드린 {{contact_name}}입니다. 제안서를 첨부해 드립니다...</p>',
        variables: { company_name: 'string', contact_name: 'string' },
        category: 'follow_up',
        isShared: true,
        createdBy: insertedUsers[0]!.id,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: '미팅 요청 템플릿',
        description: '데모 미팅 요청용 이메일',
        subject: '{{company_name}}님과의 미팅을 제안드립니다',
        bodyText: '{{contact_name}}님,\n\n귀사의 비즈니스 성장을 위한 미팅을 제안드립니다...',
        bodyHtml:
          '<p>{{contact_name}}님,</p><p>귀사의 비즈니스 성장을 위한 미팅을 제안드립니다...</p>',
        variables: { company_name: 'string', contact_name: 'string', available_dates: 'string' },
        category: 'meeting',
        isShared: false,
        createdBy: insertedUsers[1]!.id,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: '감사 인사 템플릿',
        description: '미팅 후 감사 이메일',
        subject: '{{company_name}}님, 귀한 시간 내주셔서 감사합니다',
        bodyText: '{{contact_name}}님,\n\n오늘 미팅 시간 내주셔서 감사드립니다...',
        bodyHtml: '<p>{{contact_name}}님,</p><p>오늘 미팅 시간 내주셔서 감사드립니다...</p>',
        variables: { company_name: 'string', contact_name: 'string' },
        category: 'thank_you',
        isShared: true,
        createdBy: insertedUsers[0]!.id,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: '계약 제안 템플릿',
        description: '최종 계약 제안서 발송용',
        subject: '{{company_name}}님께 특별 제안을 드립니다',
        bodyText:
          '{{contact_name}}님,\n\n{{company_name}}를 위한 맞춤 계약 제안서를 준비했습니다...',
        bodyHtml:
          '<p>{{contact_name}}님,</p><p>{{company_name}}를 위한 맞춤 계약 제안서를 준비했습니다...</p>',
        variables: { company_name: 'string', contact_name: 'string', discount: 'number' },
        category: 'proposal',
        isShared: true,
        createdBy: insertedUsers[0]!.id,
      },
    ]
    const insertedTemplates = await db.insert(emailTemplates).values(templateSeeds).returning()
    console.log(`✅ ${insertedTemplates.length}개 이메일 템플릿 생성 완료\n`)

    // 16. 시퀀스 데이터 생성
    console.log('📊 시퀀스 데이터 생성 중...')
    const sequenceSeeds = [
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: '신규 리드 육성 시퀀스',
        description: '신규 리드를 고객으로 전환하기 위한 7일 시퀀스',
        status: 'active' as const,
        createdBy: insertedUsers[0]!.id,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: '데모 후 팔로우업',
        description: '제품 데모 후 후속 조치를 위한 시퀀스',
        status: 'active' as const,
        createdBy: insertedUsers[1]!.id,
      },
      {
        workspaceId: insertedWorkspaces[0]!.id,
        name: '재참여 캠페인',
        description: '90일 이상 미응답 리드 재활성화',
        status: 'paused' as const,
        createdBy: insertedUsers[0]!.id,
      },
      {
        workspaceId: insertedWorkspaces[1]!.id,
        name: '파트너십 제안 시퀀스',
        description: '파트너사 제안을 위한 단계별 접근',
        status: 'active' as const,
        createdBy: insertedUsers[1]!.id,
      },
      {
        workspaceId: insertedWorkspaces[2]!.id,
        name: '글로벌 아웃리치',
        description: '해외 시장 진출을 위한 영문 시퀀스',
        status: 'draft' as const,
        createdBy: insertedUsers[2]!.id,
      },
    ]
    const insertedSequences = await db.insert(sequences).values(sequenceSeeds).returning()
    console.log(`✅ ${insertedSequences.length}개 시퀀스 생성 완료\n`)

    // 17. 시퀀스 스텝 데이터 생성
    console.log('📝 시퀀스 스텝 데이터 생성 중...')
    const stepSeeds = [
      {
        sequenceId: insertedSequences[0]!.id,
        stepOrder: 1,
        delayDays: 0,
        emailSubject: '안녕하세요, {{company_name}}님!',
        emailBodyText: '첫 인사드립니다...',
        emailBodyHtml: '<p>첫 인사드립니다...</p>',
        emailTemplateId: insertedTemplates[0]!.id,
      },
      {
        sequenceId: insertedSequences[0]!.id,
        stepOrder: 2,
        delayDays: 3,
        emailSubject: '{{company_name}}님께 도움이 될만한 자료입니다',
        emailBodyText: '안녕하세요, 다시 연락드립니다...',
        emailBodyHtml: '<p>안녕하세요, 다시 연락드립니다...</p>',
        emailTemplateId: insertedTemplates[1]!.id,
      },
      {
        sequenceId: insertedSequences[0]!.id,
        stepOrder: 3,
        delayDays: 7,
        emailSubject: '{{company_name}}님, 미팅 가능하신가요?',
        emailBodyText: '미팅을 제안드립니다...',
        emailBodyHtml: '<p>미팅을 제안드립니다...</p>',
        emailTemplateId: insertedTemplates[2]!.id,
      },
      {
        sequenceId: insertedSequences[1]!.id,
        stepOrder: 1,
        delayDays: 1,
        emailSubject: '데모 참여해주셔서 감사합니다',
        emailBodyText: '감사 인사드립니다...',
        emailBodyHtml: '<p>감사 인사드립니다...</p>',
        emailTemplateId: insertedTemplates[3]!.id,
      },
      {
        sequenceId: insertedSequences[1]!.id,
        stepOrder: 2,
        delayDays: 5,
        emailSubject: '특별 제안을 드립니다',
        emailBodyText: '맞춤 제안서를 준비했습니다...',
        emailBodyHtml: '<p>맞춤 제안서를 준비했습니다...</p>',
        emailTemplateId: insertedTemplates[4]!.id,
      },
    ]
    const insertedSteps = await db.insert(sequenceSteps).values(stepSeeds).returning()
    console.log(`✅ ${insertedSteps.length}개 시퀀스 스텝 생성 완료\n`)

    console.log('✨ 모든 시드 데이터 생성 완료!\n')
    console.log('📊 생성된 데이터 요약:')
    console.log(`  - 부서: ${insertedDepartments.length}개`)
    console.log(`  - 사용자: ${insertedUsers.length}명`)
    console.log(`  - 워크스페이스: ${insertedWorkspaces.length}개`)
    console.log(`  - 워크스페이스 멤버: ${insertedMembers.length}명`)
    console.log(`  - 이메일 계정: ${insertedEmailAccounts.length}개`)
    console.log(`  - 리드: ${insertedLeads.length}개`)
    console.log(`  - 리드 연락처: ${insertedContacts.length}개`)
    console.log(`  - 소셜미디어: ${insertedSocialMedia.length}개`)
    console.log(`  - 제품: ${insertedProducts.length}개`)
    console.log(`  - 비즈니스 섹터: ${insertedSectors.length}개`)
    console.log(`  - 제품 카테고리: ${insertedCategories.length}개`)
    console.log(`  - 산업 유형: ${insertedIndustries.length}개`)
    console.log(`  - 고객 그룹: ${insertedGroups.length}개`)
    console.log(`  - 그룹 멤버: ${insertedGroupMembers.length}개`)
    console.log(`  - 이메일 템플릿: ${insertedTemplates.length}개`)
    console.log(`  - 시퀀스: ${insertedSequences.length}개`)
    console.log(`  - 시퀀스 스텝: ${insertedSteps.length}개`)
  } catch (error) {
    console.error('❌ 시드 데이터 생성 실패:', error)
    throw error
  } finally {
    process.exit(0)
  }
}

// 스크립트 실행
seed().catch((error) => {
  console.error('시드 스크립트 실패:', error)
  process.exit(1)
})
