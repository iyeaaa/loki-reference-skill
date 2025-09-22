const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Multer 설정 - 메모리에 파일 저장
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB 제한
});

// 미들웨어
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Base64 디코딩 헬퍼 함수
function decodeBase64(str) {
  try {
    // Base64 디코딩
    const decoded = Buffer.from(str, 'base64').toString('utf-8');
    return decoded;
  } catch (error) {
    return null;
  }
}

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// SendGrid Inbound Parse 웹훅 엔드포인트
app.post('/webhook/inbound', upload.any(), (req, res) => {
  console.log('\n========================================');
  console.log('         새 이메일 수신 알림');
  console.log('========================================');
  console.log('📅 수신 시간:', new Date().toISOString());

  // 1. 기본 정보
  console.log('\n📧 [이메일 기본 정보]');
  console.log('├─ From:', req.body.from || '없음');
  console.log('├─ To:', req.body.to || '없음');
  console.log('├─ CC:', req.body.cc || '없음');
  console.log('└─ Subject:', req.body.subject || '없음');

  // 2. 발신자 정보
  console.log('\n🌐 [발신자 정보]');
  console.log('├─ Sender IP:', req.body.sender_ip || '없음');
  console.log('└─ Envelope From:', (() => {
    try {
      const envelope = JSON.parse(req.body.envelope || '{}');
      return envelope.from || '없음';
    } catch {
      return '파싱 실패';
    }
  })());

  // 3. 보안 검증
  console.log('\n🔒 [보안 검증]');
  console.log('├─ SPF:', req.body.SPF || '없음');
  console.log('├─ DKIM:', req.body.dkim || '없음');
  console.log('├─ Spam Score:', req.body.spam_score || '없음');
  console.log('└─ Spam Report:', req.body.spam_report ?
    req.body.spam_report.split('\n')[0].substring(0, 50) + '...' : '없음');

  // 4. 이메일 본문
  console.log('\n📝 [이메일 본문]');

  // Text 본문 표시
  if (req.body.text) {
    console.log('├─ Text 본문 (총 ' + req.body.text.length + ' 글자):');
    console.log('│');
    // 전체 본문을 들여쓰기와 함께 표시
    req.body.text.split('\n').forEach(line => {
      console.log('│  ', line);
    });
    console.log('│');
  } else {
    console.log('├─ Text 본문: 없음');

    // Raw Email에서 본문 추출 시도 (Gmail 등에서 text/html이 별도로 파싱되지 않는 경우)
    if (req.body.email) {
      console.log('│  (Raw Email에서 본문 추출 시도...)');
      const rawEmail = req.body.email;

      // Content-Type: text/plain 부분 찾기
      const plainTextMatch = rawEmail.match(/Content-Type:\s*text\/plain[^]*?\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i);
      if (plainTextMatch && plainTextMatch[1]) {
        const extractedText = plainTextMatch[1].trim();

        // Base64 디코딩 시도
        const decodedText = decodeBase64(extractedText);

        if (decodedText) {
          console.log('│  추출된 Text 본문 (Base64 디코딩됨):');
          console.log('│  ────────────────────────────────────');
          decodedText.split('\n').forEach(line => {
            console.log('│   ', line.trim());
          });
        } else {
          console.log('│  추출된 Text 본문 (원본):');
          extractedText.split('\n').forEach(line => {
            console.log('│   ', line.trim());
          });
        }
        console.log('│');
      }
    }
  }

  // HTML 본문 표시
  if (req.body.html) {
    console.log('└─ HTML 본문: 있음 (' + req.body.html.length + ' 글자)');
  } else {
    console.log('└─ HTML 본문: 없음');

    // Raw Email에서 HTML 추출 시도
    if (req.body.email) {
      const rawEmail = req.body.email;
      const htmlMatch = rawEmail.match(/Content-Type:\s*text\/html[^]*?\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i);
      if (htmlMatch && htmlMatch[1]) {
        console.log('   (Raw Email에서 HTML 본문 감지됨)');
      }
    }
  }

  // 5. 첨부파일
  const attachmentCount = parseInt(req.body.attachments) || 0;
  if (attachmentCount > 0 || (req.files && req.files.length > 0)) {
    console.log('\n📎 [첨부파일]');
    console.log('├─ 첨부파일 개수:', attachmentCount);

    if (req.body['attachment-info']) {
      try {
        const attachInfo = JSON.parse(req.body['attachment-info']);
        Object.keys(attachInfo).forEach((key, idx, arr) => {
          const isLast = idx === arr.length - 1;
          const prefix = isLast ? '└─' : '├─';
          const info = attachInfo[key];
          console.log(`${prefix} ${info.filename || key}: ${info.type} (${info['content-id'] || 'no-id'})`);
        });
      } catch {
        console.log('└─ 첨부파일 정보 파싱 실패');
      }
    }

    if (req.files && req.files.length > 0) {
      console.log('   실제 업로드된 파일:');
      req.files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.originalname || file.fieldname} (${file.size} bytes)`);
      });
    }
  }

  // 6. 헤더 정보
  if (req.body.headers) {
    console.log('\n📋 [헤더 정보]');
    try {
      const headers = typeof req.body.headers === 'string' ?
        JSON.parse(req.body.headers) : req.body.headers;

      // 주요 헤더만 표시
      const importantHeaders = ['Message-ID', 'Date', 'Reply-To',
                                'List-Unsubscribe', 'List-ID', 'X-Mailer'];

      importantHeaders.forEach(header => {
        if (headers[header]) {
          console.log(`├─ ${header}:`, headers[header].substring(0, 60));
        }
      });
    } catch {
      console.log('└─ 헤더 파싱 실패');
    }
  }

  // 7. Raw Email (MIME) 정보
  if (req.body.email) {
    console.log('\n📄 [Raw Email (MIME)]');
    console.log('└─ 크기:', req.body.email.length, '바이트');

    // 전체 email 필드 출력 (요청에 따라)
    console.log('\n📧 [Email 필드 전체 내용]');
    console.log('────────────────────────────────────────');

    // Content-Transfer-Encoding 확인 및 디코딩
    const contentEncodingMatch = req.body.email.match(/Content-Transfer-Encoding:\s*(base64|quoted-printable)/i);
    if (contentEncodingMatch && contentEncodingMatch[1].toLowerCase() === 'base64') {
      // Base64로 인코딩된 본문 찾기
      const base64BodyMatch = req.body.email.match(/Content-Transfer-Encoding:\s*base64\s*\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i);
      if (base64BodyMatch && base64BodyMatch[1]) {
        const decodedContent = decodeBase64(base64BodyMatch[1].trim());
        if (decodedContent) {
          console.log('📝 디코딩된 이메일 내용:');
          console.log(decodedContent);
          console.log('────────────────────────────────────────');
        }
      }
    }

    console.log('\n📄 원본 Raw Email:');
    console.log(req.body.email);
    console.log('────────────────────────────────────────');
  }

  // 8. 문자 인코딩
  if (req.body.charsets) {
    console.log('\n🔤 [문자 인코딩]');
    try {
      const charsets = JSON.parse(req.body.charsets);
      Object.keys(charsets).forEach(key => {
        console.log(`├─ ${key}:`, charsets[key]);
      });
    } catch {
      console.log('└─ 인코딩 정보 파싱 실패');
    }
  }

  // 9. 추가 필드
  const knownFields = [
    'from', 'to', 'cc', 'subject', 'text', 'html', 'sender_ip',
    'spam_score', 'spam_report', 'SPF', 'dkim', 'headers',
    'envelope', 'attachments', 'attachment-info', 'charsets',
    'content-ids', 'email'
  ];

  const otherFields = Object.keys(req.body).filter(key => !knownFields.includes(key));
  if (otherFields.length > 0) {
    console.log('\n➕ [추가 필드]');
    otherFields.forEach(field => {
      const value = req.body[field];
      const displayValue = typeof value === 'string' && value.length > 50 ?
        value.substring(0, 50) + '...' : value;
      console.log(`├─ ${field}:`, displayValue);
    });
  }

  console.log('\n========================================');
  console.log('         이메일 처리 완료 ✓');
  console.log('========================================\n');

  // SendGrid에 200 응답 반환
  res.status(200).send('OK');
});

// 수신된 이메일 목록 조회 (메모리에 저장하는 간단한 예제)
const emails = [];

app.post('/webhook/inbound-store', upload.any(), (req, res) => {
  const email = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    from: req.body.from,
    to: req.body.to,
    subject: req.body.subject,
    text: req.body.text,
    html: req.body.html,
    attachments: req.files ? req.files.map(f => ({
      filename: f.originalname,
      size: f.size,
      mimetype: f.mimetype
    })) : []
  };

  emails.push(email);
  console.log(`이메일 저장됨: ${email.subject} (ID: ${email.id})`);

  res.status(200).send('OK');
});

app.get('/emails', (req, res) => {
  res.json({
    count: emails.length,
    emails: emails.slice(-50) // 최근 50개만 반환
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`SendGrid Inbound Parse 웹훅 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`웹훅 엔드포인트: http://localhost:${PORT}/webhook/inbound`);
  console.log(`이메일 목록: http://localhost:${PORT}/emails`);
});