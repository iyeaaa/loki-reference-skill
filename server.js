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
  if (req.body.text) {
    console.log('├─ Text 본문:');
    console.log('│  ', req.body.text.substring(0, 100).replace(/\n/g, '\n│   '));
    console.log('│   (총 ' + req.body.text.length + ' 글자)');
  } else {
    console.log('├─ Text 본문: 없음');
  }

  if (req.body.html) {
    console.log('└─ HTML 본문: 있음 (' + req.body.html.length + ' 글자)');
  } else {
    console.log('└─ HTML 본문: 없음');
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