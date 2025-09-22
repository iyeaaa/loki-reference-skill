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
  console.log('\n========== 새 이메일 수신 ==========');
  console.log('시간:', new Date().toISOString());

  // 기본 정보 출력
  console.log('\n[기본 정보]');
  console.log('From:', req.body.from);
  console.log('To:', req.body.to);
  console.log('Subject:', req.body.subject);

  // 추가 정보 출력
  if (req.body.cc) console.log('CC:', req.body.cc);
  if (req.body.sender_ip) console.log('Sender IP:', req.body.sender_ip);
  if (req.body.spam_score) console.log('Spam Score:', req.body.spam_score);
  if (req.body.SPF) console.log('SPF:', req.body.SPF);
  if (req.body.DKIM) console.log('DKIM:', req.body.DKIM);

  // 이메일 본문
  console.log('\n[이메일 본문]');
  if (req.body.text) {
    console.log('Text:', req.body.text.substring(0, 200) + (req.body.text.length > 200 ? '...' : ''));
  }
  if (req.body.html) {
    console.log('HTML 본문 길이:', req.body.html.length, 'characters');
  }

  // 헤더 정보
  if (req.body.headers) {
    console.log('\n[헤더]');
    try {
      const headers = typeof req.body.headers === 'string'
        ? JSON.parse(req.body.headers)
        : req.body.headers;
      console.log(JSON.stringify(headers, null, 2));
    } catch (e) {
      console.log('헤더 파싱 실패:', req.body.headers);
    }
  }

  // Envelope 정보
  if (req.body.envelope) {
    console.log('\n[Envelope]');
    try {
      const envelope = typeof req.body.envelope === 'string'
        ? JSON.parse(req.body.envelope)
        : req.body.envelope;
      console.log(JSON.stringify(envelope, null, 2));
    } catch (e) {
      console.log('Envelope 파싱 실패:', req.body.envelope);
    }
  }

  // 첨부파일 정보
  if (req.files && req.files.length > 0) {
    console.log('\n[첨부파일]');
    req.files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);
    });
  }

  // 전체 raw 데이터 (디버깅용)
  if (process.env.DEBUG === 'true') {
    console.log('\n[전체 RAW 데이터]');
    console.log(JSON.stringify(req.body, null, 2));
  }

  console.log('\n=====================================\n');

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