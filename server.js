const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const sgMail = require('@sendgrid/mail');

dotenv.config();

// SendGrid API 키 설정
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
    // 공백과 줄바꿈 제거
    const cleanStr = str.replace(/[\r\n\s]/g, '');
    // Base64 디코딩
    const decoded = Buffer.from(cleanStr, 'base64').toString('utf-8');
    // 디코딩 결과가 읽을 수 있는 텍스트인지 확인
    if (decoded && /^[\x20-\x7E\u00A0-\uFFFF\r\n\t]+$/.test(decoded)) {
      return decoded;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// 자동 답장 이메일 발송 함수
async function sendAutoReply(toEmail, fromEmail, subject, emailContent) {
  const now = new Date();
  const formattedTime = now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // 이메일 내용 요약 (최대 200자) - 앞뒤 공백 제거
  const contentSummary = emailContent ?
    (emailContent.trim().length > 200 ? emailContent.trim().substring(0, 200) + '...' : emailContent.trim()) :
    '(내용 없음)';

  const msg = {
    to: fromEmail, // 원래 발신자에게 답장
    from: {
      email: 'rinda@partners.grinda.ai',
      name: '린다 뷰티 (Rinda Beauty)'
    },
    replyTo: 'rinda@partners.grinda.ai',
    subject: `Re: ${subject || '문의 감사합니다'}`,
    text: `안녕하세요,

소중한 문의 주셔서 감사합니다.

[접수 정보]
제목: ${subject || '제목 없음'}
내용: ${contentSummary}

접수시간: ${formattedTime}

고객님의 문의사항을 확인했으며, 담당자가 내용을 검토 중입니다.
24시간 이내 상세한 답변을 드리도록 하겠습니다.

감사합니다.

린다 고객지원팀
rinda@partners.grinda.ai`,
    // 추적 설정 - 텍스트 이메일의 링크는 < > 로 감싸면 원본 URL 표시
    trackingSettings: {
      clickTracking: {
        enable: true,
        enableText: true
      },
      openTracking: {
        enable: true
      },
      subscriptionTracking: {
        enable: false
      }
    }
    /* HTML 제거 - 텍스트 전용 이메일
    , html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f5f7fa;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f7fa;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 10px 0; font-weight: bold;">RINDA</h1>
                    <p style="color: #ffffff; font-size: 14px; margin: 0; opacity: 0.9;">K-Beauty Global Sales Automation</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <div style="margin: 0 0 25px 0;">
                      <h2 style="color: #333333; font-size: 20px; margin: 0 0 10px 0;">안녕하세요,</h2>
                      <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0;">
                        소중한 문의 주셔서 감사합니다.
                      </p>
                    </div>

                    <!-- 접수 정보 -->
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <h3 style="color: #667eea; font-size: 16px; margin: 0 0 15px 0;">📋 접수 정보</h3>

                      <div style="margin-bottom: 12px;">
                        <span style="color: #999999; font-size: 13px;">제목</span>
                        <p style="color: #333333; font-size: 15px; margin: 5px 0 0 0; font-weight: 500;">
                          ${subject || '제목 없음'}
                        </p>
                      </div>

                      <div style="margin-bottom: 12px;">
                        <span style="color: #999999; font-size: 13px;">내용</span>
                        <div style="background: #ffffff; border: 1px solid #e9ecef; border-radius: 4px; padding: 12px; margin-top: 5px;">
                          <p style="color: #555555; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap; text-align: left;">
                            ${contentSummary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span style="color: #999999; font-size: 13px;">접수시간</span>
                        <p style="color: #666666; font-size: 14px; margin: 5px 0 0 0;">
                          ${formattedTime}
                        </p>
                      </div>
                    </div>

                    <!-- 처리 안내 -->
                    <div style="background: #f0f4ff; border-left: 3px solid #667eea; padding: 15px; margin: 0 0 25px 0;">
                      <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">
                        <strong>고객님의 문의사항을 확인했습니다.</strong><br>
                        담당자가 내용을 검토 후 <strong>24시간 이내</strong> 상세한 답변을 드리겠습니다.
                      </p>
                    </div>

                    <!-- 간단한 서비스 안내 -->
                    <div style="border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0;">
                        린다는 K-뷰티 브랜드의 해외 진출을 돕는 AI 자동화 서비스입니다.<br>
                        궁금하신 점이 있으시면 아래 링크에서 자세한 정보를 확인하실 수 있습니다.
                      </p>
                      <div style="text-align: center; margin-top: 20px;">
                        <a href="https://rinda.ai/all-in-one" style="display: inline-block; background: #667eea; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-size: 14px;">
                          서비스 자세히 보기
                        </a>
                      </div>
                    </div>

                    <p style="color: #555555; font-size: 14px; line-height: 1.8; margin: 20px 0;">
                      추가 문의사항이 있으시면 이 메일에 회신해 주세요.<br>
                      감사합니다.
                    </p>

                    <p style="color: #555555; font-size: 14px; margin: 30px 0 0 0;">
                      <strong>린다 고객지원팀</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border-top: 1px solid #e9ecef;">
                    <div style="text-align: center;">
                      <p style="color: #999999; font-size: 13px; line-height: 1.6; margin: 5px 0;">
                        📧 rinda@partners.grinda.ai | 🌐 www.rinda.ai<br>
                        © 2025 Rinda. All rights reserved.
                      </p>
                    </div>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
    */
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ 자동 답장 이메일 발송 성공: ${fromEmail}`);
    return true;
  } catch (error) {
    console.error('❌ 자동 답장 이메일 발송 실패:', error.message);
    if (error.response) {
      console.error('에러 상세:', error.response.body);
    }
    return false;
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

    // Content-Transfer-Encoding 확인 및 디코딩
    const contentEncodingMatch = req.body.email.match(/Content-Transfer-Encoding:\s*(base64|quoted-printable)/i);
    if (contentEncodingMatch && contentEncodingMatch[1].toLowerCase() === 'base64') {
      // Base64로 인코딩된 본문 찾기
      const base64BodyMatch = req.body.email.match(/Content-Transfer-Encoding:\s*base64\s*\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i);
      if (base64BodyMatch && base64BodyMatch[1]) {
        const decodedContent = decodeBase64(base64BodyMatch[1].trim());
        if (decodedContent) {
          console.log('\n📝 [디코딩된 이메일 내용]');
          console.log('────────────────────────────────────────');
          console.log(decodedContent);
          console.log('────────────────────────────────────────');
        }
      }
    }
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

  // 수신인이 admin@grinda.ai 또는 rinda@partners.grinda.ai인 경우 자동 답장 발송
  if (req.body.to && (req.body.to.includes('admin@grinda.ai') || req.body.to.includes('rinda@partners.grinda.ai'))) {
    console.log('\n📮 [자동 답장 처리]');
    console.log('├─ 수신인이 자동 답장 대상으로 확인됨:', req.body.to);
    console.log('├─ 발신자:', req.body.from);

    // 발신자 이메일 추출 (이메일 형식: "Name <email@example.com>" 또는 "email@example.com")
    const fromMatch = req.body.from.match(/<(.+)>/) || [null, req.body.from];
    const fromEmail = fromMatch[1] || req.body.from;

    // 이메일 제목과 본문 추출
    const emailSubject = req.body.subject || '제목 없음';
    let emailContent = req.body.text || '';

    // text가 없는 경우 Raw Email에서 본문 추출 시도
    if (!emailContent && req.body.email) {
      const rawEmail = req.body.email;

      // Base64로 인코딩된 text/plain 본문 찾기
      const plainTextMatch = rawEmail.match(/Content-Type:\s*text\/plain[^]*?\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i);
      if (plainTextMatch && plainTextMatch[1]) {
        const extractedText = plainTextMatch[1].trim();
        // Base64 디코딩 시도
        const decodedText = decodeBase64(extractedText);
        // 디코딩 실패 시 원본 텍스트가 이미 디코딩된 것일 수 있음
        if (decodedText) {
          emailContent = decodedText.trim();
        } else if (extractedText && !extractedText.match(/^[A-Za-z0-9+/=\s]+$/)) {
          // Base64가 아닌 일반 텍스트인 경우
          emailContent = extractedText.trim();
        }
      }

      // 그래도 없으면 Content-Transfer-Encoding: base64 부분 찾기
      if (!emailContent) {
        const base64BodyMatch = rawEmail.match(/Content-Transfer-Encoding:\s*base64\s*\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i);
        if (base64BodyMatch && base64BodyMatch[1]) {
          const decodedContent = decodeBase64(base64BodyMatch[1].trim());
          if (decodedContent) {
            emailContent = decodedContent.trim();
          }
        }
      }
    }

    // HTML이 있고 text가 없는 경우 HTML에서 텍스트 추출 (간단한 태그 제거)
    if (!emailContent && req.body.html) {
      emailContent = req.body.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // 최종적으로 이메일 내용 전체 trim 처리
    emailContent = emailContent.trim();

    // 깨진 문자가 있거나 내용이 없으면 기본 메시지
    if (!emailContent || emailContent.includes('�')) {
      emailContent = '(내용을 확인할 수 없습니다. 원본 이메일을 확인해 주세요.)';
    }

    console.log('├─ 답장 대상 이메일:', fromEmail);
    console.log('├─ 이메일 제목:', emailSubject);
    console.log('├─ 이메일 내용 길이:', emailContent.length, '자');
    console.log('└─ 자동 답장 발송 시작...');

    // 비동기로 자동 답장 발송 (응답 지연 방지)
    sendAutoReply(req.body.to, fromEmail, emailSubject, emailContent).then(success => {
      if (success) {
        console.log('   → 자동 답장 발송 완료 ✓');
      } else {
        console.log('   → 자동 답장 발송 실패 ✗');
      }
    });
  } else {
    console.log('\n📮 [자동 답장 스킵]');
    console.log('└─ 수신인이 자동 답장 대상이 아님:', req.body.to);
  }

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