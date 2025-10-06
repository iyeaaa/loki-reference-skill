# Gmail 스타일 답장/전달 기능 완전 구현 가이드

## 📋 개요

`ThreadDetailPanel` 컴포넌트에 Gmail과 동일한 수준의 이메일 답장(Reply) 및 전달(Forward) 기능을 구현합니다. 이 문서는 UI/UX부터 백엔드까지 모든 기술적 세부사항을 포함합니다.

## 🎯 목표

- Gmail 스타일 인라인 작성 UI (확장/축소/전체화면)
- Rich text editor with formatting toolbar
- 스레드 연결 유지 (RFC 5322/2822 준수)
- Draft 자동 저장
- 첨부파일 지원
- Undo send 기능
- 예약 발송

## 📦 현재 구조 분석

### 관련 파일들

- `admin/src/pages/email-replies/ThreadDetailPanel.tsx` - 스레드 상세 패널
- `admin/src/pages/email-replies/EmailRepliesPage.tsx` - 메인 페이지
- `admin/src/lib/api/services/emails.ts` - 이메일 API 서비스
- `admin/src/lib/api/types/email.ts` - 타입 정의

### 기존 API 지원 사항

```typescript
interface SendEmailRequest {
  toEmail: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  ccEmails?: string[]
  bccEmails?: string[]
  fromName?: string
  inReplyTo?: string        // 답장 시 원본 Message-ID
  references?: string[]     // 스레드 참조 체인
  replyTo?: string          // Reply-To 헤더
  scheduledAt?: string      // 예약 발송
  workspaceId: string
  userId: string
}
```

---

## 🏗️ 1. Gmail 스타일 UI 구현

### 1.1 인라인 작성 UI (Inline Compose)

Gmail의 핵심 UX는 **스레드 하단에 인라인으로 작성 영역이 나타나는 것**입니다.

**파일**: `admin/src/pages/email-replies/ThreadDetailPanel.tsx`

```tsx
// 상태 추가
const [composeMode, setComposeMode] = useState<'reply' | 'forward' | null>(null)
const [composeExpanded, setComposeExpanded] = useState(false) // 최소화/확장
const [composeFullscreen, setComposeFullscreen] = useState(false) // 전체화면

// 스레드 하단에 작성 영역 렌더링
<ScrollArea className="flex-1 px-4 pb-4">
  <div className="space-y-8">
    {/* 기존 이메일 목록 */}
    {emails.map((email, index) => (
      <EmailItem key={email.id} email={email} />
    ))}

    {/* 인라인 작성 영역 */}
    {composeMode && (
      <InlineComposeBox
        mode={composeMode}
        originalEmail={emails[emails.length - 1]}
        expanded={composeExpanded}
        fullscreen={composeFullscreen}
        onExpand={() => setComposeExpanded(!composeExpanded)}
        onFullscreen={() => setComposeFullscreen(!composeFullscreen)}
        onClose={() => {
          setComposeMode(null)
          setComposeExpanded(false)
          setComposeFullscreen(false)
        }}
      />
    )}
  </div>
</ScrollArea>

// 하단에 답장 버튼 (Gmail처럼)
<div className="px-4 py-3 border-t flex gap-2">
  <Button onClick={() => setComposeMode('reply')}>
    <Reply className="h-4 w-4 mr-2" />
    답장
  </Button>
  <Button variant="outline" onClick={() => setComposeMode('forward')}>
    <Forward className="h-4 w-4 mr-2" />
    전달
  </Button>
</div>
```

### 1.2 InlineComposeBox 컴포넌트

**파일**: `admin/src/pages/email-replies/InlineComposeBox.tsx`

