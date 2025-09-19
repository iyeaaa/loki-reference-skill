require('dotenv').config();
const sgMail = require('@sendgrid/mail');

// 설정 변수
const TOTAL_EMAILS = 1; // 보낼 이메일 총 개수
const INTERVAL_SECONDS = 10; // 이메일 발송 간격 (초)

// SendGrid API 키 설정
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const now = new Date();
const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 한국 시간
const formattedTime = koreanTime.toLocaleString('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true
});

const msg = {
  to: 'grindaai1@gmail.com',
  // to: 'wks0968@gmail.com',
  from: {
    email: 'admin@grinda.ai',
    name: '린다 뷰티 (Rinda Beauty)' // 발신자 이름 추가
  },
  replyTo: 'admin@grinda.ai', // 답장 주소 명시
  subject: `[린다 뷰티] K-뷰티 해외 진출, AI로 자동화하세요`,
  text: `안녕하세요, 담당자님

해외 바이어 발굴과 관리에 매달 수백만원을 쓰고 계신가요?

저희는 AI 기술 전문기업 그린다에이아이가 운영하는 린다 뷰티(Rinda Beauty)입니다.
K-뷰티 브랜드의 글로벌 진출을 AI로 자동화하여, 기존 대비 96% 비용을 절감해드립니다.

3줄 요약
✅ 월 19만원부터 시작하는 해외 바이어 자동 매칭
✅ AI가 월 450개 바이어에게 자동으로 영업 진행
✅ 이미 42개 기업이 선택한 검증된 솔루션

귀사가 겪고 있는 문제, 우리가 해결합니다
❌ 해외 바이어 찾기가 막막하다
❌ 영어 이메일 작성이 부담스럽다
❌ 팔로업 타이밍을 놓친다
❌ 어느 국가부터 진출해야 할지 모르겠다

린다 뷰티 핵심 기능
• AI 바이어 매칭: 17개국 검증된 바이어 DB에서 자동 발굴
• 자동 콜드메일: GPT-4를 능가하는 자체 LLM으로 맞춤형 이메일 생성
• 스마트 팔로업: 18% 응답률 달성하는 AI 자동 추적 시스템

투자 대비 수익
• 스타터: 월 19만원 (1개국, 월 100개 바이어)
• 프로: 월 49만원 (3~5개국, 월 450개 바이어)
• ROI: 평균 3개월 내 첫 계약 성사

왜 그린다에이아이인가
• ChatGPT 대비 10배 저렴한 비용
• 대전 팁스타운 입주 기업 (정부 인증)
• 금융, 엔터테인먼트 등 다양한 산업 AI 구축 경험

지금 바로 무료 AI 진단을 받아보세요
귀사의 해외 진출 준비도를 15분 만에 분석해드립니다.
→ https://landing.rinda.ai/beauty

P.S. 이번 달 신규 가입 시 첫 달 50% 할인 혜택을 제공합니다.

그린다에이아이 | 린다 뷰티 팀
📧 admin@grinda.ai
📍 대전광역시 유성구 대학로 99 대전팁스타운 503호
💼 사업자등록번호: 309-88-02709
"AI와 함께, 당신의 글로벌 비즈니스를 그립니다"`,
  html: `
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
                  <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 10px 0; font-weight: bold;">린다 뷰티</h1>
                  <p style="color: #ffffff; font-size: 16px; margin: 0; opacity: 0.95;">K-뷰티 글로벌 진출 AI 자동화 솔루션</p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    안녕하세요, <strong>{{담당자명}}</strong>님
                  </p>

                  <div style="background: #fff4e6; border-left: 4px solid #ff9800; padding: 15px; margin: 25px 0;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">
                      <strong>해외 바이어 발굴과 관리에 매달 수백만원을 쓰고 계신가요?</strong>
                    </p>
                  </div>

                  <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 20px 0;">
                    저희는 AI 기술 전문기업 그린다에이아이가 운영하는 <strong style="color: #667eea;">린다 뷰티(Rinda Beauty)</strong>입니다.
                    K-뷰티 브랜드의 글로벌 진출을 AI로 자동화하여, <strong>기존 대비 96% 비용을 절감</strong>해드립니다.
                  </p>

                  <!-- 3줄 요약 -->
                  <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <h3 style="color: #333333; font-size: 18px; margin: 0 0 15px 0;">📌 3줄 요약</h3>
                    <ul style="color: #555555; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0;">
                      <li style="margin-bottom: 8px;">✅ 월 19만원부터 시작하는 해외 바이어 자동 매칭</li>
                      <li style="margin-bottom: 8px;">✅ AI가 월 450개 바이어에게 자동으로 영업 진행</li>
                      <li>✅ 이미 42개 기업이 선택한 검증된 솔루션</li>
                    </ul>
                  </div>

                  <!-- 문제점 섹션 -->
                  <div style="margin: 30px 0;">
                    <h3 style="color: #333333; font-size: 20px; margin: 0 0 15px 0;">귀사가 겪고 있는 문제, 우리가 해결합니다</h3>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #ff4757; font-size: 16px;">❌</span>
                          <span style="color: #555555; font-size: 15px; margin-left: 10px;">해외 바이어 찾기가 막막하다</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #ff4757; font-size: 16px;">❌</span>
                          <span style="color: #555555; font-size: 15px; margin-left: 10px;">영어 이메일 작성이 부담스럽다</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #ff4757; font-size: 16px;">❌</span>
                          <span style="color: #555555; font-size: 15px; margin-left: 10px;">팔로업 타이밍을 놓친다</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #ff4757; font-size: 16px;">❌</span>
                          <span style="color: #555555; font-size: 15px; margin-left: 10px;">어느 국가부터 진출해야 할지 모르겠다</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- 핵심 기능 -->
                  <div style="margin: 30px 0;">
                    <h3 style="color: #333333; font-size: 20px; margin: 0 0 20px 0;">🚀 린다 뷰티 핵심 기능</h3>

                    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                      <h4 style="color: #667eea; font-size: 16px; margin: 0 0 8px 0;">AI 바이어 매칭</h4>
                      <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 0;">
                        17개국 검증된 바이어 DB에서 자동 발굴
                      </p>
                    </div>

                    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                      <h4 style="color: #667eea; font-size: 16px; margin: 0 0 8px 0;">자동 콜드메일</h4>
                      <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 0;">
                        GPT-4를 능가하는 자체 LLM으로 맞춤형 이메일 생성
                      </p>
                    </div>

                    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px;">
                      <h4 style="color: #667eea; font-size: 16px; margin: 0 0 8px 0;">스마트 팔로업</h4>
                      <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 0;">
                        18% 응답률 달성하는 AI 자동 추적 시스템
                      </p>
                    </div>
                  </div>

                  <!-- 가격 정보 -->
                  <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%); border-radius: 8px; padding: 25px; margin: 30px 0;">
                    <h3 style="color: #333333; font-size: 20px; margin: 0 0 20px 0;">💰 투자 대비 수익</h3>

                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 10px 0;">
                          <strong style="color: #667eea;">스타터</strong>
                          <span style="color: #555555; margin-left: 10px;">월 19만원 (1개국, 월 100개 바이어)</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0;">
                          <strong style="color: #667eea;">프로</strong>
                          <span style="color: #555555; margin-left: 10px;">월 49만원 (3~5개국, 월 450개 바이어)</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0;">
                          <strong style="color: #28a745;">ROI</strong>
                          <span style="color: #555555; margin-left: 10px;">평균 3개월 내 첫 계약 성사</span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Why Us -->
                  <div style="margin: 30px 0;">
                    <h3 style="color: #333333; font-size: 20px; margin: 0 0 15px 0;">🏆 왜 그린다에이아이인가</h3>
                    <ul style="color: #555555; font-size: 15px; line-height: 1.8; padding-left: 20px;">
                      <li style="margin-bottom: 8px;">ChatGPT 대비 10배 저렴한 비용</li>
                      <li style="margin-bottom: 8px;">대전 팁스타운 입주 기업 (정부 인증)</li>
                      <li>금융, 엔터테인먼트 등 다양한 산업 AI 구축 경험</li>
                    </ul>
                  </div>

                  <!-- CTA -->
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 30px; margin: 30px 0; text-align: center;">
                    <h3 style="color: #ffffff; font-size: 22px; margin: 0 0 10px 0;">지금 바로 무료 AI 진단을 받아보세요</h3>
                    <p style="color: #ffffff; font-size: 15px; margin: 0 0 20px 0; opacity: 0.95;">
                      귀사의 해외 진출 준비도를 15분 만에 분석해드립니다.
                    </p>
                    <a href="https://landing.rinda.ai/beauty" style="display: inline-block; background-color: #ffffff; color: #667eea; padding: 14px 35px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                      무료 진단 신청하기 →
                    </a>
                  </div>

                  <!-- Special Offer -->
                  <div style="background: #fff9e6; border: 2px dashed #ffc107; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                    <p style="color: #333333; font-size: 16px; margin: 0;">
                      <strong>🎉 P.S.</strong> 이번 달 신규 가입 시 <strong style="color: #ff6b35;">첫 달 50% 할인</strong> 혜택을 제공합니다.
                    </p>
                  </div>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border-top: 1px solid #e9ecef;">
                  <div style="text-align: center;">
                    <h4 style="color: #667eea; font-size: 18px; margin: 0 0 15px 0;">그린다에이아이 | 린다 뷰티 팀</h4>
                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 5px 0;">
                      📧 admin@grinda.ai<br>
                      📍 대전광역시 유성구 대학로 99 대전팁스타운 503호<br>
                      💼 사업자등록번호: 309-88-02709
                    </p>
                    <p style="color: #999999; font-size: 13px; margin: 20px 0 0 0; font-style: italic;">
                      "AI와 함께, 당신의 글로벌 비즈니스를 그립니다"
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
  `,
  trackingSettings: {
    clickTracking: {
      enable: false // 링크 추적 비활성화 (스팸 점수 감소)
    },
    openTracking: {
      enable: false // 오픈 추적 비활성화
    }
  }
};

