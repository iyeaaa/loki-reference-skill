// 이메일 서명 생성 유틸리티 함수

export interface SignatureOptions {
  name?: string
  title?: string
}

// HTML 서명 생성
export function generateSignatureHtml(options: SignatureOptions = {}): string {
  const name = options.name || "김규동 Gyudong Kim"
  const title = options.title || "Project Lead"

  return `
    <div dir="ltr">
      <font face="tahoma, sans-serif">---</font>
      <div>
        <font face="tahoma, sans-serif">
          <img width="200" height="40" src="https://ci3.googleusercontent.com/mail-sig/AIorK4wmbav037hCfz80GR6E4h7flMNvTFaW2MHfrLwEDxzoBQv47zi5AijTZvapZhWOPSY3lexM6IgALCnW" loading="lazy">
          <br>
        </font>
      </div>
      <div>
        <b><font size="4" face="tahoma, sans-serif">${name}</font></b>
      </div>
  <div>
    <b><font face="tahoma, sans-serif">주식회사 그린다에이아이&nbsp; |&nbsp; ${title}</font></b>
  </div>
  <div><font face="tahoma, sans-serif"><br></font></div>
  <div>
    <font color="#999999" face="tahoma, sans-serif">
      <b>Add.</b> 대전광역시 유성구 대학로 99 대전 팁스타운 502
    </font>
  </div>
  <div>
    <font color="#999999" face="tahoma, sans-serif">
      (99, Daehak-ro, Yuseong-gu, Daejeon, Republic of Korea)
    </font>
  </div>
  <div>
    <font color="#999999" face="tahoma, sans-serif">
      <b>Tel.</b> 010-8351-6129
    </font>
  </div>
  <div>
    <font color="#999999" face="tahoma, sans-serif">
      <b>Web.</b> <a href="http://www.grinda.ai" target="_blank" rel="noreferrer noopener">www.grinda.ai</a>
    </font>
  </div>
  <div><font face="tahoma, sans-serif"><br></font></div>
  <div>
    <font face="tahoma, sans-serif">
      <span style="color:rgb(140,140,140);font-size:9px">
        본 메일에는 법률상 보호되는 영업비밀이나 비밀유지서약서에 따라 보호되는 비밀정보가 포함되어 있습니다. 이에 포함된 내용은 보안을 유지하여야 하며 본 문서에 포함된 정보의 전부 또는 일부를 무단으로 제3자에게 공개, 배포, 복사 또는 사용하는 것은 엄격히 금지됩니다. 본 메일이 잘못 전송된 경우, 발신인 또는 당사에 알려주시고, 본 메일 및 첨부문서를 즉시 삭제하여 주시기 바랍니다. 또한 본 메일의 법률상 안전성과 바이러스가 없음을 보장하지 않으며, 타인에 의한 본 메일의 변경에 대하여 책임지지 않습니다.
      </span>
      <br style="color:rgb(140,140,140);font-size:9px">
      <span style="color:rgb(140,140,140);font-size:9px">
        This email contains confidential information that is protected by law or under the confidentiality agreements. Any information contained herein shall be kept secure and any unauthorized disclosure, distribution, copying or use of any or all of the information contained herein to any third party is strictly prohibited. If this email is sent incorrectly, please notify the sender or us and delete this email and attachments immediately. In addition, the law of this mail does not guarantee safety and virus-free, and we are not responsible for any changes made to this mail by others.
      </span>
    </font>
  </div>
</div>`.trim()
}

// 텍스트 서명 생성
export function generateSignatureText(options: SignatureOptions = {}): string {
  const name = options.name || "김규동 Gyudong Kim"
  const title = options.title || "Project Lead"

  return `
${name}
주식회사 그린다에이아이  |  ${title}

Add. 대전광역시 유성구 대학로 99 대전 팁스타운 502
(99, Daehak-ro, Yuseong-gu, Daejeon, Republic of Korea)
Tel. 010-8351-6129
Web. www.grinda.ai

본 메일에는 법률상 보호되는 영업비밀이나 비밀유지서약서에 따라 보호되는 비밀정보가 포함되어 있습니다. 이에 포함된 내용은 보안을 유지하여야 하며 본 문서에 포함된 정보의 전부 또는 일부를 무단으로 제3자에게 공개, 배포, 복사 또는 사용하는 것은 엄격히 금지됩니다. 본 메일이 잘못 전송된 경우, 발신인 또는 당사에 알려주시고, 본 메일 및 첨부문서를 즉시 삭제하여 주시기 바랍니다. 또한 본 메일의 법률상 안전성과 바이러스가 없음을 보장하지 않으며, 타인에 의한 본 메일의 변경에 대하여 책임지지 않습니다.
This email contains confidential information that is protected by law or under the confidentiality agreements. Any information contained herein shall be kept secure and any unauthorized disclosure, distribution, copying or use of any or all of the information contained herein to any third party is strictly prohibited. If this email is sent incorrectly, please notify the sender or us and delete this email and attachments immediately. In addition, the law of this mail does not guarantee safety and virus-free, and we are not responsible for any changes made to this mail by others.`.trim()
}

// HTML을 텍스트로 변환하는 함수 (줄바꿈 유지)
export function htmlToMarkdown(html: string): string {
  if (!html) return ""

  return (
    html
      // <br> 태그를 줄바꿈으로 변환
      .replace(/<br\s*\/?>/gi, "\n")
      // <div> 태그를 줄바꿈으로 변환
      .replace(/<\/div>/gi, "\n")
      .replace(/<div[^>]*>/gi, "")
      // HTML 태그 제거
      .replace(/<[^>]*>/g, "")
      // HTML 엔티티 디코딩
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      // 연속된 줄바꿈 정리 (최대 2개)
      .replace(/\n{3,}/g, "\n\n")
      // 앞뒤 공백 제거
      .trim()
  )
}

// 기본 이메일 템플릿에 서명을 포함한 HTML 생성
export function generateEmailTemplateWithSignature(options: SignatureOptions = {}): string {
  const signatureHtml = generateSignatureHtml(options)

  return `
  --
${signatureHtml}`
}