```tsx
import { useState, useEffect } from 'react'
import { Minimize2, Maximize2, X, Paperclip, Clock, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RichTextEditor } from '@/components/RichTextEditor'
import { useDraftAutoSave } from '@/lib/hooks/useDraftAutoSave'

interface InlineComposeBoxProps {
  mode: 'reply' | 'forward'
  originalEmail: ThreadEmail
  expanded: boolean
  fullscreen: boolean
  onExpand: () => void
  onFullscreen: () => void
  onClose: () => void
}

export function InlineComposeBox({
  mode,
  originalEmail,
  expanded,
  fullscreen,
  onExpand,
  onFullscreen,
  onClose
}: InlineComposeBoxProps) {
  const [to, setTo] = useState(() => getDefaultRecipient(mode, originalEmail))
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState(() => getDefaultSubject(mode, originalEmail))
  const [body, setBody] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)

  // Draft 자동 저장 (3초 debounce)
  const { saveDraft, isSaving } = useDraftAutoSave({
    to, cc, bcc, subject, body,
    threadId: originalEmail.threadId,
    delay: 3000
  })

  return (
    <Card
      className={`
        ${fullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}
        ${expanded ? 'min-h-[500px]' : 'min-h-[200px]'}
        transition-all duration-200
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="text-sm font-medium">
          {mode === 'reply' ? '답장' : '전달'}
          {isSaving && <span className="ml-2 text-xs text-gray-500">저장 중...</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onExpand}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onFullscreen}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Recipients */}
      <div className="px-4 py-2 space-y-2 border-b">
        <RecipientInput
          label="받는사람"
          value={to}
          onChange={setTo}
          showCcBcc={!showCc || !showBcc}
          onShowCc={() => setShowCc(true)}
          onShowBcc={() => setShowBcc(true)}
        />
        {showCc && (
          <RecipientInput label="참조" value={cc} onChange={setCc} />
        )}
        {showBcc && (
          <RecipientInput label="숨은참조" value={bcc} onChange={setBcc} />
        )}
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="제목"
          className="w-full px-2 py-1 text-sm border-0 focus:outline-none"
        />
      </div>

      {/* Rich Text Editor */}
      <div className={`px-4 ${expanded ? 'min-h-[350px]' : 'min-h-[150px]'}`}>
        <RichTextEditor
          value={body}
          onChange={setBody}
          placeholder="메시지를 입력하세요..."
          initialQuotedText={mode === 'reply' ? generateQuotedText(originalEmail) : undefined}
        />
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handleSend} disabled={!to || !subject}>
            전송
          </Button>
          <Button variant="ghost" size="sm">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Clock className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
```

---

## 🎨 2. Rich Text Editor 구현

### 2.1 Editor 선택

| Editor | 장점 | 단점 | 추천도 |
|--------|------|------|--------|
| **Tiptap** | 현대적, React 친화적, 확장 가능 | 번들 크기 | ⭐⭐⭐⭐⭐ |
| **Lexical** | Meta 제작, 강력한 성능 | 학습 곡선 | ⭐⭐⭐⭐ |
| **Quill** | 안정적, 간단 | 오래됨, 확장성 낮음 | ⭐⭐⭐ |
| **ProseMirror** | 최강 커스터마이징 | 복잡함 | ⭐⭐⭐⭐ |

**추천: Tiptap (ProseMirror 기반, React 최적화)**

### 2.2 Tiptap 설치 및 설정

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-color @tiptap/extension-text-style
```