// 이메일 발송 함수
async function sendEmail(index) {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const formattedTime = koreanTime.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const emailMsg = {
    ...msg,
    subject: `[린다 뷰티 #${index}] K-뷰티 해외 진출, AI로 자동화하세요`,
    text: msg.text,
    html: msg.html
  };

  try {
    await sgMail.send(emailMsg);
    console.log(`[${index}/${TOTAL_EMAILS}] 이메일 발송 성공 - ${formattedTime}`);
  } catch (error) {
    console.error(`[${index}/${TOTAL_EMAILS}] 이메일 발송 실패:`, error.message);
    if (error.response) {
      console.error('에러 상세:', error.response.body);
    }
  }
}

// 설정된 간격으로 이메일 발송
async function sendMultipleEmails() {
  console.log(`이메일 발송 시작 (총 ${TOTAL_EMAILS}개, ${INTERVAL_SECONDS}초 간격)`);

  for (let i = 1; i <= TOTAL_EMAILS; i++) {
    await sendEmail(i);

    if (i < TOTAL_EMAILS) {
      console.log(`${INTERVAL_SECONDS}초 대기 중...`);
      await new Promise(resolve => setTimeout(resolve, INTERVAL_SECONDS * 1000)); // 설정된 시간 대기
    }
  }

  console.log('모든 이메일 발송 완료!');
}

// 실행
sendMultipleEmails();