/**
 * Workflow Execution Worker
 *
 * 워크플로우 실행 워커 - 스케줄된 워크플로우 노드 실행
 * sequence_steps 기반 워커와 별개로 동작
 */

import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { workflowEnrollments, workflowExecutionLogs } from "../db/schema/workflow-executions"
import * as workflowExecutionService from "../services/workflow-execution.service"
import logger from "../utils/logger"

async function processWorkflowExecutions() {
  try {
    // 스케줄된 실행 항목 조회
    const pendingExecutions = await workflowExecutionService.getPendingWorkflowExecutions(50)

    if (pendingExecutions.length === 0) {
      logger.trace("No pending workflows to execute")
      return
    }

    logger.info({ count: pendingExecutions.length }, "Processing pending workflows")

    // 각 워크플로우 실행
    for (const execution of pendingExecutions) {
      try {
        logger.info(
          { enrollmentId: execution.enrollmentId, nodeId: execution.nodeId },
          "Processing enrollment",
        )

        // 타이머 노드 완료 처리
        if (execution.nodeType === "timer") {
          await db
            .update(workflowExecutionLogs)
            .set({
              status: "completed",
              waitCompletedAt: new Date(),
              completedAt: new Date(),
            })
            .where(
              and(
                eq(workflowExecutionLogs.enrollmentId, execution.enrollmentId),
                eq(workflowExecutionLogs.nodeId, execution.nodeId),
              ),
            )
        }

        // 다음 노드 실행 (예약된 노드)
        const result = await workflowExecutionService.executeWorkflow(execution.enrollmentId)

        if (result.success) {
          logger.info({ enrollmentId: execution.enrollmentId }, "Workflow executed successfully")
        } else {
          const errorMessage = "error" in result ? result.error : "Unknown error"
          logger.error(
            { enrollmentId: execution.enrollmentId, error: errorMessage },
            "Workflow execution failed",
          )

          // 실행 로그 상태 업데이트
          await db
            .update(workflowExecutionLogs)
            .set({
              status: "failed",
              errorMessage: errorMessage || "Unknown error",
              completedAt: new Date(),
            })
            .where(
              and(
                eq(workflowExecutionLogs.enrollmentId, execution.enrollmentId),
                eq(workflowExecutionLogs.nodeId, execution.nodeId),
              ),
            )
        }
      } catch (error) {
        logger.error(
          { err: error, enrollmentId: execution.enrollmentId },
          "Error processing enrollment",
        )
      }
    }

    logger.debug("Finished processing workflows")
  } catch (error) {
    logger.error({ err: error }, "Error in processWorkflowExecutions")
  }
}

/**
 * 답장 감지 및 워크플로우 중단 처리
 * replied_emails 테이블을 모니터링하여 답장이 온 경우 워크플로우 중단
 */
async function checkRepliesAndStopWorkflows() {
  try {
    // 답장이 온 이메일에 해당하는 활성 enrollment 찾기
    const result = await db.execute<{ enrollment_id: string; lead_id: string }>(
      `
      SELECT DISTINCT we.id as enrollment_id, we.lead_id
      FROM workflow_enrollments we
      INNER JOIN emails e ON e.lead_id = we.lead_id
        AND e.sequence_id = we.sequence_id
        AND e.direction = 'outbound'
      INNER JOIN email_replies re ON re.original_email_id = e.id
      WHERE we.status = 'active'
        AND we.stopped_at IS NULL
        AND e.sent_at >= we.enrolled_at
      `,
    )

    if (result.rows.length === 0) {
      logger.trace("No replies found")
      return
    }

    logger.info({ count: result.rows.length }, "Found enrollments with replies")

    // 답장이 온 enrollment 중단
    for (const row of result.rows) {
      try {
        await db
          .update(workflowEnrollments)
          .set({
            status: "stopped",
            stoppedAt: new Date(),
            stoppedReason: "reply_received",
          })
          .where(eq(workflowEnrollments.id, row.enrollment_id))

        // 대기 중인 실행 로그에 답장 시각 기록
        await db
          .update(workflowExecutionLogs)
          .set({
            repliedDuringWait: new Date(),
            status: "skipped",
            completedAt: new Date(),
          })
          .where(
            and(
              eq(workflowExecutionLogs.enrollmentId, row.enrollment_id),
              eq(workflowExecutionLogs.status, "pending"),
            ),
          )

        logger.info({ enrollmentId: row.enrollment_id }, "Stopped enrollment due to reply")
      } catch (error) {
        logger.error({ err: error, enrollmentId: row.enrollment_id }, "Error stopping enrollment")
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Error in checkRepliesAndStopWorkflows")
  }
}

// 워커 실행 주기: 1분마다
export function startWorkflowExecutionWorker() {
  logger.debug("✅ Workflow execution worker started")

  // 즉시 실행
  processWorkflowExecutions()
  checkRepliesAndStopWorkflows()

  // 정기 실행
  const executionInterval = setInterval(processWorkflowExecutions, 60 * 1000) // 1분
  const replyCheckInterval = setInterval(checkRepliesAndStopWorkflows, 30 * 1000) // 30초

  // 정지 함수 반환
  return () => {
    logger.info("Stopping workflow execution worker")
    clearInterval(executionInterval)
    clearInterval(replyCheckInterval)
  }
}

// 수동 테스트용 export
export { processWorkflowExecutions, checkRepliesAndStopWorkflows }