**파일**: `admin/src/components/RichTextEditor.tsx`

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  initialQuotedText?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = '메시지를 입력하세요...',
  initialQuotedText
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value || (initialQuotedText ? `<p></p>${initialQuotedText}` : ''),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="border rounded-md">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-gray-200' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-gray-200' : ''}
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'bg-gray-200' : ''}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-gray-200' : ''}
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-gray-200' : ''}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('URL을 입력하세요:')
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
          className={editor.isActive('link') ? 'bg-gray-200' : ''}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>

        {/* Font Size Dropdown */}
        <select
          className="text-sm px-2 py-1 border rounded ml-2"
          onChange={(e) => {
            const size = e.target.value
            if (size) {
              editor.chain().focus().setMark('textStyle', { fontSize: size }).run()
            }
          }}
        >
          <option value="">크기</option>
          <option value="12px">작게</option>
          <option value="14px">보통</option>
          <option value="18px">크게</option>
          <option value="24px">매우 크게</option>
        </select>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  )
}
```

---

## 📧 3. 이메일 프로토콜 및 스레딩 (RFC 5322/2822)

### 3.1 이메일 헤더 구조

```
Message-ID: <unique-id@domain.com>
In-Reply-To: <parent-message-id@domain.com>
References: <root-id@domain.com> <parent-id@domain.com>
Thread-Index: Base64 encoded thread hierarchy (Outlook)
Subject: Re: Original Subject
From: sender@domain.com
To: recipient@domain.com
Date: Mon, 07 Oct 2025 10:30:00 +0900
Content-Type: multipart/alternative; boundary="boundary-string"
```

### 3.2 Message-ID 생성 로직

**백엔드**: `server/src/utils/email-headers.ts` (신규 생성)

```typescript
import { randomBytes } from 'crypto'

/**
 * RFC 5322 준수 Message-ID 생성
 * 형식: <unique-id@domain.com>
 */
export function generateMessageId(domain: string = 'your-domain.com'): string {
  const uniqueId = randomBytes(16).toString('hex')
  const timestamp = Date.now()
  return `<${uniqueId}.${timestamp}@${domain}>`
}

/**
 * References 헤더 생성
 * 스레드의 모든 Message-ID를 포함 (최대 50개 권장)
 */
export function buildReferencesHeader(
  originalReferences: string[] | null,
  originalMessageId: string
): string[] {
  const references = originalReferences || []

  // 원본 Message-ID 추가
  if (originalMessageId && !references.includes(originalMessageId)) {
    references.push(originalMessageId)
  }

  // 최대 50개로 제한 (RFC 권장)
  if (references.length > 50) {
    // 첫 번째와 최근 25개 유지
    return [references[0], ...references.slice(-25)]
  }

  return references
}

/**
 * Thread-ID 생성 (Gmail 스타일)
 * 스레드의 첫 번째 Message-ID를 Thread-ID로 사용
 */
export function getThreadId(
  messageId: string,
  inReplyTo?: string,
  references?: string[]
): string {
  // References의 첫 번째 ID가 Thread-ID
  if (references && references.length > 0) {
    return references[0]
  }

  // In-Reply-To가 있으면 그것이 Thread-ID
  if (inReplyTo) {
    return inReplyTo
  }

  // 새 스레드면 현재 Message-ID가 Thread-ID
  return messageId
}
```

### 3.3 백엔드 이메일 전송 로직

**파일**: `server/src/services/email-sender.ts` (수정)

```typescript
import { SendEmailRequest } from '../types/email'
import { generateMessageId, buildReferencesHeader, getThreadId } from '../utils/email-headers'
import sgMail from '@sendgrid/mail'

export async function sendEmailWithHeaders(request: SendEmailRequest) {
  const messageId = generateMessageId('your-domain.com')

  let headers: Record<string, string> = {}
  let threadId: string = messageId // 기본값

  // 답장인 경우
  if (request.inReplyTo) {
    headers['In-Reply-To'] = request.inReplyTo

    // References 헤더 구성
    const references = buildReferencesHeader(request.references || [], request.inReplyTo)
    headers['References'] = references.join(' ')

    // Thread-ID 결정
    threadId = getThreadId(messageId, request.inReplyTo, references)
  }

  // SendGrid 메시지 구성
  const msg = {
    to: request.toEmail,
    from: {
      email: 'noreply@your-domain.com',
      name: request.fromName || 'Your Company'
    },
    subject: request.subject,
    text: request.bodyText,
    html: request.bodyHtml,
    cc: request.ccEmails,
    bcc: request.bccEmails,
    replyTo: request.replyTo,
    headers: {
      ...headers,
      'Message-ID': messageId,
      'X-Thread-ID': threadId, // 커스텀 헤더
    },
    customArgs: {
      workspaceId: request.workspaceId,
      userId: request.userId,
      threadId: threadId,
    }
  }

  // SendGrid 전송
  const [response] = await sgMail.send(msg)

  // DB 저장
  await saveEmailToDatabase({
    ...request,
    messageId,
    threadId,
    sendgridMessageId: response.headers['x-message-id'],
    status: 'sent',
    sentAt: new Date().toISOString(),
  })

  return {
    success: true,
    messageId,
    threadId,
  }
}
```

---

## 💾 4. Draft (임시 저장) 구현

### 4.1 Auto-save Hook

**파일**: `admin/src/lib/hooks/useDraftAutoSave.ts`

```typescript
import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { debounce } from 'lodash'

