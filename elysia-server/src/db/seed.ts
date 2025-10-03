import { eq } from "drizzle-orm"
import { db } from "./index"
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
  type NewCustomerGroupMember,
  type NewLead,
  type NewLeadContact,
  type NewLeadProduct,
  type NewLeadSocialMedia,
  sequenceSteps,
  sequences,
  userEmailAccounts,
  users,
  workspaceMembers,
  workspaces,
} from "./schema"

// Type guard helper to filter out falsy values
function isNotFalsy<T>(value: T | false | null | undefined | 0 | ""): value is T {
  return Boolean(value)
}

export async function seed() {
  console.log("🌱 시드 데이터 생성 시작...\n")

  try {
    // 1. 부서 데이터 생성
    console.log("📁 부서 데이터 생성 중...")
    const departmentSeeds = [
      {
        name: "커뮤니케이션팀",
        code: "COMM",
        description: "그린다에이아이 커뮤니케이션팀",
        isActive: true,
      },
      {
        name: "프로덕트팀",
        code: "PROD",
        description: "그린다에이아이 프로덕트팀",
        isActive: true,
      },
      { name: "SDR팀", code: "SDR", description: "그린다에이아이 SDR팀", isActive: true },
      {
        name: "경영지원팀",
        code: "MGMT",
        description: "그린다에이아이 경영지원팀",
        isActive: true,
      },
      { name: "개발팀", code: "DEV", description: "그린다에이아이 개발팀", isActive: true },
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
        if (inserted) {
          insertedDepartments.push(inserted)
        }
      } else {
        console.log(`  ⏭️  부서 '${dept.name}' 이미 존재, 건너뜀`)
        const existingDept = existing[0]
        if (existingDept) {
          insertedDepartments.push(existingDept)
        }
      }
    }
    console.log(`✅ ${insertedDepartments.length}개 부서 처리 완료\n`)

    // 2. 사용자 데이터 생성
    console.log("👤 사용자 데이터 생성 중...")
    const userSeeds = [
      insertedDepartments[0]?.id && {
        username: "김철수",
        email: "chulsoo.kim@greenda.ai",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        userRole: "admin" as const,
        departmentId: insertedDepartments[0].id,
        employeeId: "EMP001",
        isActive: true,
      },
      insertedDepartments[1]?.id && {
        username: "이영희",
        email: "younghee.lee@greenda.ai",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        userRole: "user" as const,
        departmentId: insertedDepartments[1].id,
        employeeId: "EMP002",
        isActive: true,
      },
      insertedDepartments[2]?.id && {
        username: "박민수",
        email: "minsoo.park@greenda.ai",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        userRole: "user" as const,
        departmentId: insertedDepartments[2].id,
        employeeId: "EMP003",
        isActive: true,
      },
      insertedDepartments[3]?.id && {
        username: "정수진",
        email: "sujin.jung@greenda.ai",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        userRole: "user" as const,
        departmentId: insertedDepartments[3].id,
        employeeId: "EMP004",
        isActive: true,
      },
      insertedDepartments[4]?.id && {
        username: "최동훈",
        email: "donghoon.choi@greenda.ai",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        userRole: "user" as const,
        departmentId: insertedDepartments[4].id,
        employeeId: "EMP005",
        isActive: true,
      },
    ].filter(Boolean)

    const insertedUsers: (typeof users.$inferSelect)[] = []
    for (const user of userSeeds) {
      if (!user) continue
      const existing = await db.select().from(users).where(eq(users.email, user.email)).limit(1)
      if (existing.length === 0) {
        const [inserted] = await db.insert(users).values(user).returning()
        if (inserted) {
          insertedUsers.push(inserted)
        }
      } else {
        console.log(`  ⏭️  사용자 '${user.email}' 이미 존재, 건너뜀`)
        const existingUser = existing[0]
        if (existingUser) {
          insertedUsers.push(existingUser)
        }
      }
    }
    console.log(`✅ ${insertedUsers.length}명 사용자 처리 완료\n`)

    // 3. 워크스페이스 데이터 생성
    console.log("🏢 워크스페이스 데이터 생성 중...")
    const workspaceSeeds = [
      insertedUsers[0]?.id && {
        name: "퓨어글로우 코스메틱",
        description: "천연 화장품 전문 브랜드의 해외 바이어 개척 워크스페이스",
        ownerId: insertedUsers[0].id,
        isActive: true,
      },
      insertedUsers[1]?.id && {
        name: "블룸에센스",
        description: "K-뷰티 스킨케어 브랜드의 글로벌 B2B 영업 워크스페이스",
        ownerId: insertedUsers[1].id,
        isActive: true,
      },
      insertedUsers[2]?.id && {
        name: "루나뷰티랩",
        description: "기능성 화장품 ODM/OEM 전문기업 해외 파트너 발굴",
        ownerId: insertedUsers[2].id,
        isActive: true,
      },
      insertedUsers[0]?.id && {
        name: "아쿠아실크",
        description: "수분크림 전문 브랜드의 동남아/중동 바이어 컨택",
        ownerId: insertedUsers[0].id,
        isActive: true,
      },
      insertedUsers[3]?.id && {
        name: "센티드가든",
        description: "향수 및 바디케어 브랜드의 유럽/미주 시장 진출",
        ownerId: insertedUsers[3].id,
        isActive: true,
      },
      insertedUsers[4]?.id && {
        name: "루카스에듀테인먼트",
        description: "교육 콘텐츠 및 엔터테인먼트 서비스의 글로벌 확장",
        ownerId: insertedUsers[4].id,
        isActive: true,
      },
      insertedUsers[0]?.id && {
        name: "예지상사",
        description: "종합 무역 및 유통 서비스의 해외 바이어 네트워크 구축",
        ownerId: insertedUsers[0].id,
        isActive: true,
      },
      insertedUsers[1]?.id && {
        name: "익투스",
        description: "IT 서비스 및 솔루션의 글로벌 파트너십 개발",
        ownerId: insertedUsers[1].id,
        isActive: true,
      },
      insertedUsers[2]?.id && {
        name: "리오닉스",
        description: "엔진 오일 첨가제 및 화학 제품의 해외 유통망 확대",
        ownerId: insertedUsers[2].id,
        isActive: true,
      },
      insertedUsers[3]?.id && {
        name: "브이시드니",
        description: "뷰티 컨설팅 및 마케팅 서비스의 호주/아시아 시장 진출",
        ownerId: insertedUsers[3].id,
        isActive: true,
      },
    ].filter(Boolean)

    const insertedWorkspaces: (typeof workspaces.$inferSelect)[] = []
    for (const workspace of workspaceSeeds) {
      if (!workspace) continue
      const existing = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.name, workspace.name))
        .limit(1)
      if (existing.length === 0) {
        const [inserted] = await db.insert(workspaces).values(workspace).returning()
        if (inserted) {
          insertedWorkspaces.push(inserted)
        }
      } else {
        console.log(`  ⏭️  워크스페이스 '${workspace.name}' 이미 존재, 건너뜀`)
        if (existing[0]) {
          insertedWorkspaces.push(existing[0])
        }
      }
    }
    console.log(`✅ ${insertedWorkspaces.length}개 워크스페이스 처리 완료\n`)

    // 4. 워크스페이스 멤버 데이터 생성
    console.log("👥 워크스페이스 멤버 데이터 생성 중...")
    const memberSeeds: {
      workspaceId: string
      userId: string
      role: "owner" | "admin" | "member" | "viewer"
      status: "active" | "inactive" | "invited" | "removed"
      invitedBy?: string
      joinedAt?: Date
    }[] = []

    // 각 워크스페이스에 owner 멤버 추가 (처음 5개는 기존 로직 유지)
    insertedWorkspaces.forEach((workspace, index) => {
      if (index < 5) {
        // 기존 워크스페이스들에 대한 멤버 설정
        memberSeeds.push({
          workspaceId: workspace.id,
          userId: workspace.ownerId,
          role: "owner" as const,
          invitedBy: workspace.ownerId,
          joinedAt: new Date(),
          status: "active" as const,
        })

        // 첫 번째 워크스페이스에 추가 멤버들
        if (index === 0) {
          if (insertedUsers[1]?.id) {
            memberSeeds.push({
              workspaceId: workspace.id,
              userId: insertedUsers[1].id,
              role: "admin" as const,
              invitedBy: workspace.ownerId,
              joinedAt: new Date(),
              status: "active" as const,
            })
          }
          if (insertedUsers[2]?.id) {
            memberSeeds.push({
              workspaceId: workspace.id,
              userId: insertedUsers[2].id,
              role: "member" as const,
              invitedBy: workspace.ownerId,
              joinedAt: new Date(),
              status: "active" as const,
            })
          }
        }
      } else {
        // 새로운 워크스페이스들에 대한 owner 멤버 설정
        memberSeeds.push({
          workspaceId: workspace.id,
          userId: workspace.ownerId,
          role: "owner" as const,
          invitedBy: workspace.ownerId,
          joinedAt: new Date(),
          status: "active" as const,
        })
      }
    })

    const insertedMembers = await db.insert(workspaceMembers).values(memberSeeds).returning()
    console.log(`✅ ${insertedMembers.length}명 워크스페이스 멤버 생성 완료\n`)

    // 5. 이메일 계정 데이터 생성
    console.log("📧 이메일 계정 데이터 생성 중...")
    const emailAccountSeeds = [
      insertedUsers[0]?.id &&
        insertedWorkspaces[0]?.id && {
          userId: insertedUsers[0].id,
          workspaceId: insertedWorkspaces[0].id,
          emailAddress: "rinda@partners.grinda.ai",
          displayName: "Rinda Expert - 그린다에이아이",
          apiKey: Bun.env.SENDGRID_API_KEY || "SG.test_api_key_default",
          sendgridVerifiedSenderId: "sender_id_rinda",
          isVerified: true,
          isDefault: true,
          dailyLimit: 1000,
          monthlyLimit: 25000,
          status: "active" as const,
        },
      insertedUsers[0]?.id &&
        insertedWorkspaces[0]?.id && {
          userId: insertedUsers[0].id,
          workspaceId: insertedWorkspaces[0].id,
          emailAddress: "rinda@partners.grinda.ai",
          displayName: "Rinda Expert - 그린다에이아이 (User 1-2)",
          apiKey: "SG.test_api_key_1234567890",
          sendgridVerifiedSenderId: "sender_id_001",
          isVerified: true,
          isDefault: false,
          dailyLimit: 500,
          monthlyLimit: 10000,
          status: "active" as const,
        },
      insertedUsers[1]?.id &&
        insertedWorkspaces[0]?.id && {
          userId: insertedUsers[1].id,
          workspaceId: insertedWorkspaces[0].id,
          emailAddress: "rinda@partners.grinda.ai",
          displayName: "Rinda Expert - 그린다에이아이 (User 2)",
          apiKey: "SG.test_api_key_2234567890",
          sendgridVerifiedSenderId: "sender_id_002",
          isVerified: true,
          isDefault: false,
          dailyLimit: 1000,
          monthlyLimit: 20000,
          status: "active" as const,
        },
      insertedUsers[2]?.id &&
        insertedWorkspaces[2]?.id && {
          userId: insertedUsers[2].id,
          workspaceId: insertedWorkspaces[2].id,
          emailAddress: "rinda@partners.grinda.ai",
          displayName: "Rinda Expert - 그린다에이아이 (User 3)",
          apiKey: "SG.test_api_key_3234567890",
          sendgridVerifiedSenderId: "sender_id_003",
          isVerified: true,
          isDefault: true,
          dailyLimit: 300,
          monthlyLimit: 8000,
          status: "active" as const,
        },
      insertedUsers[3]?.id &&
        insertedWorkspaces[4]?.id && {
          userId: insertedUsers[3].id,
          workspaceId: insertedWorkspaces[4].id,
          emailAddress: "rinda@partners.grinda.ai",
          displayName: "Rinda Expert - 그린다에이아이 (User 4)",
          apiKey: "SG.test_api_key_4234567890",
          isVerified: false,
          isDefault: true,
          dailyLimit: 200,
          monthlyLimit: 5000,
          status: "inactive" as const,
        },
      insertedUsers[0]?.id &&
        insertedWorkspaces[3]?.id && {
          userId: insertedUsers[0].id,
          workspaceId: insertedWorkspaces[3].id,
          emailAddress: "rinda@partners.grinda.ai",
          displayName: "Rinda Expert - 그린다에이아이 (User 5)",
          apiKey: "SG.test_api_key_5234567890",
          sendgridVerifiedSenderId: "sender_id_005",
          isVerified: true,
          isDefault: true,
          dailyLimit: 800,
          monthlyLimit: 15000,
          status: "active" as const,
        },
    ].filter(isNotFalsy)
    const insertedEmailAccounts = await db
      .insert(userEmailAccounts)
      .values(emailAccountSeeds)
      .returning()
    console.log(`✅ ${insertedEmailAccounts.length}개 이메일 계정 생성 완료\n`)

    // 6. 리드 데이터 생성 (워크스페이스별 10개씩)
    console.log("🎯 리드 데이터 생성 중...")
    const leadSeeds: Omit<NewLead, "id" | "createdAt" | "updatedAt">[] = []

    // 워크스페이스별로 10개씩 리드 데이터 생성
    const cosmetics_companies = [
      {
        name: "Sephora Asia Pacific",
        country: "싱가포르",
        type: "뷰티 리테일",
        employees: "1000-5000",
        score: 95,
      },
      {
        name: "Beauty Bay",
        country: "영국",
        type: "온라인 뷰티 리테일",
        employees: "200-500",
        score: 85,
      },
      {
        name: "Ulta Beauty",
        country: "미국",
        type: "뷰티 리테일 체인",
        employees: "10000+",
        score: 92,
      },
      {
        name: "Boots Thailand",
        country: "태국",
        type: "드럭스토어",
        employees: "500-1000",
        score: 78,
      },
      {
        name: "Guardian Malaysia",
        country: "말레이시아",
        type: "헬스&뷰티",
        employees: "1000-5000",
        score: 82,
      },
      {
        name: "Olive Young",
        country: "한국",
        type: "뷰티 전문점",
        employees: "5000-10000",
        score: 88,
      },
      {
        name: "AS Watson Group",
        country: "홍콩",
        type: "리테일 그룹",
        employees: "10000+",
        score: 93,
      },
      { name: "Nykaa", country: "인도", type: "온라인 뷰티", employees: "1000-5000", score: 79 },
      {
        name: "Mecca Brands",
        country: "호주",
        type: "프리미엄 뷰티",
        employees: "500-1000",
        score: 86,
      },
      {
        name: "루카스에듀테인먼트",
        country: "한국",
        type: "교육 콘텐츠",
        employees: "50-100",
        score: 88,
        contact: { name: "장진민", phone: "01086470485", email: "lukas@tam9.me" },
      },
    ]

    const kbeauty_companies = [
      {
        name: "Watsons Thailand",
        country: "태국",
        type: "드럭스토어 체인",
        employees: "5000-10000",
        score: 90,
      },
      {
        name: "Sasa Hong Kong",
        country: "홍콩",
        type: "K뷰티 리테일",
        employees: "1000-5000",
        score: 87,
      },
      {
        name: "Bonjour HK",
        country: "홍콩",
        type: "코스메틱 체인",
        employees: "500-1000",
        score: 76,
      },
      {
        name: "Tomod's Japan",
        country: "일본",
        type: "드럭스토어",
        employees: "1000-5000",
        score: 81,
      },
      {
        name: "Matsumoto Kiyoshi",
        country: "일본",
        type: "드럭스토어 체인",
        employees: "10000+",
        score: 91,
      },
      {
        name: "Venus Beauty Supply",
        country: "미국",
        type: "K뷰티 유통",
        employees: "100-200",
        score: 73,
      },
      {
        name: "Althea Korea",
        country: "싱가포르",
        type: "온라인 K뷰티",
        employees: "50-100",
        score: 77,
      },
      {
        name: "YesStyle",
        country: "홍콩",
        type: "온라인 패션&뷰티",
        employees: "200-500",
        score: 80,
      },
      {
        name: "Glow Recipe",
        country: "미국",
        type: "K뷰티 브랜드",
        employees: "50-100",
        score: 85,
      },
      {
        name: "예지상사",
        country: "한국",
        type: "무역 유통",
        employees: "20-50",
        score: 82,
        contact: { name: "지영진", phone: "01075570663", email: "yamy0612@naver.com" },
      },
    ]

    const odm_partners = [
      {
        name: "Douglas GmbH",
        country: "독일",
        type: "퍼퓸&코스메틱",
        employees: "10000+",
        score: 88,
      },
      {
        name: "Rossmann",
        country: "독일",
        type: "드럭스토어 체인",
        employees: "10000+",
        score: 89,
      },
      { name: "DM Drogerie", country: "독일", type: "드럭스토어", employees: "10000+", score: 87 },
      {
        name: "Marionnaud",
        country: "프랑스",
        type: "향수&화장품",
        employees: "5000-10000",
        score: 83,
      },
      { name: "Nocibe", country: "프랑스", type: "뷰티 리테일", employees: "1000-5000", score: 78 },
      {
        name: "Primor",
        country: "스페인",
        type: "코스메틱 체인",
        employees: "500-1000",
        score: 75,
      },
      {
        name: "Equivalenza",
        country: "스페인",
        type: "향수 전문점",
        employees: "1000-5000",
        score: 72,
      },
      {
        name: "ICI Paris XL",
        country: "네덜란드",
        type: "뷰티 체인",
        employees: "1000-5000",
        score: 81,
      },
      { name: "Kicks", country: "스웨덴", type: "뷰티 체인", employees: "500-1000", score: 76 },
      {
        name: "익투스",
        country: "한국",
        type: "IT 서비스",
        employees: "10-20",
        score: 79,
        contact: { name: "임수빈", phone: "01090652144", email: "ictuskorea@gmail.com" },
      },
    ]

    const moisture_buyers = [
      {
        name: "Noon UAE",
        country: "아랍에미리트",
        type: "이커머스",
        employees: "1000-5000",
        score: 82,
      },
      {
        name: "Namshi",
        country: "아랍에미리트",
        type: "온라인 패션&뷰티",
        employees: "500-1000",
        score: 79,
      },
      {
        name: "Ounass",
        country: "아랍에미리트",
        type: "럭셔리 이커머스",
        employees: "200-500",
        score: 85,
      },
      {
        name: "Centrepoint",
        country: "쿠웨이트",
        type: "백화점",
        employees: "5000-10000",
        score: 77,
      },
      {
        name: "Paris Gallery",
        country: "아랍에미리트",
        type: "럭셔리 리테일",
        employees: "1000-5000",
        score: 83,
      },
      {
        name: "Faces",
        country: "사우디아라비아",
        type: "뷰티 체인",
        employees: "1000-5000",
        score: 80,
      },
      {
        name: "Wojooh",
        country: "쿠웨이트",
        type: "뷰티 리테일",
        employees: "500-1000",
        score: 76,
      },
      {
        name: "Lazada Beauty",
        country: "싱가포르",
        type: "이커머스",
        employees: "1000-5000",
        score: 81,
      },
      {
        name: "Shopee Beauty",
        country: "싱가포르",
        type: "이커머스",
        employees: "5000-10000",
        score: 84,
      },
      {
        name: "리오닉스",
        country: "한국",
        type: "화학 제조",
        employees: "20-50",
        score: 75,
        contact: { name: "이승규", phone: "01033395161", email: "rionix@kakao.com" },
      },
    ]

    const fragrance_partners = [
      {
        name: "Harrods",
        country: "영국",
        type: "럭셔리 백화점",
        employees: "5000-10000",
        score: 94,
      },
      {
        name: "Selfridges",
        country: "영국",
        type: "프리미엄 백화점",
        employees: "1000-5000",
        score: 91,
      },
      {
        name: "Bergdorf Goodman",
        country: "미국",
        type: "럭셔리 백화점",
        employees: "500-1000",
        score: 93,
      },
      {
        name: "Neiman Marcus",
        country: "미국",
        type: "프리미엄 백화점",
        employees: "5000-10000",
        score: 89,
      },
      {
        name: "Saks Fifth Avenue",
        country: "미국",
        type: "럭셔리 백화점",
        employees: "1000-5000",
        score: 90,
      },
      {
        name: "Galeries Lafayette",
        country: "프랑스",
        type: "백화점",
        employees: "10000+",
        score: 88,
      },
      {
        name: "Le Bon Marché",
        country: "프랑스",
        type: "럭셔리 백화점",
        employees: "1000-5000",
        score: 92,
      },
      {
        name: "KaDeWe",
        country: "독일",
        type: "프리미엄 백화점",
        employees: "1000-5000",
        score: 86,
      },
      {
        name: "La Rinascente",
        country: "이탈리아",
        type: "백화점",
        employees: "1000-5000",
        score: 84,
      },
      {
        name: "브이시드니 VM Sydney",
        country: "호주",
        type: "뷰티 컨설팅",
        employees: "10-20",
        score: 80,
        contact: { name: "윤유리", phone: "", email: "vmsydney@example.com" },
      },
    ]

    // 각 워크스페이스별로 리드 생성
    const companyLists = [
      cosmetics_companies,
      kbeauty_companies,
      odm_partners,
      moisture_buyers,
      fragrance_partners,
    ]

    companyLists.forEach((companies, wsIndex) => {
      companies.forEach((company, _index) => {
        // 특정 연락처가 있는 기업들은 converted 상태로 설정
        const hasContact = "contact" in company
        const statusOptions = ["new", "contacted", "qualified", "converted", "lost"] as const
        const randomStatusIndex = Math.floor(Math.random() * 5)
        const leadStatus = hasContact
          ? ("converted" as const)
          : (statusOptions[randomStatusIndex] ?? "new")
        const sourceOptions = ["website_crawl", "linkedin", "referral", "event", "partner"]
        const randomSourceIndex = Math.floor(Math.random() * 5)
        const leadSource = hasContact
          ? "referral"
          : (sourceOptions[randomSourceIndex] ?? "website_crawl")

        const workspaceId = insertedWorkspaces[wsIndex]?.id
        if (!workspaceId) return

        leadSeeds.push({
          workspaceId: workspaceId,
          companyName: company.name,
          foundCompanyName: `${company.name} Ltd.`,
          websiteUrl: `https://${company.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          finalUrl: `https://${company.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          httpStatus: 200,
          nameUrlMatch: true,
          businessType: company.type,
          isBusinessTypeMatched: true,
          description: `${company.country}의 주요 ${company.type} 기업`,
          address: `Business District, ${company.country}`,
          country: company.country,
          city: company.country,
          state: company.country,
          foundedYear: 1990 + Math.floor(Math.random() * 30),
          employeeCount: company.employees,
          leadSource: leadSource,
          leadStatus: leadStatus,
          leadScore: company.score,
          createdBy: insertedUsers[Math.floor(Math.random() * insertedUsers.length)]?.id,
          collectedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // 최근 30일 내 랜덤
          // 특정 연락처 정보가 있으면 추가
          ...(hasContact && company.contact ? { notes: `담당자: ${company.contact.name}` } : {}),
        })
      })
    })

    const insertedLeads = await db.insert(leads).values(leadSeeds).returning()
    console.log(`✅ ${insertedLeads.length}개 리드 생성 완료 (워크스페이스별 10개)\n`)

    // 7. 리드 연락처 데이터 생성 (각 리드당 1-2개)
    console.log("📞 리드 연락처 데이터 생성 중...")
    const contactSeeds: Omit<NewLeadContact, "id" | "createdAt" | "updatedAt">[] = []

    // 모든 리드에 대해 연락처 생성
    insertedLeads.forEach((lead) => {
      if (!lead.companyName) return
      const domain = lead.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")

      // leadSeeds에서 해당 lead의 원본 회사 정보 찾기
      const companyInfo = companyLists.flat().find((c) => c.name === lead.companyName)
      const hasSpecificContact = companyInfo && "contact" in companyInfo

      if (hasSpecificContact && companyInfo.contact) {
        // 특정 연락처 정보가 있는 경우
        if (companyInfo.contact.email) {
          contactSeeds.push({
            leadId: lead.id,
            contactType: "email" as const,
            contactValue: companyInfo.contact.email,
            label: "main",
            isPrimary: true,
            isVerified: true, // 실제 연락처는 검증됨으로 표시
          })
        }
        if (companyInfo.contact.phone) {
          contactSeeds.push({
            leadId: lead.id,
            contactType: "phone" as const,
            contactValue: companyInfo.contact.phone,
            label: "mobile",
            isPrimary: false,
            isVerified: true,
          })
        }
      } else {
        // 일반 더미 데이터 생성
        contactSeeds.push({
          leadId: lead.id,
          contactType: "email" as const,
          contactValue: `contact@${domain}.com`,
          label: "main",
          isPrimary: true,
          isVerified: Math.random() > 0.3, // 70% 확률로 검증됨
        })

        // 50% 확률로 전화번호도 추가
        if (Math.random() > 0.5) {
          const phonePrefix = ["+1", "+44", "+65", "+971", "+49", "+33", "+82", "+81"][
            Math.floor(Math.random() * 8)
          ]
          contactSeeds.push({
            leadId: lead.id,
            contactType: "phone" as const,
            contactValue: `${phonePrefix} ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
            label: ["office", "sales", "mobile"][Math.floor(Math.random() * 3)],
            isPrimary: false,
            isVerified: Math.random() > 0.5,
          })
        }
      }
    })

    const insertedContacts = await db.insert(leadContacts).values(contactSeeds).returning()
    console.log(`✅ ${insertedContacts.length}개 리드 연락처 생성 완료\n`)

    // 8. 리드 소셜미디어 데이터 생성 (각 리드당 1-3개)
    console.log("📱 리드 소셜미디어 데이터 생성 중...")
    const socialMediaSeeds: Omit<NewLeadSocialMedia, "id" | "createdAt" | "updatedAt">[] = []
    const platforms = ["linkedin", "facebook", "instagram", "twitter"] as const
    const followerCounts = ["1K", "5K", "10K", "25K", "50K", "100K", "500K", "1M"]

    insertedLeads.forEach((lead) => {
      if (!lead.companyName) return
      const username = lead.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")
      const numPlatforms = Math.floor(Math.random() * 3) + 1 // 1-3개 플랫폼

      // 랜덤으로 플랫폼 선택
      const selectedPlatforms = [...platforms]
        .sort(() => 0.5 - Math.random())
        .slice(0, numPlatforms)

      selectedPlatforms.forEach((platform) => {
        socialMediaSeeds.push({
          leadId: lead.id,
          platform: platform,
          url: `https://${platform === "linkedin" ? "linkedin.com/company" : platform}.com/${username}`,
          username: platform === "twitter" || platform === "instagram" ? `@${username}` : username,
          followerCount:
            Math.random() > 0.5
              ? followerCounts[Math.floor(Math.random() * followerCounts.length)]
              : undefined,
          isVerified: Math.random() > 0.4, // 60% 확률로 검증됨
        })
      })
    })

    const insertedSocialMedia = await db
      .insert(leadSocialMedia)
      .values(socialMediaSeeds)
      .returning()
    console.log(`✅ ${insertedSocialMedia.length}개 소셜미디어 생성 완료\n`)

    // 9. 리드 제품 데이터 생성 (각 리드당 1-2개)
    console.log("📦 리드 제품 데이터 생성 중...")
    const productSeeds: Omit<NewLeadProduct, "id" | "createdAt">[] = []

    const productsByType: Record<string, string[]> = {
      "뷰티 리테일": ["스킨케어 라인", "메이크업 컬렉션", "향수 컬렉션", "헤어케어 제품"],
      "온라인 뷰티 리테일": ["K-뷰티 박스", "프리미엄 스킨케어", "비건 화장품", "맞춤형 뷰티"],
      "뷰티 리테일 체인": ["브랜드 화장품", "자체 PB상품", "프리미엄 스킨케어", "선케어 제품"],
      드럭스토어: ["기초 화장품", "색조 화장품", "바디케어", "헬스케어 제품"],
      "헬스&뷰티": ["유기농 화장품", "기능성 화장품", "더마 코스메틱", "뷰티 디바이스"],
      "뷰티 전문점": ["트렌드 메이크업", "시트 마스크", "클렌징 제품", "에센스/세럼"],
      "리테일 그룹": ["멀티브랜드 화장품", "PB 뷰티 라인", "수입 화장품", "로컬 브랜드"],
      "온라인 뷰티": ["인플루언서 콜라보", "구독 박스", "샘플 키트", "리미티드 에디션"],
      "프리미엄 뷰티": ["럭셔리 스킨케어", "프리미엄 향수", "안티에이징", "스파 제품"],
      "럭셔리 뷰티": ["하이엔드 브랜드", "아티스트 콜라보", "한정판 컬렉션", "프레스티지 라인"],
      "드럭스토어 체인": ["대용량 제품", "가성비 화장품", "민감성 피부용", "자연주의 화장품"],
      "K뷰티 리테일": ["달팽이 크림", "시카 제품", "BB/CC 크림", "쿠션 팩트"],
      "코스메틱 체인": ["트렌드 컬러", "시즌 한정품", "기프트 세트", "트래블 키트"],
      "K뷰티 유통": ["마스크팩", "톤업 크림", "선스틱", "앰플/부스터"],
      "온라인 K뷰티": ["10단계 루틴 세트", "글로우 메이크업", "디톡스 제품", "한방 화장품"],
      "K뷰티 브랜드": ["발효 화장품", "미백 기능성", "주름 개선", "더블 기능성"],
      "K뷰티 큐레이션": ["베스트셀러 세트", "스타터 키트", "피부 타입별 세트", "고민별 솔루션"],
      "퍼퓸&코스메틱": ["니치 향수", "아로마테라피", "바디 미스트", "홈 프래그런스"],
      "향수&화장품": ["EDP/EDT", "솔리드 퍼퓸", "롤온 향수", "헤어 퍼퓸"],
      "향수 전문점": ["계절별 향수", "맞춤 조향", "레이어링 세트", "미니어처 컬렉션"],
      "뷰티 체인": ["올리브영 PB", "왓슨스 PB", "부츠 PB", "더글라스 PB"],
      이커머스: ["베스트셀러", "신제품", "번들 상품", "플래시 세일"],
      "온라인 패션&뷰티": ["인플루언서 픽", "리뷰 베스트", "재구매율 1위", "할인 특가"],
      "럭셔리 이커머스": ["프레스티지", "리미티드", "익스클루시브", "VIP 전용"],
      백화점: ["1층 브랜드", "팝업 스토어", "신규 런칭", "백화점 단독"],
      "럭셔리 리테일": ["하이엔드", "부티크 전용", "아티잔 제품", "수공예품"],
      "럭셔리 백화점": ["컨시어지 추천", "시그니처 라인", "헤리티지 컬렉션", "캡슐 컬렉션"],
      "프리미엄 백화점": ["디자이너 콜라보", "시즌 오프", "멤버십 특전", "기프트 위드 퍼처스"],
      "백화점 체인": ["전국 매장", "온라인몰", "면세점", "아울렛"],
    }

    insertedLeads.forEach((lead) => {
      const productOptions = productsByType[lead.businessType ?? ""] || [
        "화장품",
        "스킨케어",
        "메이크업",
        "향수",
      ]
      const numProducts = Math.floor(Math.random() * 2) + 1 // 1-2개 제품

      const selectedProducts = [...productOptions]
        .sort(() => 0.5 - Math.random())
        .slice(0, numProducts)

      selectedProducts.forEach((product) => {
        productSeeds.push({
          leadId: lead.id,
          productName: product,
          description: `${lead.companyName}의 주력 ${product}`,
        })
      })
    })

    const insertedProducts = await db.insert(leadProducts).values(productSeeds).returning()
    console.log(`✅ ${insertedProducts.length}개 제품 생성 완료\n`)

    // 10. 리드 비즈니스 섹터 데이터 생성
    console.log("🏭 리드 비즈니스 섹터 데이터 생성 중...")
    const sectorSeeds = [
      insertedLeads[0]?.id && { leadId: insertedLeads[0].id, sectorName: "Enterprise Software" },
      insertedLeads[1]?.id && { leadId: insertedLeads[1].id, sectorName: "E-commerce" },
      insertedLeads[1]?.id && { leadId: insertedLeads[1].id, sectorName: "Retail" },
      insertedLeads[2]?.id && { leadId: insertedLeads[2].id, sectorName: "Manufacturing" },
      insertedLeads[3]?.id && { leadId: insertedLeads[3].id, sectorName: "Healthcare" },
      insertedLeads[4]?.id && { leadId: insertedLeads[4].id, sectorName: "Financial Services" },
    ].filter(isNotFalsy)
    const insertedSectors = await db.insert(leadBusinessSectors).values(sectorSeeds).returning()
    console.log(`✅ ${insertedSectors.length}개 비즈니스 섹터 생성 완료\n`)

    // 11. 리드 제품 카테고리 데이터 생성
    console.log("🏷️ 리드 제품 카테고리 데이터 생성 중...")
    const categorySeeds = [
      insertedLeads[0]?.id && { leadId: insertedLeads[0].id, categoryName: "SaaS" },
      insertedLeads[0]?.id && { leadId: insertedLeads[0].id, categoryName: "B2B Software" },
      insertedLeads[1]?.id && { leadId: insertedLeads[1].id, categoryName: "Online Marketplace" },
      insertedLeads[2]?.id && { leadId: insertedLeads[2].id, categoryName: "Industrial IoT" },
      insertedLeads[3]?.id && { leadId: insertedLeads[3].id, categoryName: "Digital Health" },
      insertedLeads[4]?.id && { leadId: insertedLeads[4].id, categoryName: "Blockchain" },
    ].filter(isNotFalsy)
    const insertedCategories = await db
      .insert(leadProductCategories)
      .values(categorySeeds)
      .returning()
    console.log(`✅ ${insertedCategories.length}개 제품 카테고리 생성 완료\n`)

    // 12. 리드 산업 유형 데이터 생성
    console.log("🏢 리드 산업 유형 데이터 생성 중...")
    const industrySeeds = [
      insertedLeads[0]?.id && {
        leadId: insertedLeads[0].id,
        industryName: "Information Technology",
      },
      insertedLeads[1]?.id && { leadId: insertedLeads[1].id, industryName: "E-commerce & Retail" },
      insertedLeads[2]?.id && {
        leadId: insertedLeads[2].id,
        industryName: "Manufacturing & Industry 4.0",
      },
      insertedLeads[3]?.id && { leadId: insertedLeads[3].id, industryName: "Healthcare & Medical" },
      insertedLeads[4]?.id && { leadId: insertedLeads[4].id, industryName: "Finance & Banking" },
    ].filter(isNotFalsy)
    const insertedIndustries = await db.insert(leadIndustryTypes).values(industrySeeds).returning()
    console.log(`✅ ${insertedIndustries.length}개 산업 유형 생성 완료\n`)

    // 13. 고객 그룹 데이터 생성
    console.log("👥 고객 그룹 데이터 생성 중...")
    const groupSeeds = [
      insertedWorkspaces[0]?.id &&
        insertedUsers[0]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          name: "VIP 고객",
          description: "매출 상위 10% 핵심 고객",
          criteria: { leadScore: { min: 80 } },
          isDynamic: true,
          createdBy: insertedUsers[0].id,
        },
      insertedWorkspaces[0]?.id &&
        insertedUsers[0]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          name: "IT 업계",
          description: "IT 및 소프트웨어 업계 리드",
          criteria: { businessType: ["IT서비스", "금융IT"] },
          isDynamic: false,
          createdBy: insertedUsers[0].id,
        },
      insertedWorkspaces[0]?.id &&
        insertedUsers[1]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          name: "미응답 고객",
          description: "3회 이상 연락 시도했으나 미응답",
          criteria: { lastContactedAt: { days: 30 } },
          isDynamic: true,
          createdBy: insertedUsers[1].id,
        },
      insertedWorkspaces[1]?.id &&
        insertedUsers[1]?.id && {
          workspaceId: insertedWorkspaces[1].id,
          name: "파트너 후보",
          description: "파트너십 제안 대상",
          criteria: { employeeCount: ["100-500", "200-500"] },
          isDynamic: false,
          createdBy: insertedUsers[1].id,
        },
      insertedWorkspaces[2]?.id &&
        insertedUsers[2]?.id && {
          workspaceId: insertedWorkspaces[2].id,
          name: "해외 진출 타겟",
          description: "글로벌 시장 진출 가능 리드",
          criteria: { leadScore: { min: 70 } },
          isDynamic: true,
          createdBy: insertedUsers[2].id,
        },
    ].filter(isNotFalsy)

    let insertedGroups: (typeof customerGroups.$inferSelect)[] = []
    if (groupSeeds.length === 0) {
      console.log("⚠️  고객 그룹 시드 데이터가 없습니다. 건너뜀")
    } else {
      insertedGroups = await db.insert(customerGroups).values(groupSeeds).returning()
      console.log(`✅ ${insertedGroups.length}개 고객 그룹 생성 완료\n`)
    }

    // 14. 고객 그룹 멤버 데이터 생성 (각 그룹당 10개 이상)
    console.log("👤 고객 그룹 멤버 데이터 생성 중...")
    const groupMemberSeeds: Omit<NewCustomerGroupMember, "id" | "addedAt">[] = []

    // 각 고객 그룹에 대해 멤버 추가
    insertedGroups.forEach((group, _groupIndex) => {
      const workspaceLeads = insertedLeads.filter((lead) => lead.workspaceId === group.workspaceId)

      if (group.name === "VIP 고객") {
        // 높은 점수를 가진 리드들 추가
        const highScoreLeads = workspaceLeads.filter((lead) => (lead.leadScore ?? 0) >= 80)
        highScoreLeads.slice(0, 12).forEach((lead) => {
          groupMemberSeeds.push({
            groupId: group.id,
            leadId: lead.id,
            addedBy: insertedUsers[Math.floor(Math.random() * insertedUsers.length)]?.id,
          })
        })
      } else if (group.name === "IT 업계") {
        // IT 관련 비즈니스 타입 리드들 추가
        const itLeads = workspaceLeads.filter(
          (lead) =>
            lead.businessType?.includes("IT") ||
            lead.businessType?.includes("테크") ||
            lead.businessType?.includes("온라인"),
        )
        itLeads.slice(0, 10).forEach((lead) => {
          groupMemberSeeds.push({
            groupId: group.id,
            leadId: lead.id,
            addedBy: insertedUsers[Math.floor(Math.random() * insertedUsers.length)]?.id,
          })
        })
      } else if (group.name === "미응답 고객") {
        // 'new' 또는 'contacted' 상태의 리드들 추가
        const unresponsiveLeads = workspaceLeads.filter(
          (lead) => lead.leadStatus === "new" || lead.leadStatus === "contacted",
        )
        unresponsiveLeads.slice(0, 11).forEach((lead) => {
          groupMemberSeeds.push({
            groupId: group.id,
            leadId: lead.id,
            addedBy: insertedUsers[Math.floor(Math.random() * insertedUsers.length)]?.id,
          })
        })
      } else if (group.name === "파트너 후보") {
        // 중간 규모 직원수를 가진 리드들 추가
        const partnerLeads = workspaceLeads.filter(
          (lead) =>
            lead.employeeCount?.includes("100") ||
            lead.employeeCount?.includes("500") ||
            lead.employeeCount?.includes("1000"),
        )
        partnerLeads.slice(0, 10).forEach((lead) => {
          groupMemberSeeds.push({
            groupId: group.id,
            leadId: lead.id,
            addedBy: insertedUsers[Math.floor(Math.random() * insertedUsers.length)]?.id,
          })
        })
      } else if (group.name === "해외 진출 타겟") {
        // 해외 국가의 리드들 추가
        const globalLeads = workspaceLeads.filter((lead) => lead.country && lead.country !== "한국")
        globalLeads.slice(0, 13).forEach((lead) => {
          groupMemberSeeds.push({
            groupId: group.id,
            leadId: lead.id,
            addedBy: insertedUsers[Math.floor(Math.random() * insertedUsers.length)]?.id,
          })
        })
      }
    })

    // 중복 제거
    const uniqueGroupMembers = Array.from(
      new Map(groupMemberSeeds.map((item) => [`${item.groupId}-${item.leadId}`, item])).values(),
    )

    const insertedGroupMembers = await db
      .insert(customerGroupMembers)
      .values(uniqueGroupMembers)
      .returning()
    console.log(`✅ ${insertedGroupMembers.length}개 그룹 멤버 생성 완료\n`)

    // 15. 이메일 템플릿 데이터 생성
    console.log("✉️ 이메일 템플릿 데이터 생성 중...")
    const templateSeeds = [
      insertedWorkspaces[0]?.id &&
        insertedUsers[0]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          name: "첫 연락 템플릿",
          description: "신규 리드에게 보내는 첫 소개 이메일",
          subject: "안녕하세요, {{회사명}}님! 그린다AI 소개드립니다",
          bodyText:
            "{{회사명}} 담당자님께,\n\n그린다AI의 AI 기반 영업 자동화 솔루션을 소개드립니다...",
          bodyHtml:
            "<p>{{회사명}} 담당자님께,</p><p>그린다AI의 AI 기반 영업 자동화 솔루션을 소개드립니다...</p>",
          variables: { 회사명: "string", 담당자명: "string" },
          category: "outreach",
          isShared: true,
          createdBy: insertedUsers[0].id,
        },
      insertedWorkspaces[0]?.id &&
        insertedUsers[0]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          name: "팔로우업 템플릿",
          description: "첫 이메일 후 후속 연락용",
          subject: "{{회사명}}님, 제안서를 공유드립니다",
          bodyText:
            "안녕하세요,\n\n지난번 연락 드린 {{담당자명}}입니다. 제안서를 첨부해 드립니다...",
          bodyHtml:
            "<p>안녕하세요,</p><p>지난번 연락 드린 {{담당자명}}입니다. 제안서를 첨부해 드립니다...</p>",
          variables: { 회사명: "string", 담당자명: "string" },
          category: "follow_up",
          isShared: true,
          createdBy: insertedUsers[0].id,
        },
      insertedWorkspaces[0]?.id &&
        insertedUsers[1]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          name: "미팅 요청 템플릿",
          description: "데모 미팅 요청용 이메일",
          subject: "{{회사명}}님과의 미팅을 제안드립니다",
          bodyText: "{{담당자명}}님,\n\n귀사의 비즈니스 성장을 위한 미팅을 제안드립니다...",
          bodyHtml:
            "<p>{{담당자명}}님,</p><p>귀사의 비즈니스 성장을 위한 미팅을 제안드립니다...</p>",
          variables: { 회사명: "string", 담당자명: "string" },
          category: "meeting",
          isShared: false,
          createdBy: insertedUsers[1].id,
        },
      insertedWorkspaces[0]?.id &&
        insertedUsers[0]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          name: "감사 인사 템플릿",
          description: "미팅 후 감사 이메일",
          subject: "{{회사명}}님, 귀한 시간 내주셔서 감사합니다",
          bodyText: "{{담당자명}}님,\n\n오늘 미팅 시간 내주셔서 감사드립니다...",
          bodyHtml: "<p>{{담당자명}}님,</p><p>오늘 미팅 시간 내주셔서 감사드립니다...</p>",
          variables: { 회사명: "string", 담당자명: "string" },
          category: "thank_you",
          isShared: true,
          createdBy: insertedUsers[0].id,
        },
      insertedWorkspaces[0]?.id &&
        insertedUsers[0]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          name: "계약 제안 템플릿",
          description: "최종 계약 제안서 발송용",
          subject: "{{company_name}}님께 특별 제안을 드립니다",
          bodyText:
            "{{contact_name}}님,\n\n{{company_name}}를 위한 맞춤 계약 제안서를 준비했습니다...",
          bodyHtml:
            "<p>{{contact_name}}님,</p><p>{{company_name}}를 위한 맞춤 계약 제안서를 준비했습니다...</p>",
          variables: { company_name: "string", contact_name: "string", discount: "number" },
          category: "proposal",
          isShared: true,
          createdBy: insertedUsers[0].id,
        },
    ].filter(isNotFalsy)
    const insertedTemplates = await db.insert(emailTemplates).values(templateSeeds).returning()
    console.log(`✅ ${insertedTemplates.length}개 이메일 템플릿 생성 완료\n`)

    // 16. 시퀀스 데이터 생성
    console.log("📊 시퀀스 데이터 생성 중...")
    const sequenceSeeds = [
      insertedWorkspaces[0]?.id &&
        insertedGroups[0]?.id &&
        insertedUsers[0]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          customerGroupId: insertedGroups[0].id,
          name: "신규 리드 육성 시퀀스",
          description: "신규 리드를 고객으로 전환하기 위한 7일 시퀀스",
          status: "active" as const,
          createdBy: insertedUsers[0].id,
        },
      insertedWorkspaces[0]?.id &&
        insertedGroups[1]?.id &&
        insertedUsers[1]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          customerGroupId: insertedGroups[1].id,
          name: "데모 후 팔로우업",
          description: "제품 데모 후 후속 조치를 위한 시퀀스",
          status: "active" as const,
          createdBy: insertedUsers[1].id,
        },
      insertedWorkspaces[0]?.id &&
        insertedGroups[0]?.id &&
        insertedUsers[0]?.id && {
          workspaceId: insertedWorkspaces[0].id,
          customerGroupId: insertedGroups[0].id,
          name: "재참여 캠페인",
          description: "90일 이상 미응답 리드 재활성화",
          status: "paused" as const,
          createdBy: insertedUsers[0].id,
        },
      insertedWorkspaces[1]?.id &&
        insertedGroups[2]?.id &&
        insertedUsers[1]?.id && {
          workspaceId: insertedWorkspaces[1].id,
          customerGroupId: insertedGroups[2].id,
          name: "파트너십 제안 시퀀스",
          description: "파트너사 제안을 위한 단계별 접근",
          status: "active" as const,
          createdBy: insertedUsers[1].id,
        },
      insertedWorkspaces[2]?.id &&
        insertedGroups[3]?.id &&
        insertedUsers[2]?.id && {
          workspaceId: insertedWorkspaces[2].id,
          customerGroupId: insertedGroups[3].id,
          name: "글로벌 아웃리치",
          description: "해외 시장 진출을 위한 영문 시퀀스",
          status: "draft" as const,
          createdBy: insertedUsers[2].id,
        },
    ].filter(isNotFalsy)
    const insertedSequences = await db.insert(sequences).values(sequenceSeeds).returning()
    console.log(`✅ ${insertedSequences.length}개 시퀀스 생성 완료\n`)

    // 17. 시퀀스 스텝 데이터 생성
    console.log("📝 시퀀스 스텝 데이터 생성 중...")
    const stepSeeds = [
      insertedSequences[0]?.id &&
        insertedTemplates[0]?.id && {
          sequenceId: insertedSequences[0].id,
          stepOrder: 1,
          delayDays: 0,
          emailSubject: "안녕하세요, {{company_name}}님!",
          emailBodyText: "첫 인사드립니다...",
          emailBodyHtml: "<p>첫 인사드립니다...</p>",
          emailTemplateId: insertedTemplates[0].id,
        },
      insertedSequences[0]?.id &&
        insertedTemplates[1]?.id && {
          sequenceId: insertedSequences[0].id,
          stepOrder: 2,
          delayDays: 3,
          emailSubject: "{{company_name}}님께 도움이 될만한 자료입니다",
          emailBodyText: "안녕하세요, 다시 연락드립니다...",
          emailBodyHtml: "<p>안녕하세요, 다시 연락드립니다...</p>",
          emailTemplateId: insertedTemplates[1].id,
        },
      insertedSequences[0]?.id &&
        insertedTemplates[2]?.id && {
          sequenceId: insertedSequences[0].id,
          stepOrder: 3,
          delayDays: 7,
          emailSubject: "{{company_name}}님, 미팅 가능하신가요?",
          emailBodyText: "미팅을 제안드립니다...",
          emailBodyHtml: "<p>미팅을 제안드립니다...</p>",
          emailTemplateId: insertedTemplates[2].id,
        },
      insertedSequences[1]?.id &&
        insertedTemplates[3]?.id && {
          sequenceId: insertedSequences[1].id,
          stepOrder: 1,
          delayDays: 1,
          emailSubject: "데모 참여해주셔서 감사합니다",
          emailBodyText: "감사 인사드립니다...",
          emailBodyHtml: "<p>감사 인사드립니다...</p>",
          emailTemplateId: insertedTemplates[3].id,
        },
      insertedSequences[1]?.id &&
        insertedTemplates[4]?.id && {
          sequenceId: insertedSequences[1].id,
          stepOrder: 2,
          delayDays: 5,
          emailSubject: "특별 제안을 드립니다",
          emailBodyText: "맞춤 제안서를 준비했습니다...",
          emailBodyHtml: "<p>맞춤 제안서를 준비했습니다...</p>",
          emailTemplateId: insertedTemplates[4].id,
        },
    ].filter(isNotFalsy)
    const insertedSteps = await db.insert(sequenceSteps).values(stepSeeds).returning()
    console.log(`✅ ${insertedSteps.length}개 시퀀스 스텝 생성 완료\n`)

    console.log("✨ 모든 시드 데이터 생성 완료!\n")
    console.log("📊 생성된 데이터 요약:")
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
    console.error("❌ 시드 데이터 생성 실패:", error)
    throw error
  }
}

// 스크립트로 직접 실행될 때만 실행 (bun src/db/seed.ts)
if (import.meta.main) {
  seed()
    .then(() => {
      console.log("시드 스크립트 완료")
      process.exit(0)
    })
    .catch((error) => {
      console.error("시드 스크립트 실패:", error)
      process.exit(1)
    })
}
