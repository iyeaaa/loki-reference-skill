/**
 * Buyer Search 테스트 스크립트
 *
 * 실행: bun run src/scripts/test-buyer-search.ts
 */

import type { BuyerSearchInput } from "../services/buyer-search"
import { searchBuyers } from "../services/buyer-search"

async function main() {
  console.log("🚀 Buyer Search 테스트 시작 (Multi-Provider: Perplexity + Apollo + Serper)\n")

  const startTime = Date.now()

  const input: BuyerSearchInput = {
    companyName: "알프레도펫",
    companyDescription: `커피 찌꺼기를 활용한 고양이 모래 전문 기업
차별화 포인트: 커피 찌꺼기 80% 사용으로 우수한 탈취력과 30% 더 긴 교체주기 제공
보유 인증: ISO 9001, 환경표지 인증 및 반려동물 알레르기 안전 테스트 통과`,
    industry: "manufacturing_parts",
    target: "b2b",
    country: ["europe"],
    locale: "ko",
    companySize: "small", // 소기업 (10-50명)
  }

  const result = await searchBuyers(input, (event) => {
    const bar =
      "█".repeat(Math.floor(event.progress / 5)) + "░".repeat(20 - Math.floor(event.progress / 5))
    console.log(`[${event.phase.padEnd(16)}] ${bar} ${event.progress}% - ${event.message}`)
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`\n${"=".repeat(80)}`)
  console.log("📊 Buyer Search 테스트 결과")
  console.log("=".repeat(80))

  console.log(`\n⏱️  총 소요 시간: ${elapsed}초`)
  console.log(`\n📈 메타데이터:`)
  console.log(`   - 전체 검색: ${result.metadata.totalSearched}개`)
  console.log(`   - 이메일 확보: ${result.metadata.totalWithEmail}개`)
  console.log(`   - 검색 시간: ${result.metadata.searchTimeSeconds}초`)
  console.log(`   - 사용 소스: ${result.metadata.sources.join(", ")}`)

  console.log(`\n✅ 최종 바이어: ${result.buyers.length}개`)
  console.log("-".repeat(80))

  for (let i = 0; i < result.buyers.length; i++) {
    const buyer = result.buyers[i]
    if (!buyer) continue

    console.log(`\n${i + 1}. ${buyer.companyName}`)
    console.log(`   🌐 ${buyer.website}`)
    console.log(`   🏭 Industry: ${buyer.industry}`)
    console.log(`   📍 Country: ${buyer.country}`)
    if (buyer.size) {
      const sizeLabels: Record<string, string> = {
        startup: "스타트업 (1-10명)",
        small: "소기업 (10-50명)",
        medium: "중기업 (50-250명)",
        large: "대기업 (250-1000명)",
        enterprise: "글로벌 대기업 (1000명+)",
      }
      console.log(`   📏 규모: ${sizeLabels[buyer.size] || buyer.size}`)
    }
    console.log(`   📧 ${buyer.email}`)
    console.log(`   📝 ${buyer.description}`)
  }

  console.log(`\n${"=".repeat(80)}`)
  console.log("✅ 테스트 완료!")
  process.exit(0)
}

main().catch(console.error)
