import { db } from './index'
import { departments } from './schema/users'

// 그린다에이아이 주식회사 부서 시드 데이터
const departmentSeeds = [
  {
    name: '커뮤니케이션팀',
    code: 'COMM',
    description: '그린다에이아이 커뮤니케이션팀',
    isActive: true
  },
  {
    name: '프로덕트팀',
    code: 'PROD',
    description: '그린다에이아이 프로덕트팀',
    isActive: true
  },
  {
    name: 'SDR팀',
    code: 'SDR',
    description: '그린다에이아이 SDR팀',
    isActive: true
  },
  {
    name: '경영지원팀',
    code: 'MGMT',
    description: '그린다에이아이 경영지원팀',
    isActive: true
  }
]

async function seed() {
  console.log('🌱 부서 시드 데이터 생성 시작...')

  try {
    // 기존 부서 데이터 삭제
    console.log('기존 부서 데이터 삭제 중...')
    await db.delete(departments)

    // 부서 데이터 삽입
    console.log('부서 데이터 생성 중...')
    const insertedDepartments = await db
      .insert(departments)
      .values(departmentSeeds)
      .returning()

    console.log(`✅ ${insertedDepartments.length}개 부서 생성 완료`)

    // 결과 확인
    console.log('\n📊 생성된 부서:')
    insertedDepartments.forEach(dept => {
      console.log(`  - ${dept.name} (${dept.code})`)
    })

    console.log('\n✨ 부서 시드 데이터 생성 완료!')

  } catch (error) {
    console.error('❌ 부서 시드 데이터 생성 실패:', error)
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