interface DraftData {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  threadId?: string
}

export function useDraftAutoSave(data: DraftData, delay: number = 3000) {
  const queryClient = useQueryClient()
  const previousDataRef = useRef<string>('')

  const saveDraftMutation = useMutation({
    mutationFn: async (draft: DraftData) => {
      const response = await fetch('/api/v1/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['drafts'])
    }
  })

  // Debounced save function
  const debouncedSave = useRef(
    debounce((draft: DraftData) => {
      saveDraftMutation.mutate(draft)
    }, delay)
  ).current

  useEffect(() => {
    const currentData = JSON.stringify(data)

    // 변경사항이 있을 때만 저장
    if (currentData !== previousDataRef.current) {
      previousDataRef.current = currentData
      debouncedSave(data)
    }

    return () => {
      debouncedSave.cancel()
    }
  }, [data, debouncedSave])

  return {
    saveDraft: () => saveDraftMutation.mutate(data),
    isSaving: saveDraftMutation.isPending,
  }
}
```

### 4.2 Draft 데이터 구조

**백엔드**: `server/src/models/draft.ts`

```typescript
// Prisma Schema 추가
model EmailDraft {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  threadId    String?
  to          String
  cc          String?
  bcc         String?
  subject     String
  bodyText    String?
  bodyHtml    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([workspaceId, userId])
  @@index([threadId])
}
```

---

## 📎 5. 첨부파일 구현

### 5.1 파일 업로드 컴포넌트

**파일**: `admin/src/components/FileUpload.tsx`

```tsx
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Paperclip, X, File } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FileUploadProps {
  onFilesChange: (files: File[]) => void
  maxSize?: number // bytes
  maxFiles?: number
}

export function FileUpload({
  onFilesChange,
  maxSize = 25 * 1024 * 1024, // 25MB
  maxFiles = 10
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles)
    setFiles(newFiles)
    onFilesChange(newFiles)
  }, [files, maxFiles, onFilesChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
    multiple: true,
  })

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    onFilesChange(newFiles)
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-md p-4 text-center cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
        `}
      >
        <input {...getInputProps()} />
        <Paperclip className="h-6 w-6 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">
          {isDragActive
            ? '파일을 여기에 놓으세요'
            : '파일을 드래그하거나 클릭하여 업로드'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          최대 {maxFiles}개, 각 {maxSize / (1024 * 1024)}MB 이하
        </p>
      </div>

      {/* 첨부된 파일 목록 */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-gray-500">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### 5.2 백엔드 파일 처리

```bash
npm install multer @sendgrid/mail
```

```typescript
import multer from 'multer'
import sgMail from '@sendgrid/mail'

// Multer 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
})

// 파일 첨부 이메일 전송
router.post('/api/v1/emails/send', upload.array('attachments', 10), async (req, res) => {
  const { to, subject, body } = req.body
  const files = req.files as Express.Multer.File[]

  const attachments = files.map(file => ({
    content: file.buffer.toString('base64'),
    filename: file.originalname,
    type: file.mimetype,
    disposition: 'attachment',
  }))

  const msg = {
    to,
    from: 'noreply@your-domain.com',
    subject,
    html: body,
    attachments,
  }

  await sgMail.send(msg)
  res.json({ success: true })
})
```

---

## ⏱️ 6. Undo Send 구현

### 6.1 프론트엔드

```tsx
const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null)
const [showUndoToast, setShowUndoToast] = useState(false)

