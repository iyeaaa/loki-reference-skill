/**
 * 개인정보 처리방침 페이지
 * 2026년 개인정보 보호법 기준
 */

import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

export default function PrivacyPage() {
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
          <h1 className="mb-2 font-bold text-2xl text-gray-900">개인정보 처리방침</h1>
          <p className="mb-8 text-gray-500 text-sm">
            시행일: 2026년 1월 13일 | 최종 수정: 2026년 1월 13일
          </p>

          <div className="prose prose-gray max-w-none">
            {/* 서문 */}
            <section className="mb-8">
              <p className="text-gray-700 leading-relaxed">
                그린다에이아이주식회사(이하 "회사")는 「개인정보 보호법」 제30조에 따라 정보주체의
                개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기
                위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
              </p>
            </section>

            {/* 제1조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제1조 (개인정보의 처리 목적)
              </h2>
              <p className="mb-4 text-gray-700">
                회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의
                목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를
                받는 등 필요한 조치를 이행합니다.
              </p>
              <ol className="list-decimal space-y-3 pl-5 text-gray-700">
                <li>
                  <strong>회원 가입 및 관리:</strong> 회원 가입의사 확인, 회원제 서비스 제공에 따른
                  본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 각종 고지·통지, 고충처리
                </li>
                <li>
                  <strong>서비스 제공:</strong> AI 기반 리드 발굴, 이메일 자동화, 다국어 번역,
                  캠페인 분석 등 서비스 제공, 콘텐츠 제공, 맞춤 서비스 제공
                </li>
                <li>
                  <strong>결제 및 정산:</strong> 유료 서비스 이용에 따른 요금 결제·정산, 구독 관리,
                  환불 처리
                </li>
                <li>
                  <strong>마케팅 및 광고:</strong> 신규 서비스 안내, 이벤트 및 광고성 정보 제공
                  (동의 시)
                </li>
              </ol>
            </section>

            {/* 제2조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제2조 (수집하는 개인정보 항목)
              </h2>

              <div className="mb-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 text-sm">
                        구분
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 text-sm">
                        수집 항목
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 text-sm">
                        수집 방법
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-900 text-sm">필수정보</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        이메일, 이름, 회사명, 비밀번호(자체 가입 시)
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">회원가입, 소셜 로그인</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-900 text-sm">결제정보</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        결제수단 정보(카드사명, 카드번호 일부), 결제 금액, 결제 일시
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">결제 시 수집</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-900 text-sm">자동수집</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        IP주소, 브라우저 정보, 접속 기록, 쿠키, 서비스 이용 기록
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">서비스 이용 시 자동 수집</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-blue-800 text-sm">
                  <strong>결제 정보 보안 안내:</strong> 신용카드 번호, CVC 등 민감한 결제 정보는
                  회사가 직접 저장하지 않습니다. 모든 결제는 PCI-DSS 인증을 받은 토스페이먼츠 결제
                  서비스를 통해 안전하게 처리됩니다.
                </p>
              </div>
            </section>

            {/* 제3조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제3조 (개인정보의 처리 및 보유 기간)
              </h2>
              <p className="mb-4 text-gray-700">
                회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에
                동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 text-sm">
                        항목
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 text-sm">
                        보유 기간
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 text-sm">
                        근거
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr>
                      <td className="px-4 py-3 text-gray-700 text-sm">회원 정보</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">회원 탈퇴 시까지</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">정보주체 동의</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-gray-700 text-sm">계약/구독 기록</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">5년</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">전자상거래법 제6조</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-gray-700 text-sm">결제 및 대금결제 기록</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">5년</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">전자상거래법 제6조</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        소비자 불만/분쟁 처리 기록
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">3년</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">전자상거래법 제6조</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-gray-700 text-sm">접속 기록</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">1년</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">통신비밀보호법 제15조의2</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 제4조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제4조 (개인정보의 제3자 제공)
              </h2>
              <p className="mb-4 text-gray-700">
                회사는 원칙적으로 정보주체의 개인정보를 수집·이용 목적으로 명시한 범위 내에서
                처리하며, 다음의 경우를 제외하고는 정보주체의 사전 동의 없이 본래의 목적 범위를
                초과하여 처리하거나 제3자에게 제공하지 않습니다.
              </p>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>정보주체로부터 별도의 동의를 받은 경우</li>
                <li>법률에 특별한 규정이 있는 경우</li>
                <li>
                  정보주체 또는 그 법정대리인이 의사표시를 할 수 없는 상태에 있거나 주소불명 등으로
                  사전 동의를 받을 수 없는 경우로서 명백히 정보주체 또는 제3자의 급박한 생명, 신체,
                  재산의 이익을 위하여 필요하다고 인정되는 경우
                </li>
              </ol>
            </section>

            {/* 제5조 - 결제 관련 위탁 */}
            <section className="mb-8 rounded-lg bg-amber-50 p-6">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제5조 (개인정보 처리의 위탁)
              </h2>
              <p className="mb-4 text-gray-700">
                회사는 원활한 서비스 제공을 위하여 다음과 같이 개인정보 처리업무를 위탁하고
                있습니다.
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 text-sm">
                        수탁업체
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 text-sm">
                        위탁 업무
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 text-sm">
                        보유 기간
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-gray-700 text-sm">토스페이먼츠㈜</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">결제 처리 및 대행</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">위탁 계약 종료 시</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-gray-700 text-sm">Amazon Web Services, Inc.</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">클라우드 서버 운영</td>
                      <td className="px-4 py-3 text-gray-700 text-sm">위탁 계약 종료 시</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 제6조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제6조 (정보주체의 권리·의무 및 행사방법)
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수
                  있습니다:
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>개인정보 열람 요구</li>
                    <li>오류 등이 있을 경우 정정 요구</li>
                    <li>삭제 요구</li>
                    <li>처리정지 요구</li>
                  </ul>
                </li>
                <li>
                  권리 행사는 서면, 전자우편, 고객센터를 통하여 하실 수 있으며, 회사는 이에 대해
                  지체없이 조치하겠습니다.
                </li>
                <li>
                  권리 행사는 정보주체의 법정대리인이나 위임을 받은 자 등 대리인을 통하여 하실 수도
                  있습니다.
                </li>
              </ol>
            </section>

            {/* 제7조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">제7조 (개인정보의 파기)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을
                  때에는 지체없이 해당 개인정보를 파기합니다.
                </li>
                <li>
                  전자적 파일 형태의 정보는 복구 및 재생할 수 없도록 기술적 방법을 사용하여 완전하게
                  삭제하고, 기록물, 인쇄물, 서면 등은 분쇄하거나 소각하여 파기합니다.
                </li>
              </ol>
            </section>

            {/* 제8조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제8조 (개인정보의 안전성 확보 조치)
              </h2>
              <p className="mb-4 text-gray-700">
                회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-gray-700">
                <li>
                  <strong>관리적 조치:</strong> 내부관리계획 수립·시행, 직원 교육 등
                </li>
                <li>
                  <strong>기술적 조치:</strong> 개인정보처리시스템 접근권한 관리, 암호화 기술 적용,
                  보안프로그램 설치
                </li>
                <li>
                  <strong>물리적 조치:</strong> 전산실, 자료보관실 등의 접근 통제
                </li>
              </ul>
            </section>

            {/* 제9조 */}
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제9조 (쿠키의 설치·운영 및 거부)
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-gray-700">
                <li>
                  회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로
                  불러오는 '쿠키(cookie)'를 사용합니다.
                </li>
                <li>
                  쿠키는 웹사이트를 운영하는데 이용되는 서버가 이용자의 컴퓨터 브라우저에게 보내는
                  소량의 정보이며 이용자 컴퓨터의 하드디스크에 저장됩니다.
                </li>
                <li>
                  이용자는 쿠키 설치에 대한 선택권을 가지고 있습니다. 웹브라우저에서 옵션을
                  설정함으로써 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 모든
                  쿠키의 저장을 거부할 수 있습니다.
                </li>
              </ol>
            </section>

            {/* 제10조 */}
            <section className="mb-8 rounded-lg bg-gray-100 p-6">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                제10조 (개인정보 보호책임자)
              </h2>
              <p className="mb-4 text-gray-700">
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한
                정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를
                지정하고 있습니다.
              </p>

              <div className="rounded-lg bg-white p-4">
                <p className="font-medium text-gray-900">개인정보 보호책임자</p>
                <ul className="mt-2 space-y-1 text-gray-700">
                  <li>성명: 강호진</li>
                  <li>직책: 대표이사</li>
                  <li>
                    연락처:{" "}
                    <a className="text-blue-600 hover:underline" href="tel:010-6326-9009">
                      010-6326-9009
                    </a>
                  </li>
                  <li>
                    이메일:{" "}
                    <a className="text-blue-600 hover:underline" href="mailto:admin@grinda.ai">
                      admin@grinda.ai
                    </a>
                  </li>
                </ul>
              </div>
            </section>

            {/* 부칙 */}
            <section className="mb-8 rounded-lg bg-gray-100 p-6">
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">부칙</h2>
              <p className="text-gray-700">
                이 개인정보 처리방침은 2026년 1월 13일부터 시행합니다.
              </p>
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
