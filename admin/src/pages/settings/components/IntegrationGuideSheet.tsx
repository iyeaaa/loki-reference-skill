/**
 * Integration Guide Sheet Component
 *
 * 방문자 트래킹 API 연동 가이드
 * - 워크스페이스 ID 자동 삽입
 * - 언어별 코드 예제 (점유율 순)
 * - 복사 기능
 */

import { Check, Code2, Copy, ExternalLink } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type IntegrationGuideSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceName: string
  apiBaseUrl?: string
}

// API Base URL (production)
const DEFAULT_API_BASE_URL = "https://api.rinda.ai"

// 언어별 코드 예제 생성 함수들
const generateCodeExamples = (workspaceId: string, apiBaseUrl: string) => ({
  javascript: {
    name: "JavaScript",
    description: "브라우저 환경 (fetch API)",
    popularity: "1위",
    code: `// 방문자 트래킹 스크립트 - 페이지 로드 시 실행
(function() {
  fetch('${apiBaseUrl}/api/v1/visitors/track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: '${workspaceId}',
      landingPage: window.location.href,
      referrer: document.referrer || null,
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Visitor tracked:', data.data.visitorId);
    }
  })
  .catch(error => {
    console.error('Tracking error:', error);
  });
})();`,
  },

  typescript: {
    name: "TypeScript",
    description: "Node.js / Deno 환경",
    popularity: "2위",
    code: `import axios from 'axios';

interface TrackVisitorRequest {
  workspaceId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  landingPage?: string;
}

interface TrackVisitorResponse {
  success: boolean;
  data: {
    tracked: boolean;
    isNewVisitor: boolean;
    visitorId: string;
    visitor: {
      ipAddress: string;
      country: string;
      city: string;
      companyName?: string;
    };
  };
}

async function trackVisitor(
  landingPage: string,
  referrer?: string,
  clientIp?: string
): Promise<TrackVisitorResponse> {
  const response = await axios.post<TrackVisitorResponse>(
    '${apiBaseUrl}/api/v1/visitors/track',
    {
      workspaceId: '${workspaceId}',
      landingPage,
      referrer,
      ipAddress: clientIp, // 서버에서 호출 시 클라이언트 IP 전달
    } satisfies TrackVisitorRequest,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

// 사용 예시
const result = await trackVisitor(
  'https://example.com/landing',
  'https://google.com',
  '203.0.113.50' // 서버 환경에서는 클라이언트 IP 전달
);
console.log(result);`,
  },

  python: {
    name: "Python",
    description: "requests 라이브러리",
    popularity: "3위",
    code: `import requests
from typing import Optional, TypedDict

class VisitorData(TypedDict):
    workspaceId: str
    landingPage: Optional[str]
    referrer: Optional[str]
    ipAddress: Optional[str]

def track_visitor(
    landing_page: str,
    referrer: Optional[str] = None,
    client_ip: Optional[str] = None
) -> dict:
    """
    방문자 트래킹 API 호출

    Args:
        landing_page: 랜딩 페이지 URL
        referrer: 유입 경로 URL
        client_ip: 클라이언트 IP (서버 환경에서 전달)

    Returns:
        API 응답 데이터
    """
    url = "${apiBaseUrl}/api/v1/visitors/track"

    payload: VisitorData = {
        "workspaceId": "${workspaceId}",
        "landingPage": landing_page,
        "referrer": referrer,
        "ipAddress": client_ip,
    }

    response = requests.post(
        url,
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    response.raise_for_status()

    return response.json()

# 사용 예시
if __name__ == "__main__":
    result = track_visitor(
        landing_page="https://example.com/landing",
        referrer="https://google.com",
        client_ip="203.0.113.50"
    )
    print(f"Tracked: {result['data']['tracked']}")
    print(f"Visitor ID: {result['data']['visitorId']}")`,
  },

  java: {
    name: "Java",
    description: "HttpClient (Java 11+)",
    popularity: "4위",
    code: `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class VisitorTracker {
    private static final String API_URL = "${apiBaseUrl}/api/v1/visitors/track";
    private static final String WORKSPACE_ID = "${workspaceId}";

    private final HttpClient client;

    public VisitorTracker() {
        this.client = HttpClient.newHttpClient();
    }

    public String trackVisitor(String landingPage, String referrer, String clientIp)
            throws Exception {
        String jsonBody = String.format("""
            {
                "workspaceId": "%s",
                "landingPage": "%s",
                "referrer": "%s",
                "ipAddress": "%s"
            }
            """, WORKSPACE_ID, landingPage, referrer, clientIp);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_URL))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

        HttpResponse<String> response = client.send(
            request,
            HttpResponse.BodyHandlers.ofString()
        );

        return response.body();
    }

    public static void main(String[] args) throws Exception {
        VisitorTracker tracker = new VisitorTracker();
        String result = tracker.trackVisitor(
            "https://example.com/landing",
            "https://google.com",
            "203.0.113.50"
        );
        System.out.println(result);
    }
}`,
  },

  php: {
    name: "PHP",
    description: "cURL",
    popularity: "5위",
    code: `<?php

/**
 * 방문자 트래킹 함수
 *
 * @param string $landingPage 랜딩 페이지 URL
 * @param string|null $referrer 유입 경로
 * @param string|null $clientIp 클라이언트 IP
 * @return array API 응답
 */
function trackVisitor(
    string $landingPage,
    ?string $referrer = null,
    ?string $clientIp = null
): array {
    $apiUrl = '${apiBaseUrl}/api/v1/visitors/track';
    $workspaceId = '${workspaceId}';

    $data = [
        'workspaceId' => $workspaceId,
        'landingPage' => $landingPage,
        'referrer' => $referrer,
        'ipAddress' => $clientIp ?? $_SERVER['REMOTE_ADDR'] ?? null,
    ];

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("API request failed with status: $httpCode");
    }

    return json_decode($response, true);
}

// 사용 예시
try {
    $result = trackVisitor(
        $_SERVER['REQUEST_URI'],
        $_SERVER['HTTP_REFERER'] ?? null,
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR']
    );

    if ($result['success']) {
        echo "Visitor tracked: " . $result['data']['visitorId'];
    }
} catch (Exception $e) {
    error_log("Tracking error: " . $e->getMessage());
}`,
  },

  csharp: {
    name: "C#",
    description: ".NET HttpClient",
    popularity: "6위",
    code: `using System.Net.Http;
using System.Text;
using System.Text.Json;

public class VisitorTracker
{
    private const string ApiUrl = "${apiBaseUrl}/api/v1/visitors/track";
    private const string WorkspaceId = "${workspaceId}";

    private readonly HttpClient _client;

    public VisitorTracker()
    {
        _client = new HttpClient();
    }

    public record TrackRequest(
        string WorkspaceId,
        string? LandingPage,
        string? Referrer,
        string? IpAddress
    );

    public record TrackResponse(
        bool Success,
        TrackData Data
    );

    public record TrackData(
        bool Tracked,
        bool IsNewVisitor,
        string VisitorId
    );

    public async Task<TrackResponse?> TrackVisitorAsync(
        string landingPage,
        string? referrer = null,
        string? clientIp = null)
    {
        var request = new TrackRequest(
            WorkspaceId,
            landingPage,
            referrer,
            clientIp
        );

        var json = JsonSerializer.Serialize(request, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _client.PostAsync(ApiUrl, content);

        response.EnsureSuccessStatusCode();

        var responseJson = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<TrackResponse>(responseJson, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
    }
}

// 사용 예시 (ASP.NET Core)
// var tracker = new VisitorTracker();
// var result = await tracker.TrackVisitorAsync(
//     Request.Path,
//     Request.Headers["Referer"],
//     HttpContext.Connection.RemoteIpAddress?.ToString()
// );`,
  },

  go: {
    name: "Go",
    description: "net/http 표준 라이브러리",
    popularity: "7위",
    code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

const (
	apiURL      = "${apiBaseUrl}/api/v1/visitors/track"
	workspaceID = "${workspaceId}"
)

type TrackRequest struct {
	WorkspaceID string  \`json:"workspaceId"\`
	LandingPage string  \`json:"landingPage,omitempty"\`
	Referrer    string  \`json:"referrer,omitempty"\`
	IPAddress   string  \`json:"ipAddress,omitempty"\`
}

type TrackResponse struct {
	Success bool \`json:"success"\`
	Data    struct {
		Tracked      bool   \`json:"tracked"\`
		IsNewVisitor bool   \`json:"isNewVisitor"\`
		VisitorID    string \`json:"visitorId"\`
	} \`json:"data"\`
}

func TrackVisitor(landingPage, referrer, clientIP string) (*TrackResponse, error) {
	reqBody := TrackRequest{
		WorkspaceID: workspaceID,
		LandingPage: landingPage,
		Referrer:    referrer,
		IPAddress:   clientIP,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	var result TrackResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func main() {
	result, err := TrackVisitor(
		"https://example.com/landing",
		"https://google.com",
		"203.0.113.50",
	)
	if err != nil {
		fmt.Printf("Error: %v\\n", err)
		return
	}

	fmt.Printf("Tracked: %v, Visitor ID: %s\\n", result.Data.Tracked, result.Data.VisitorID)
}`,
  },

  ruby: {
    name: "Ruby",
    description: "Net::HTTP 표준 라이브러리",
    popularity: "8위",
    code: `require 'net/http'
require 'uri'
require 'json'

class VisitorTracker
  API_URL = '${apiBaseUrl}/api/v1/visitors/track'
  WORKSPACE_ID = '${workspaceId}'

  def self.track(landing_page:, referrer: nil, client_ip: nil)
    uri = URI.parse(API_URL)

    request = Net::HTTP::Post.new(uri)
    request.content_type = 'application/json'
    request.body = {
      workspaceId: WORKSPACE_ID,
      landingPage: landing_page,
      referrer: referrer,
      ipAddress: client_ip
    }.to_json

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    JSON.parse(response.body)
  end
end

# 사용 예시
result = VisitorTracker.track(
  landing_page: 'https://example.com/landing',
  referrer: 'https://google.com',
  client_ip: '203.0.113.50'
)

if result['success']
  puts "Visitor tracked: #{result['data']['visitorId']}"
else
  puts "Tracking failed: #{result['message']}"
end

# Rails에서 사용 예시
# class ApplicationController < ActionController::Base
#   before_action :track_visitor
#
#   private
#
#   def track_visitor
#     VisitorTracker.track(
#       landing_page: request.original_url,
#       referrer: request.referer,
#       client_ip: request.remote_ip
#     )
#   rescue => e
#     Rails.logger.error("Visitor tracking failed: #{e.message}")
#   end
# end`,
  },

  rust: {
    name: "Rust",
    description: "reqwest 크레이트",
    popularity: "9위",
    code: `use reqwest::Client;
use serde::{Deserialize, Serialize};

const API_URL: &str = "${apiBaseUrl}/api/v1/visitors/track";
const WORKSPACE_ID: &str = "${workspaceId}";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrackRequest {
    workspace_id: String,
    landing_page: Option<String>,
    referrer: Option<String>,
    ip_address: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct TrackResponse {
    success: bool,
    data: TrackData,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct TrackData {
    tracked: bool,
    is_new_visitor: bool,
    visitor_id: String,
}

async fn track_visitor(
    landing_page: &str,
    referrer: Option<&str>,
    client_ip: Option<&str>,
) -> Result<TrackResponse, reqwest::Error> {
    let client = Client::new();

    let request = TrackRequest {
        workspace_id: WORKSPACE_ID.to_string(),
        landing_page: Some(landing_page.to_string()),
        referrer: referrer.map(String::from),
        ip_address: client_ip.map(String::from),
    };

    let response = client
        .post(API_URL)
        .json(&request)
        .send()
        .await?
        .json::<TrackResponse>()
        .await?;

    Ok(response)
}

#[tokio::main]
async fn main() {
    match track_visitor(
        "https://example.com/landing",
        Some("https://google.com"),
        Some("203.0.113.50"),
    ).await {
        Ok(result) => {
            println!("Tracked: {}, Visitor ID: {}",
                result.data.tracked,
                result.data.visitor_id
            );
        }
        Err(e) => eprintln!("Error: {}", e),
    }
}`,
  },

  cpp: {
    name: "C++",
    description: "cpr 라이브러리 (libcurl 래퍼)",
    popularity: "10위",
    code: `#include <cpr/cpr.h>
#include <nlohmann/json.hpp>
#include <iostream>
#include <string>

using json = nlohmann::json;

const std::string API_URL = "${apiBaseUrl}/api/v1/visitors/track";
const std::string WORKSPACE_ID = "${workspaceId}";

struct TrackResult {
    bool success;
    bool tracked;
    bool isNewVisitor;
    std::string visitorId;
};

TrackResult trackVisitor(
    const std::string& landingPage,
    const std::string& referrer = "",
    const std::string& clientIp = ""
) {
    json requestBody = {
        {"workspaceId", WORKSPACE_ID},
        {"landingPage", landingPage},
        {"referrer", referrer.empty() ? nullptr : json(referrer)},
        {"ipAddress", clientIp.empty() ? nullptr : json(clientIp)}
    };

    cpr::Response response = cpr::Post(
        cpr::Url{API_URL},
        cpr::Header{{"Content-Type", "application/json"}},
        cpr::Body{requestBody.dump()}
    );

    TrackResult result;

    if (response.status_code == 200) {
        json responseJson = json::parse(response.text);
        result.success = responseJson["success"];
        result.tracked = responseJson["data"]["tracked"];
        result.isNewVisitor = responseJson["data"]["isNewVisitor"];
        result.visitorId = responseJson["data"]["visitorId"];
    } else {
        result.success = false;
    }

    return result;
}

int main() {
    auto result = trackVisitor(
        "https://example.com/landing",
        "https://google.com",
        "203.0.113.50"
    );

    if (result.success) {
        std::cout << "Tracked: " << result.tracked << std::endl;
        std::cout << "Visitor ID: " << result.visitorId << std::endl;
    } else {
        std::cerr << "Tracking failed" << std::endl;
    }

    return 0;
}

// CMakeLists.txt에 추가:
// find_package(cpr REQUIRED)
// find_package(nlohmann_json REQUIRED)
// target_link_libraries(your_target cpr::cpr nlohmann_json::nlohmann_json)`,
  },

  jsp: {
    name: "JSP / Servlet",
    description: "Java HttpURLConnection",
    popularity: "11위",
    code: `<%@ page import="java.io.*, java.net.*" %>
<%@ page contentType="text/html;charset=UTF-8" %>
<%!
    private static final String API_URL = "${apiBaseUrl}/api/v1/visitors/track";
    private static final String WORKSPACE_ID = "${workspaceId}";

    public String trackVisitor(String landingPage, String referrer, String clientIp) {
        try {
            URL url = new URL(API_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            String jsonBody = String.format(
                "{\\"workspaceId\\":\\"%s\\",\\"landingPage\\":\\"%s\\",\\"referrer\\":\\"%s\\",\\"ipAddress\\":\\"%s\\"}",
                WORKSPACE_ID, landingPage, referrer != null ? referrer : "", clientIp
            );

            try (OutputStream os = conn.getOutputStream()) {
                os.write(jsonBody.getBytes("UTF-8"));
            }

            StringBuilder response = new StringBuilder();
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), "UTF-8"))) {
                String line;
                while ((line = br.readLine()) != null) {
                    response.append(line);
                }
            }

            return response.toString();
        } catch (Exception e) {
            return "{\\"success\\": false, \\"error\\": \\"" + e.getMessage() + "\\"}";
        }
    }
%>
<%
    // 방문자 트래킹 실행
    String landingPage = request.getRequestURL().toString();
    String referrer = request.getHeader("Referer");
    String clientIp = request.getHeader("X-Forwarded-For");
    if (clientIp == null) {
        clientIp = request.getRemoteAddr();
    }

    String result = trackVisitor(landingPage, referrer, clientIp);

    // 결과를 세션에 저장하거나 로그로 기록
    application.log("Visitor tracked: " + result);
%>

<!--
Servlet으로 구현 시:

@WebServlet("/track")
public class VisitorTrackingServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
        String landingPage = req.getRequestURL().toString();
        String referrer = req.getHeader("Referer");
        String clientIp = req.getHeader("X-Forwarded-For");
        if (clientIp == null) {
            clientIp = req.getRemoteAddr();
        }

        // trackVisitor 메서드 호출
        trackVisitor(landingPage, referrer, clientIp);
    }
}
-->`,
  },

  html: {
    name: "HTML Script Tag",
    description: "가장 간단한 연동 방법",
    popularity: "빠른 시작",
    code: `<!--
  방문자 트래킹 스크립트
  이 스크립트를 </body> 태그 바로 위에 추가하세요.
-->
<script>
(function() {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '${apiBaseUrl}/api/v1/visitors/track', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({
    workspaceId: '${workspaceId}',
    landingPage: window.location.href,
    referrer: document.referrer || null
  }));
})();
</script>

<!--
  또는 async 방식 (권장):
-->
<script>
(async function() {
  try {
    await fetch('${apiBaseUrl}/api/v1/visitors/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: '${workspaceId}',
        landingPage: window.location.href,
        referrer: document.referrer || null
      })
    });
  } catch (e) {
    // 에러 무시 (사용자 경험에 영향 없음)
  }
})();
</script>`,
  },

  react: {
    name: "React",
    description: "useEffect Hook 활용",
    popularity: "프론트엔드",
    code: `import { useEffect } from 'react';

const WORKSPACE_ID = '${workspaceId}';
const API_URL = '${apiBaseUrl}/api/v1/visitors/track';

/**
 * 방문자 트래킹 훅
 * 컴포넌트 마운트 시 한 번만 실행
 */
export function useVisitorTracking() {
  useEffect(() => {
    const trackVisitor = async () => {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId: WORKSPACE_ID,
            landingPage: window.location.href,
            referrer: document.referrer || null,
          }),
        });

        if (!response.ok) {
          throw new Error(\`HTTP error! status: \${response.status}\`);
        }

        const data = await response.json();

        if (data.success) {
          console.log('Visitor tracked:', data.data.visitorId);
        }
      } catch (error) {
        // 트래킹 실패해도 사용자 경험에 영향 없음
        console.error('Visitor tracking failed:', error);
      }
    };

    trackVisitor();
  }, []); // 빈 의존성 배열 - 마운트 시 한 번만 실행
}

// 사용 예시
// App.tsx 또는 Layout 컴포넌트에서:
function App() {
  useVisitorTracking();

  return (
    <div>
      {/* 앱 내용 */}
    </div>
  );
}

// 또는 특정 랜딩 페이지에서만 사용:
function LandingPage() {
  useVisitorTracking();

  return (
    <main>
      <h1>Welcome!</h1>
    </main>
  );
}`,
  },

  nextjs: {
    name: "Next.js",
    description: "App Router / Pages Router",
    popularity: "프론트엔드",
    code: `// app/layout.tsx (App Router)
'use client';

import { useEffect } from 'react';

const WORKSPACE_ID = '${workspaceId}';
const API_URL = '${apiBaseUrl}/api/v1/visitors/track';

function VisitorTracker() {
  useEffect(() => {
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        landingPage: window.location.href,
        referrer: document.referrer || null,
      }),
    }).catch(() => {
      // 에러 무시
    });
  }, []);

  return null;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <VisitorTracker />
        {children}
      </body>
    </html>
  );
}

// -------------------------------------------
// pages/_app.tsx (Pages Router)
import { useEffect } from 'react';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    fetch('${apiBaseUrl}/api/v1/visitors/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: '${workspaceId}',
        landingPage: window.location.href,
        referrer: document.referrer || null,
      }),
    }).catch(() => {});
  }, []);

  return <Component {...pageProps} />;
}

// -------------------------------------------
// 서버 사이드에서 트래킹 (API Route)
// app/api/track/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip');

  const response = await fetch('${apiBaseUrl}/api/v1/visitors/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId: '${workspaceId}',
      ipAddress: clientIp,
      landingPage: request.headers.get('referer'),
    }),
  });

  return NextResponse.json(await response.json());
}`,
  },

  vue: {
    name: "Vue.js",
    description: "Composition API",
    popularity: "프론트엔드",
    code: `<!-- composables/useVisitorTracking.ts -->
<script setup lang="ts">
import { onMounted } from 'vue';

const WORKSPACE_ID = '${workspaceId}';
const API_URL = '${apiBaseUrl}/api/v1/visitors/track';

export function useVisitorTracking() {
  onMounted(async () => {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: WORKSPACE_ID,
          landingPage: window.location.href,
          referrer: document.referrer || null,
        }),
      });
    } catch (error) {
      // 에러 무시 - 사용자 경험에 영향 없음
      console.error('Visitor tracking failed:', error);
    }
  });
}
</script>

<!-- App.vue -->
<script setup lang="ts">
import { useVisitorTracking } from './composables/useVisitorTracking';

// 앱 전체에서 트래킹
useVisitorTracking();
</script>

<template>
  <div id="app">
    <router-view />
  </div>
</template>

<!-- 또는 플러그인으로 등록 (plugins/visitor-tracking.ts) -->
<script lang="ts">
import type { App } from 'vue';

export default {
  install(app: App) {
    app.mixin({
      mounted() {
        if (this.$options.name === 'App') {
          fetch('${apiBaseUrl}/api/v1/visitors/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceId: '${workspaceId}',
              landingPage: window.location.href,
              referrer: document.referrer || null,
            }),
          }).catch(() => {});
        }
      },
    });
  },
};
</script>`,
  },

  curl: {
    name: "cURL",
    description: "터미널에서 테스트",
    popularity: "테스트",
    code: `# 기본 요청
curl -X POST '${apiBaseUrl}/api/v1/visitors/track' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "workspaceId": "${workspaceId}",
    "landingPage": "https://example.com/landing",
    "referrer": "https://google.com",
    "ipAddress": "203.0.113.50"
  }'

# 응답 예시 (성공)
# {
#   "success": true,
#   "message": "New visitor tracked",
#   "data": {
#     "tracked": true,
#     "isNewVisitor": true,
#     "visitorId": "550e8400-e29b-41d4-a716-446655440000",
#     "ipSource": "body",
#     "visitor": {
#       "ipAddress": "203.0.113.50",
#       "country": "South Korea",
#       "countryCode": "KR",
#       "city": "Seoul",
#       "region": "Seoul",
#       "companyName": "Example Corp",
#       "companyDomain": "example.com",
#       "visitCount": 1
#     }
#   }
# }

# IP 자동 감지 (헤더에서 추출)
curl -X POST '${apiBaseUrl}/api/v1/visitors/track' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Forwarded-For: 203.0.113.50' \\
  -d '{
    "workspaceId": "${workspaceId}",
    "landingPage": "https://example.com"
  }'`,
  },
})

// 언어 그룹 정의
const LANGUAGE_GROUPS = [
  {
    name: "빠른 시작",
    languages: ["html", "curl"],
  },
  {
    name: "프론트엔드",
    languages: ["javascript", "react", "nextjs", "vue"],
  },
  {
    name: "백엔드",
    languages: [
      "typescript",
      "python",
      "java",
      "php",
      "csharp",
      "go",
      "ruby",
      "rust",
      "cpp",
      "jsp",
    ],
  },
]

function CodeBlock({ code, onCopy }: { code: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    onCopy()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <Button
        className="absolute top-2 right-2 h-8 w-8"
        onClick={handleCopy}
        size="icon"
        variant="ghost"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
      <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-slate-50 text-sm">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function IntegrationGuideSheet({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  apiBaseUrl = DEFAULT_API_BASE_URL,
}: IntegrationGuideSheetProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("html")
  const [copiedCount, setCopiedCount] = useState(0)

  const codeExamples = generateCodeExamples(workspaceId, apiBaseUrl)

  const handleCopy = () => {
    setCopiedCount((prev) => prev + 1)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-2xl" side="right">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            방문자 트래킹 연동 가이드
          </SheetTitle>
          <SheetDescription>
            아래 코드를 웹사이트에 추가하면 방문자 데이터 수집이 시작됩니다.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] pr-4">
          <div className="space-y-6">
            {/* 워크스페이스 정보 */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">연동 대상 워크스페이스</p>
                  <p className="text-muted-foreground text-xs">{workspaceName}</p>
                </div>
                <Badge variant="outline">{workspaceId.slice(0, 8)}...</Badge>
              </div>
            </div>

            {/* API 엔드포인트 정보 */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">API 엔드포인트</h3>
              <div className="flex items-center gap-2 rounded-lg border bg-slate-950 p-3">
                <Badge className="bg-green-600">POST</Badge>
                <code className="text-slate-50 text-sm">{apiBaseUrl}/api/v1/visitors/track</code>
              </div>
            </div>

            {/* 필수/선택 파라미터 */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">요청 파라미터</h3>
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">필드</th>
                      <th className="px-3 py-2 text-left">필수</th>
                      <th className="px-3 py-2 text-left">설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-3 py-2 font-mono text-xs">workspaceId</td>
                      <td className="px-3 py-2">
                        <Badge variant="destructive">필수</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">워크스페이스 UUID</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-2 font-mono text-xs">landingPage</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">선택</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">현재 페이지 URL</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-2 font-mono text-xs">referrer</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">선택</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">유입 경로 URL</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-2 font-mono text-xs">ipAddress</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">선택</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        서버 환경에서만 전달 (브라우저는 자동 감지)
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs">userAgent</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">선택</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">브라우저 User-Agent</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 언어별 코드 예제 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">코드 예제</h3>
                {copiedCount > 0 && (
                  <span className="text-muted-foreground text-xs">{copiedCount}회 복사됨</span>
                )}
              </div>

              <Tabs
                defaultValue="html"
                onValueChange={setSelectedLanguage}
                value={selectedLanguage}
              >
                <div className="space-y-3">
                  {LANGUAGE_GROUPS.map((group) => (
                    <div key={group.name}>
                      <p className="mb-1.5 text-muted-foreground text-xs">{group.name}</p>
                      <TabsList className="h-auto flex-wrap justify-start gap-1">
                        {group.languages.map((lang) => {
                          const example = codeExamples[lang as keyof typeof codeExamples]
                          return (
                            <TabsTrigger className="h-7 px-2 text-xs" key={lang} value={lang}>
                              {example.name}
                            </TabsTrigger>
                          )
                        })}
                      </TabsList>
                    </div>
                  ))}
                </div>

                {Object.entries(codeExamples).map(([lang, example]) => (
                  <TabsContent className="mt-4" key={lang} value={lang}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{example.popularity}</Badge>
                        <span className="text-muted-foreground text-sm">{example.description}</span>
                      </div>
                      <CodeBlock code={example.code} onCopy={handleCopy} />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            {/* 주의사항 */}
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
              <h4 className="mb-2 font-semibold text-sm text-yellow-800 dark:text-yellow-200">
                주의사항
              </h4>
              <ul className="space-y-1 text-xs text-yellow-700 dark:text-yellow-300">
                <li>
                  • 브라우저에서 호출 시 IP는 자동으로 감지됩니다 (X-Forwarded-For,
                  CF-Connecting-IP)
                </li>
                <li>• 서버 환경에서는 클라이언트 IP를 직접 전달해야 합니다</li>
                <li>• ISP 트래픽 (가정용 인터넷)은 자동으로 필터링되어 기업 방문자만 수집됩니다</li>
                <li>• 워크스페이스 ID가 변경되면 코드를 업데이트해야 합니다</li>
              </ul>
            </div>

            {/* 문서 링크 */}
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a
                  href="https://docs.rinda.ai/api/visitors"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  API 문서 보기
                </a>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