const handleSendWithUndo = async () => {
  // 즉시 전송하지 않고 5초 대기
  setShowUndoToast(true)

  const timeout = setTimeout(async () => {
    // 실제 전송
    await sendEmail.mutateAsync(emailData)
    setShowUndoToast(false)
    toast.success('이메일이 전송되었습니다')
  }, 5000)

  setUndoTimeout(timeout)
}

const handleUndo = () => {
  if (undoTimeout) {
    clearTimeout(undoTimeout)
    setUndoTimeout(null)
    setShowUndoToast(false)
    toast.info('전송이 취소되었습니다')
  }
}

// Toast 컴포넌트
{showUndoToast && (
  <Toast>
    <span>전송 중... (5초 내 취소 가능)</span>
    <Button variant="link" onClick={handleUndo}>
      실행 취소
    </Button>
  </Toast>
)}
```

### 6.2 백엔드 - 예약 발송 방식

```typescript
// 이메일을 즉시 보내지 않고 5초 후 예약
const scheduledAt = new Date(Date.now() + 5000)

await createEmail({
  ...emailData,
  status: 'scheduled',
  scheduledAt,
})

// 취소 API
router.delete('/api/v1/emails/:emailId/cancel', async (req, res) => {
  const { emailId } = req.params

  const email = await prisma.email.findUnique({
    where: { id: emailId }
  })

  if (email && email.status === 'scheduled') {
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'draft' }
    })
    return res.json({ success: true })
  }

  res.status(400).json({ error: 'Cannot cancel' })
})

// Cron job으로 예약된 이메일 전송
// server/src/jobs/send-scheduled-emails.ts
setInterval(async () => {
  const scheduledEmails = await prisma.email.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: {
        lte: new Date()
      }
    }
  })

  for (const email of scheduledEmails) {
    await sendEmail(email)
  }
}, 1000) // 1초마다 체크
```

---

## ⚡ 7. 성능 최적화

### 7.1 Virtual Scrolling (긴 스레드 처리)

```bash
npm install @tanstack/react-virtual
```

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function ThreadEmailList({ emails }: { emails: ThreadEmail[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // 평균 이메일 높이
    overscan: 5, // 미리 렌더링할 개수
  })

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const email = emails[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <EmailItem email={email} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### 7.2 Optimistic Updates

```typescript
const sendEmail = useMutation({
  mutationFn: emailsApi.send,
  onMutate: async (newEmail) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['threadEmails', threadId])

    // Snapshot previous value
    const previousEmails = queryClient.getQueryData(['threadEmails', threadId])

    // Optimistically update
    queryClient.setQueryData(['threadEmails', threadId], (old: any) => ({
      ...old,
      data: [...old.data, {
        ...newEmail,
        id: 'temp-' + Date.now(),
        status: 'sending',
        createdAt: new Date().toISOString(),
      }]
    }))

    return { previousEmails }
  },
  onError: (err, newEmail, context) => {
    // Rollback on error
    queryClient.setQueryData(['threadEmails', threadId], context?.previousEmails)
  },
  onSettled: () => {
    queryClient.invalidateQueries(['threadEmails', threadId])
  }
})
```

---

## 🔐 8. 보안 고려사항

### 8.1 이메일 주소 검증

```typescript
// email-validation.ts
export function isValidEmail(email: string): boolean {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return regex.test(email)
}

export function parseEmailList(input: string): string[] {
  return input
    .split(/[,;]/)
    .map(e => e.trim())
    .filter(e => e && isValidEmail(e))
}

// 사용 예시
const recipients = parseEmailList(to)
if (recipients.length === 0) {
  toast.error('유효한 이메일 주소를 입력하세요')
  return
}
```

### 8.2 XSS 방지 (HTML 이메일)

```bash
npm install dompurify @types/dompurify
```

```typescript
import DOMPurify from 'dompurify'

// HTML 이메일 sanitization
export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote'],
    ALLOWED_ATTR: ['href', 'style'],
  })
}

