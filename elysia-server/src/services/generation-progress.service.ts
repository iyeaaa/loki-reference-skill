/**
 * 이메일 생성 진행률 추적 서비스
 * 메모리 기반 (간단한 구현)
 */

interface GenerationProgress {
  sequenceId: string
  nodeId: string
  total: number
  generated: number
  failed: number
  status: "generating" | "completed" | "failed"
  startedAt: Date
  completedAt?: Date
  errors?: Array<{ leadId: string; error: string }>
}

// 메모리 저장소 (프로덕션에서는 Redis 사용 권장)
const progressStore = new Map<string, GenerationProgress>()

// 진행률 키 생성
function getProgressKey(sequenceId: string, nodeId: string): string {
  return `${sequenceId}:${nodeId}`
}

// 진행률 초기화
export function initProgress(sequenceId: string, nodeId: string, total: number): string {
  const key = getProgressKey(sequenceId, nodeId)

  progressStore.set(key, {
    sequenceId,
    nodeId,
    total,
    generated: 0,
    failed: 0,
    status: "generating",
    startedAt: new Date(),
  })

  return key
}

// 진행률 업데이트
export function updateProgress(
  sequenceId: string,
  nodeId: string,
  increment: { generated?: number; failed?: number },
) {
  const key = getProgressKey(sequenceId, nodeId)
  const progress = progressStore.get(key)

  if (!progress) return

  if (increment.generated) {
    progress.generated += increment.generated
  }
  if (increment.failed) {
    progress.failed += increment.failed
  }

  progressStore.set(key, progress)
}

// 에러 추가
export function addError(sequenceId: string, nodeId: string, leadId: string, error: string) {
  const key = getProgressKey(sequenceId, nodeId)
  const progress = progressStore.get(key)

  if (!progress) return

  if (!progress.errors) {
    progress.errors = []
  }

  progress.errors.push({ leadId, error })
  progressStore.set(key, progress)
}

// 진행률 완료 처리
export function completeProgress(
  sequenceId: string,
  nodeId: string,
  status: "completed" | "failed",
) {
  const key = getProgressKey(sequenceId, nodeId)
  const progress = progressStore.get(key)

  if (!progress) return

  progress.status = status
  progress.completedAt = new Date()
  progressStore.set(key, progress)

  // 5분 후 자동 삭제
  setTimeout(
    () => {
      progressStore.delete(key)
    },
    5 * 60 * 1000,
  )
}

// 진행률 조회
export function getProgress(sequenceId: string, nodeId: string): GenerationProgress | null {
  const key = getProgressKey(sequenceId, nodeId)
  return progressStore.get(key) || null
}

// 진행률 삭제
export function deleteProgress(sequenceId: string, nodeId: string) {
  const key = getProgressKey(sequenceId, nodeId)
  progressStore.delete(key)
}

// 진행률 퍼센트 계산
export function getProgressPercentage(progress: GenerationProgress): number {
  if (progress.total === 0) return 0
  return Math.round(((progress.generated + progress.failed) / progress.total) * 100)
}
