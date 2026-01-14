/**
 * 이용약관 페이지
 * 2026년 최신 법률 기준
 */

import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link
            className="inline-flex items-center text-gray-600 text-sm hover:text-gray-900"
            to="/payment-test"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            돌아가기
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <article className="rounded-lg bg-white p-8 shadow-sm">
          <h1 className="mb-2 font-bold text-2xl text-gray-900">서비스 이용약관</h1>
          <p className="mb-8 text-gray-500 text-sm">
            시행일: 2026년 1월 13일 | 최종 수정: 2026년 1월 13일
          </p>

          <div className="prose prose-gray max-w-none">
            {/* 제1조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제1조 (목적)</h2>
              <p className="text-gray-700 leading-relaxed">
                이 약관은 그린다에이아이주식회사(이하 "회사")가 제공하는 Rinda AI 서비스(이하
                "서비스")의 이용조건 및 절차, 회사와 이용자의 권리, 의무, 책임사항과 기타 필요한
                사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            {/* 제2조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제2조 (정의)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  <strong>"서비스"</strong>란 회사가 제공하는 AI 기반 해외 바이어 발굴 및 글로벌
                  세일즈 자동화 플랫폼을 의미합니다. 이는 리드 발굴, AI 이메일 작성, 다국어 번역,
                  캠페인 관리 등을 포함합니다.
                </li>
                <li>
                  <strong>"이용자"</strong>란 이 약관에 따라 회사가 제공하는 서비스를 이용하는
                  고객을 말합니다.
                </li>
                <li>
                  <strong>"유료서비스"</strong>란 회사가 유료로 제공하는 각종 서비스 및 제반
                  콘텐츠를 의미합니다.
                </li>
                <li>
                  <strong>"구독"</strong>이란 이용자가 정기적으로 이용료를 결제하고 서비스를
                  이용하는 형태를 말합니다.
                </li>
              </ol>
            </section>

            {/* 제3조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제3조 (약관의 효력 및 변경)
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>이 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.</li>
                <li>
                  회사는 필요하다고 인정되는 경우 관련 법령을 위배하지 않는 범위에서 이 약관을
                  변경할 수 있습니다.
                </li>
                <li>
                  약관이 변경되는 경우 회사는 변경 내용을 시행일자 7일 전부터 서비스 내 공지사항
                  또는 이메일을 통해 공지합니다. 다만, 이용자에게 불리한 변경의 경우 30일 전부터
                  공지합니다.
                </li>
              </ol>
            </section>

            {/* 제4조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제4조 (서비스의 제공)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  회사는 다음과 같은 서비스를 제공합니다:
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>AI 기반 해외 바이어 발굴 서비스</li>
                    <li>AI 영업 이메일 자동 생성 서비스</li>
                    <li>20개 언어 자동 번역 서비스</li>
                    <li>이메일 캠페인 관리 및 분석 서비스</li>
                    <li>기타 회사가 정하는 서비스</li>
                  </ul>
                </li>
                <li>
                  서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다. 다만, 시스템 점검 등의
                  사유로 일시적으로 서비스가 중단될 수 있습니다.
                </li>
              </ol>
            </section>

            {/* 제5조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제5조 (회원가입)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는
                  의사 표시를 함으로써 회원가입을 신청합니다.
                </li>
                <li>회사는 소셜 로그인(Google, Microsoft 등)을 통한 간편 가입을 지원합니다.</li>
                <li>
                  회사는 다음 각 호에 해당하는 경우 회원가입을 거절할 수 있습니다:
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>실명이 아닌 정보 또는 타인의 정보를 사용한 경우</li>
                    <li>허위 정보를 기재한 경우</li>
                    <li>기타 회원으로 등록하는 것이 부적절하다고 판단되는 경우</li>
                  </ul>
                </li>
              </ol>
            </section>

            {/* 제6조 - 결제 */}
            <section className="mb-8 rounded-lg bg-blue-50 p-6">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제6조 (유료서비스 및 결제)
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  <strong>요금제:</strong> 회사는 Basic, Pro, Enterprise 등 다양한 요금제를
                  제공하며, 각 요금제의 가격과 기능은 서비스 내에서 확인할 수 있습니다.
                </li>
                <li>
                  <strong>결제 수단:</strong> 이용자는 신용카드, 체크카드, 간편결제(토스페이,
                  카카오페이 등), PayPal 등 회사가 지원하는 결제 수단을 이용할 수 있습니다.
                </li>
                <li>
                  <strong>결제 시기:</strong> 월간 구독은 매월 결제일에, 연간 구독은 매년 결제일에
                  자동으로 결제됩니다.
                </li>
                <li>
                  <strong>결제 통화:</strong> 결제는 원화(KRW) 또는 미국 달러(USD)로 진행할 수
                  있으며, 환율은 결제 시점의 실시간 환율이 적용됩니다.
                </li>
                <li>
                  <strong>결제 대행:</strong> 결제는 PortOne(포트원) 결제 대행 서비스를 통해
                  안전하게 처리됩니다.
                </li>
              </ol>
            </section>

            {/* 제7조 - 구독 */}
            <section className="mb-8 rounded-lg bg-blue-50 p-6">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제7조 (구독 및 자동 결제)
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  <strong>구독 시작:</strong> 구독은 첫 결제가 완료된 시점부터 시작됩니다.
                </li>
                <li>
                  <strong>자동 갱신:</strong> 구독은 이용자가 해지하지 않는 한 자동으로 갱신되며,
                  갱신 7일 전 이메일로 안내됩니다.
                </li>
                <li>
                  <strong>구독 변경:</strong> 이용자는 언제든지 요금제를 업그레이드하거나
                  다운그레이드할 수 있습니다. 업그레이드 시 차액이 즉시 청구되며, 다운그레이드는
                  다음 결제 주기부터 적용됩니다.
                </li>
                <li>
                  <strong>무료 체험:</strong> 회사는 신규 이용자에게 14일 무료 체험 기간을 제공할 수
                  있으며, 무료 체험 기간 종료 후 유료 구독으로 자동 전환되지 않습니다.
                </li>
              </ol>
            </section>

            {/* 제8조 - 환불 */}
            <section className="mb-8 rounded-lg bg-amber-50 p-6">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제8조 (청약철회 및 환불)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  <strong>청약철회:</strong> 이용자는 결제일로부터 7일 이내에 청약철회를 요청할 수
                  있습니다. 다만, 서비스를 이용한 경우 이용한 부분에 해당하는 금액은 환불에서 제외될
                  수 있습니다.
                </li>
                <li>
                  <strong>환불 금액 계산:</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>서비스 미이용 시: 전액 환불</li>
                    <li>서비스 이용 시: 결제금액 - (일할 계산된 이용 금액) = 환불 금액</li>
                  </ul>
                </li>
                <li>
                  <strong>환불 처리 기한:</strong> 환불 요청 접수 후 영업일 기준 3일 이내에
                  처리됩니다. 결제 수단에 따라 실제 환불까지 추가 시간이 소요될 수 있습니다.
                </li>
                <li>
                  <strong>환불 불가 사유:</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>이용자의 귀책사유로 인한 서비스 이용 제한</li>
                    <li>이미 소진된 크레딧 또는 리소스</li>
                    <li>프로모션 또는 할인 적용 결제 (별도 환불 정책 적용)</li>
                  </ul>
                </li>
              </ol>
            </section>

            {/* 제9조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제9조 (구독 해지)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>이용자는 언제든지 서비스 내 설정 메뉴에서 구독을 해지할 수 있습니다.</li>
                <li>
                  구독 해지 시 현재 결제 주기가 끝날 때까지 서비스를 계속 이용할 수 있으며, 다음
                  결제일에 자동 결제가 중단됩니다.
                </li>
                <li>
                  해지 후에도 이용자의 데이터는 30일간 보관되며, 이 기간 내에 재구독 시 데이터가
                  복구됩니다.
                </li>
              </ol>
            </section>

            {/* 제10조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제10조 (이용자의 의무)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  이용자는 다음 행위를 하여서는 안 됩니다:
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위</li>
                    <li>서비스를 이용하여 스팸 메일을 발송하는 행위</li>
                    <li>서비스의 운영을 방해하거나 시스템에 과부하를 유발하는 행위</li>
                    <li>회사의 지적재산권을 침해하는 행위</li>
                    <li>기타 관련 법령에 위반되는 행위</li>
                  </ul>
                </li>
                <li>
                  이용자가 본 조를 위반한 경우, 회사는 서비스 이용을 제한하거나 계약을 해지할 수
                  있습니다.
                </li>
              </ol>
            </section>

            {/* 제11조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제11조 (회사의 의무)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  회사는 관련 법령과 이 약관이 금지하거나 공서양속에 반하는 행위를 하지 않으며,
                  계속적이고 안정적으로 서비스를 제공하기 위하여 최선을 다합니다.
                </li>
                <li>
                  회사는 이용자의 개인정보 보호를 위해 보안 시스템을 갖추며, 개인정보처리방침을
                  공시하고 준수합니다.
                </li>
                <li>
                  회사는 서비스 이용과 관련하여 이용자로부터 제기된 의견이나 불만이 정당하다고
                  인정할 경우 이를 처리하여야 합니다.
                </li>
              </ol>
            </section>

            {/* 제12조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제12조 (면책조항)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  회사는 천재지변, 전쟁, 서비스 설비의 장애 또는 서비스 이용의 폭주 등 불가항력적인
                  사유로 서비스를 제공할 수 없는 경우에는 책임이 면제됩니다.
                </li>
                <li>
                  회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.
                </li>
                <li>
                  AI가 생성한 콘텐츠의 정확성, 완전성, 적법성에 대해서는 이용자가 직접 검토할 책임이
                  있으며, 회사는 이에 대해 보증하지 않습니다.
                </li>
              </ol>
            </section>

            {/* 제13조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제13조 (분쟁해결)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  회사와 이용자 간에 발생한 분쟁에 관한 소송은 대한민국 법을 적용하며,
                  대전지방법원을 관할법원으로 합니다.
                </li>
                <li>
                  회사와 이용자 간에 발생한 전자상거래 분쟁에 관하여는 이용자의 신청에 따라
                  공정거래위원회 또는 시/도지사가 의뢰하는 분쟁조정기관의 조정에 따를 수 있습니다.
                </li>
              </ol>
            </section>

            {/* 부칙 */}
            <section className="mb-8 rounded-lg bg-gray-100 p-6">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">부칙</h2>
              <p className="text-gray-700">이 약관은 2026년 1월 13일부터 시행합니다.</p>
            </section>
          </div>
        </article>

        {/* Company Info Footer */}
        <footer className="mt-8 rounded-lg bg-white p-6 text-center text-gray-500 text-sm shadow-sm">
          <p className="font-medium text-gray-700">그린다에이아이주식회사</p>
          <p className="mt-2">대표: 강호진 | 사업자등록번호: 309-88-02709</p>
          <p>통신판매업신고번호: 2024-대전유성-0389</p>
          <p className="mt-2">대전광역시 유성구 대학로 99, 503호 (궁동, 대전팁스타운)</p>
          <p className="mt-2">
            고객센터:{" "}
            <a className="text-blue-600 hover:underline" href="tel:010-6326-9009">
              010-6326-9009
            </a>{" "}
            | 이메일:{" "}
            <a className="text-blue-600 hover:underline" href="mailto:admin@grinda.ai">
              admin@grinda.ai
            </a>
          </p>
        </footer>
      </main>
    </div>
  )
}