// 사용
const cleanHtml = sanitizeEmailHtml(body)
```

### 8.3 Rate Limiting

```typescript
// server/src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit'

export const emailSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 50, // 최대 50개 이메일
  message: '너무 많은 이메일을 보내고 있습니다. 잠시 후 다시 시도하세요.',
  standardHeaders: true,
  legacyHeaders: false,
})

// 라우터에 적용
router.post('/api/v1/emails/send', emailSendLimiter, async (req, res) => {
  // ...
})
```

---

## ⌨️ 9. 키보드 단축키

```tsx
import { useHotkeys } from 'react-hotkeys-hook'

function InlineComposeBox() {
  // Cmd/Ctrl + Enter: 전송
  useHotkeys('mod+enter', (e) => {
    e.preventDefault()
    handleSend()
  })

  // Cmd/Ctrl + Shift + C: CC 표시
  useHotkeys('mod+shift+c', (e) => {
    e.preventDefault()
    setShowCc(true)
  })

  // Cmd/Ctrl + Shift + B: BCC 표시
  useHotkeys('mod+shift+b', (e) => {
    e.preventDefault()
    setShowBcc(true)
  })

  // Escape: 닫기
  useHotkeys('escape', () => {
    onClose()
  })

  return (
    <div>
      {/* UI */}
      <div className="text-xs text-gray-500 mt-2">
        단축키: ⌘Enter (전송) | Esc (닫기) | ⌘⇧C (참조) | ⌘⇧B (숨은참조)
      </div>
    </div>
  )
}
```

---

## 🧪 10. 테스트

### 10.1 단위 테스트

```typescript
// __tests__/email-utils.test.ts
import { generateMessageId, buildReferencesHeader } from '../email-headers'

describe('Email Headers', () => {
  test('generateMessageId creates valid Message-ID', () => {
    const messageId = generateMessageId('example.com')
    expect(messageId).toMatch(/^<[a-f0-9]+\.\d+@example\.com>$/)
  })

  test('buildReferencesHeader maintains thread', () => {
    const refs = buildReferencesHeader(
      ['<msg1@ex.com>', '<msg2@ex.com>'],
      '<msg3@ex.com>'
    )
    expect(refs).toEqual(['<msg1@ex.com>', '<msg2@ex.com>', '<msg3@ex.com>'])
  })

  test('buildReferencesHeader limits to 50 items', () => {
    const manyRefs = Array.from({ length: 60 }, (_, i) => `<msg${i}@ex.com>`)
    const refs = buildReferencesHeader(manyRefs, '<new@ex.com>')
    expect(refs.length).toBeLessThanOrEqual(51)
    expect(refs[0]).toBe('<msg0@ex.com>') // 첫 번째 유지
  })
})
```

### 10.2 E2E 테스트 (Playwright)

```typescript
// e2e/reply-flow.spec.ts
import { test, expect } from '@playwright/test'

test('reply to email in thread', async ({ page }) => {
  await page.goto('/email-replies')

  // 스레드 선택
  await page.click('text=Test Thread Subject')

  // 답장 버튼 클릭
  await page.click('button:has-text("답장")')

  // 작성 영역이 나타나는지 확인
  await expect(page.locator('[data-testid="compose-box"]')).toBeVisible()

  // 내용 입력
  await page.fill('textarea[placeholder*="메시지"]', 'This is my reply')

  // 전송
  await page.click('button:has-text("전송")')

  // 성공 토스트 확인
  await expect(page.locator('text=이메일이 전송되었습니다')).toBeVisible()
})
```

---

## 📊 11. 완성 후 UX 플로우

```
사용자가 스레드를 클릭
  ↓
스레드 상세 화면 표시 (ThreadDetailPanel)
  ↓
하단에 "답장" 버튼 표시 (Gmail 스타일)
  ↓
사용자가 답장 클릭
  ↓
인라인 작성 영역이 스레드 하단에 나타남
  ↓
받는사람 자동 입력 (originalEmail.fromEmail)
제목 자동 생성 (Re: ...)
원본 이메일 인용문 자동 추가
  ↓
