import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EnvTestPage() {
  const envVars = Object.keys(import.meta.env).reduce((acc, key) => {
    acc[key] = import.meta.env[key];
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>환경변수 테스트 페이지</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">현재 설정된 환경변수</h3>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(envVars, null, 2)}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">주요 환경변수</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">VITE_API_URL:</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    {import.meta.env.VITE_API_URL || "Not Set"}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">MODE:</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    {import.meta.env.MODE}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">DEV:</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    {import.meta.env.DEV ? "true" : "false"}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">PROD:</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    {import.meta.env.PROD ? "true" : "false"}
                  </code>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">API 엔드포인트 테스트</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Base URL:</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    {import.meta.env.VITE_API_URL || "http://localhost:9888"}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Departments Endpoint:</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                    {(import.meta.env.VITE_API_URL || "http://localhost:9888") + "/api/v1/public/departments"}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}