import { useTranslation } from "react-i18next"

export default function LeadDiscoveryPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("sidebar.menu.leadDiscovery")}</h1>
        <p className="text-muted-foreground mt-2">고객 탐색 기능이 여기에 구현됩니다.</p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">준비 중입니다.</p>
        </div>
      </div>
    </div>
  )
}