사용자가 내용 작성 (Rich Text Editor)
  ↓
[선택] CC/BCC 추가
[선택] 첨부파일 추가
[선택] 예약 발송 설정
  ↓
자동 저장 (3초 debounce)
  ↓
사용자가 "전송" 클릭
  ↓
Undo Toast 표시 (5초)
  ↓
5초 후 실제 전송
  ↓
백엔드에서 Message-ID, In-Reply-To, References 헤더 설정
  ↓
SendGrid를 통해 이메일 전송
  ↓
DB에 이메일 저장 (threadId 매핑)
  ↓
프론트엔드 스레드 목록 새로고침 (optimistic update)
  ↓
성공 토스트 표시
```

---

## 🚀 구현 순서

1. ✅ **1단계**: Rich Text Editor (Tiptap) 설치 및 기본 설정
2. ✅ **2단계**: `InlineComposeBox` 컴포넌트 작성 (최소화/확장/전체화면)
3. ✅ **3단계**: `ThreadDetailPanel`에 인라인 작성 영역 통합
4. ✅ **4단계**: 백엔드 이메일 헤더 로직 (`Message-ID`, `In-Reply-To`, `References`)
5. ✅ **5단계**: Draft 자동 저장 (`useDraftAutoSave` 훅)
6. ✅ **6단계**: 첨부파일 업로드 (`FileUpload` 컴포넌트)
7. ✅ **7단계**: Undo Send 기능
8. ✅ **8단계**: 키보드 단축키 (`react-hotkeys-hook`)
9. ✅ **9단계**: 성능 최적화 (Virtual Scrolling, Optimistic Updates)
10. ✅ **10단계**: 보안 강화 (이메일 검증, XSS 방지, Rate Limiting)
11. ✅ **11단계**: 테스트 (단위 테스트, E2E 테스트)
12. ✅ **12단계**: 최종 UX 개선 및 디버깅

---

## 📚 추가 참고 자료

### RFC 문서
- [RFC 5322 - Internet Message Format](https://tools.ietf.org/html/rfc5322)
- [RFC 2822 - Message-ID and References](https://www.rfc-editor.org/rfc/rfc2822)
- [RFC 2045 - MIME Part 1](https://tools.ietf.org/html/rfc2045)

### 라이브러리 문서
- [Tiptap Documentation](https://tiptap.dev/)
- [React Query (TanStack Query)](https://tanstack.com/query/latest)
- [React Dropzone](https://react-dropzone.js.org/)
- [React Hotkeys Hook](https://github.com/JohannesKlauss/react-hotkeys-hook)

### Gmail UX 분석
- [Gmail's Reply Flow](https://support.google.com/mail/answer/6579)
- [Email Threading Best Practices](https://www.ietf.org/rfc/rfc5256.txt)

---

## 🎉 완료 체크리스트

- [ ] Tiptap Rich Text Editor 통합
- [ ] 인라인 작성 UI (확장/축소/전체화면)
- [ ] Message-ID, In-Reply-To, References 헤더 생성
- [ ] Thread-ID 자동 매핑
- [ ] Draft 자동 저장 (3초 debounce)
- [ ] 첨부파일 업로드 (drag & drop)
- [ ] Undo Send (5초 취소 가능)
- [ ] 예약 발송
- [ ] 이메일 서명 자동 추가
- [ ] 키보드 단축키 (Cmd+Enter, Esc, 등)
- [ ] Virtual Scrolling (긴 스레드)
- [ ] Optimistic Updates
- [ ] 이메일 주소 검증
- [ ] XSS 방지 (DOMPurify)
- [ ] Rate Limiting
- [ ] 단위 테스트
- [ ] E2E 테스트
- [ ] 모바일 반응형
- [ ] 다크 모드 지원
- [ ] 접근성 (a11y)

---

이 가이드를 따라 구현하면 Gmail과 동일한 수준의 이메일 답장/전달 기능을 완성할 수 있습니다. 🚀
