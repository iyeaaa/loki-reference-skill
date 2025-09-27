import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export interface EmailThreadData {
  threadId?: string
  messageId: string
  inReplyTo?: string
  references?: string[]
  fromEmail: string
  toEmail: string
  subject: string
  content: string
  direction: "inbound" | "outbound"
  aiGenerated?: boolean
}

export class EmailSequenceTracker {
  /**
   * 이메일 스레드 찾기 또는 생성
   */
  async findOrCreateThread(data: EmailThreadData) {
    // 1. In-Reply-To로 기존 스레드 찾기
    if (data.inReplyTo) {
      const existingSequence = await prisma.emailSequence.findFirst({
        where: { messageId: data.inReplyTo },
        include: { thread: true },
      })

      if (existingSequence) {
        return existingSequence.thread
      }
    }

    // 2. References로 기존 스레드 찾기
    if (data.references && data.references.length > 0) {
      const existingSequence = await prisma.emailSequence.findFirst({
        where: {
          messageId: { in: data.references },
        },
        include: { thread: true },
        orderBy: { sequenceNumber: "desc" },
      })

      if (existingSequence) {
        return existingSequence.thread
      }
    }

    // 3. 제목으로 스레드 찾기 (Re: 제거)
    const cleanSubject = this.cleanSubject(data.subject)
    const existingThread = await prisma.emailThread.findFirst({
      where: {
        buyerEmail: data.direction === "inbound" ? data.fromEmail : data.toEmail,
        subject: cleanSubject,
        status: "active",
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7일 이내
        },
      },
    })

    if (existingThread) {
      return existingThread
    }

    // 4. 새 스레드 생성
    return await prisma.emailThread.create({
      data: {
        initialMessageId: data.messageId,
        buyerEmail: data.direction === "inbound" ? data.fromEmail : data.toEmail,
        subject: cleanSubject,
        status: "active",
      },
    })
  }

  /**
   * 시퀀스에 이메일 추가
   */
  async addToSequence(data: EmailThreadData) {
    // 스레드 찾기 또는 생성
    const thread = await this.findOrCreateThread(data)

    // 현재 스레드의 마지막 시퀀스 번호 가져오기
    const lastSequence = await prisma.emailSequence.findFirst({
      where: { threadId: thread.id },
      orderBy: { sequenceNumber: "desc" },
    })

    const sequenceNumber = lastSequence ? lastSequence.sequenceNumber + 1 : 1

    // 시퀀스 추가
    const sequence = await prisma.emailSequence.create({
      data: {
        threadId: thread.id,
        messageId: data.messageId,
        inReplyTo: data.inReplyTo,
        references: data.references || [],
        sequenceNumber,
        direction: data.direction,
        fromEmail: data.fromEmail,
        toEmail: data.toEmail,
        subject: data.subject,
        content: data.content,
        aiGenerated: data.aiGenerated || false,
        sentAt: new Date(),
      },
    })

    // 스레드 업데이트 시간 갱신
    await prisma.emailThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    })

    return { thread, sequence }
  }

  /**
   * 스레드 히스토리 조회
   */
  async getThreadHistory(threadId: string) {
    return await prisma.emailSequence.findMany({
      where: { threadId },
      orderBy: { sequenceNumber: "asc" },
    })
  }

  /**
   * 바이어별 스레드 목록 조회
   */
  async getBuyerThreads(buyerEmail: string) {
    return await prisma.emailThread.findMany({
      where: { buyerEmail },
      include: {
        sequences: {
          orderBy: { sequenceNumber: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    })
  }

  /**
   * 제목 정리 (Re:, Fwd: 등 제거)
   */
  private cleanSubject(subject: string): string {
    return subject.replace(/^(Re:\s*|Fwd:\s*|Fw:\s*)+/gi, "").trim()
  }

  /**
   * 스레드 상태 변경
   */
  async updateThreadStatus(threadId: string, status: "active" | "closed") {
    return await prisma.emailThread.update({
      where: { id: threadId },
      data: { status },
    })
  }

  /**
   * AI 응답 컨텍스트 구성
   */
  async buildAIContext(threadId: string) {
    const history = await this.getThreadHistory(threadId)

    return {
      thread: await prisma.emailThread.findUnique({
        where: { id: threadId },
      }),
      history: history.map((seq) => ({
        sequenceNumber: seq.sequenceNumber,
        direction: seq.direction,
        from: seq.fromEmail,
        to: seq.toEmail,
        subject: seq.subject,
        content: seq.content,
        sentAt: seq.sentAt,
        aiGenerated: seq.aiGenerated,
      })),
      totalExchanges: Math.floor(history.length / 2),
      lastInteraction: history[history.length - 1]?.sentAt,
    }
  }
}

export const emailSequenceTracker = new EmailSequenceTracker()
