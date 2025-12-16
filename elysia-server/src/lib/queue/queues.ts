import { Queue } from "bullmq"
import { redisConnection } from "../redis/connection"
import {
  type CampaignEmailJob,
  type MetricsSyncJob,
  QUEUE_NAMES,
  type ScheduledEmailJob,
  type TestJob,
  type WorkflowStepJob,
} from "./types"

/**
 * Default job options for all queues
 */
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 60000, // 1 minute base delay
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 1000, // Keep max 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
  },
}

/**
 * Campaign Email Queue
 * Handles scheduled campaign email sending with lead targeting
 */
export const campaignEmailQueue = new Queue<CampaignEmailJob>(QUEUE_NAMES.CAMPAIGN_EMAIL, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
  },
})

/**
 * Scheduled Email Queue
 * Handles one-off scheduled emails
 */
export const scheduledEmailQueue = new Queue<ScheduledEmailJob>(QUEUE_NAMES.SCHEDULED_EMAIL, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
  },
})

/**
 * Workflow Step Queue
 * Handles workflow automation step execution
 */
export const workflowStepQueue = new Queue<WorkflowStepJob>(QUEUE_NAMES.WORKFLOW_STEP, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
  },
})

/**
 * Metrics Sync Queue
 * Handles periodic Redis to PostgreSQL sync
 */
export const metricsSyncQueue = new Queue<MetricsSyncJob>(QUEUE_NAMES.METRICS_SYNC, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
    removeOnComplete: true,
  },
})

/**
 * Test Queue
 * For testing BullMQ functionality
 */
export const testQueue = new Queue<TestJob>(QUEUE_NAMES.TEST_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 100,
    },
    removeOnFail: {
      age: 3600, // 1 hour
    },
  },
})

/**
 * Get all queues for monitoring
 */
export function getAllQueues() {
  return {
    [QUEUE_NAMES.CAMPAIGN_EMAIL]: campaignEmailQueue,
    [QUEUE_NAMES.SCHEDULED_EMAIL]: scheduledEmailQueue,
    [QUEUE_NAMES.WORKFLOW_STEP]: workflowStepQueue,
    [QUEUE_NAMES.METRICS_SYNC]: metricsSyncQueue,
    [QUEUE_NAMES.TEST_QUEUE]: testQueue,
  }
}

/**
 * Close all queue connections gracefully
 */
export async function closeAllQueues(): Promise<void> {
  await Promise.all([
    campaignEmailQueue.close(),
    scheduledEmailQueue.close(),
    workflowStepQueue.close(),
    metricsSyncQueue.close(),
    testQueue.close(),
  ])
}
