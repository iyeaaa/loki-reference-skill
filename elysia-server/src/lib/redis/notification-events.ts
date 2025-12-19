/**
 * Real-time Notification Events via Redis PubSub
 *
 * Service → Redis PubSub → API Server → SSE → Frontend
 */

import type Redis from "ioredis"
import logger from "../../utils/logger"
import { createRedisConnection } from "./connection"

// ============================================================================
// Constants
// ============================================================================

export const NOTIFICATION_CHANNEL_PREFIX = "notifications:user:"

export function getNotificationChannel(userId: string): string {
  return `${NOTIFICATION_CHANNEL_PREFIX}${userId}`
}

// ============================================================================
// Types
// ============================================================================

export type NotificationEventType = "created" | "updated" | "deleted" | "read" | "read_all"

export interface NotificationEvent {
  type: NotificationEventType
  userId: string
  workspaceId?: string
  notification?: {
    id: string
    type: string
    title: string
    message: string
    read: boolean
    metadata?: Record<string, unknown>
    createdAt: string
  }
  /** For bulk operations like read_all or delete_all */
  count?: number
  timestamp: string
}

// ============================================================================
// Event Emitter (Service side)
// ============================================================================

let publisherConnection: Redis | null = null

function getPublisher(): Redis {
  if (!publisherConnection) {
    publisherConnection = createRedisConnection()
    publisherConnection.on("error", (err) => {
      logger.warn({ err }, "[NotificationEvents] Publisher connection error")
    })
  }
  return publisherConnection
}

/**
 * Emit notification event to user's channel
 */
export async function emitNotificationEvent(event: NotificationEvent): Promise<void> {
  try {
    const channel = getNotificationChannel(event.userId)
    const publisher = getPublisher()
    await publisher.publish(channel, JSON.stringify(event))
    logger.debug(
      { userId: event.userId, type: event.type, notificationId: event.notification?.id },
      "[NotificationEvents] Event emitted",
    )
  } catch (error) {
    logger.warn({ error, event }, "[NotificationEvents] Failed to emit event")
  }
}

// ============================================================================
// Event Subscriber (API Server side for SSE)
// ============================================================================

export interface NotificationSubscriber {
  subscribe: (callback: (event: NotificationEvent) => void) => void
  unsubscribe: () => Promise<void>
}

/**
 * Create a subscriber for notification events
 * Used by SSE endpoint to stream events to frontend
 */
export function createNotificationSubscriber(userId: string): NotificationSubscriber {
  const subscriberConnection = createRedisConnection()
  const channel = getNotificationChannel(userId)
  let messageCallback: ((event: NotificationEvent) => void) | null = null

  subscriberConnection.on("error", (err) => {
    logger.warn({ err, userId }, "[NotificationEvents] Subscriber connection error")
  })

  return {
    subscribe: (callback: (event: NotificationEvent) => void) => {
      messageCallback = callback

      subscriberConnection.subscribe(channel, (err) => {
        if (err) {
          logger.error({ err, userId }, "[NotificationEvents] Failed to subscribe")
        } else {
          logger.info({ userId, channel }, "[NotificationEvents] Subscribed to channel")
        }
      })

      subscriberConnection.on("message", (receivedChannel, message) => {
        if (receivedChannel === channel && messageCallback) {
          try {
            const event = JSON.parse(message) as NotificationEvent
            messageCallback(event)
          } catch (error) {
            logger.warn({ error, message }, "[NotificationEvents] Failed to parse event")
          }
        }
      })
    },

    unsubscribe: async () => {
      messageCallback = null
      try {
        await subscriberConnection.unsubscribe(channel)
        await subscriberConnection.quit()
        logger.info({ userId, channel }, "[NotificationEvents] Unsubscribed from channel")
      } catch (error) {
        logger.warn({ error, userId }, "[NotificationEvents] Failed to unsubscribe")
      }
    },
  }
}

// ============================================================================
// Helper Functions for Creating Events
// ============================================================================

export function createNotificationCreatedEvent(
  userId: string,
  workspaceId: string | undefined,
  notification: NotificationEvent["notification"],
): NotificationEvent {
  return {
    type: "created",
    userId,
    workspaceId,
    notification,
    timestamp: new Date().toISOString(),
  }
}

export function createNotificationUpdatedEvent(
  userId: string,
  workspaceId: string | undefined,
  notification: NotificationEvent["notification"],
): NotificationEvent {
  return {
    type: "updated",
    userId,
    workspaceId,
    notification,
    timestamp: new Date().toISOString(),
  }
}

export function createNotificationReadEvent(
  userId: string,
  notificationId: string,
): NotificationEvent {
  return {
    type: "read",
    userId,
    notification: {
      id: notificationId,
      type: "",
      title: "",
      message: "",
      read: true,
      createdAt: "",
    },
    timestamp: new Date().toISOString(),
  }
}

export function createNotificationReadAllEvent(userId: string, count: number): NotificationEvent {
  return {
    type: "read_all",
    userId,
    count,
    timestamp: new Date().toISOString(),
  }
}

export function createNotificationDeletedEvent(
  userId: string,
  notificationId: string,
): NotificationEvent {
  return {
    type: "deleted",
    userId,
    notification: {
      id: notificationId,
      type: "",
      title: "",
      message: "",
      read: false,
      createdAt: "",
    },
    timestamp: new Date().toISOString(),
  }
}

// ============================================================================
// Cleanup
// ============================================================================

export async function closeNotificationPublisher(): Promise<void> {
  if (publisherConnection) {
    await publisherConnection.quit()
    publisherConnection = null
    logger.info("[NotificationEvents] Publisher connection closed")
  }
}
