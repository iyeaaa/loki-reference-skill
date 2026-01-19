/**
 * Integration Guide Sheet Component
 *
 * 방문자 트래킹 API 연동 가이드
 * - 워크스페이스 ID 자동 삽입
 * - 언어별 코드 예제 (점유율 순)
 * - 복사 기능
 * - Modern 2025 UI with syntax highlighting
 */

import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  Zap,
} from "lucide-react"
import { useState } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { API_BASE_URL } from "@/lib/env"
import { cn } from "@/lib/utils"

type IntegrationGuideSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceName: string
  apiBaseUrl?: string
}

// API Base URL (production)
const DEFAULT_API_BASE_URL = "https://api.rinda.ai"

// Language to Prism language mapping
const LANGUAGE_MAP: Record<string, string> = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  java: "java",
  php: "php",
  csharp: "csharp",
  go: "go",
  ruby: "ruby",
  rust: "rust",
  cpp: "cpp",
  jsp: "java",
  html: "html",
  react: "jsx",
  nextjs: "tsx",
  vue: "html",
  curl: "bash",
}

// 언어별 코드 예제 생성 함수들
const generateCodeExamples = (workspaceId: string, apiBaseUrl: string) => ({
  javascript: {
    name: "JavaScript",
    description: "브라우저 환경 (fetch API)",
    popularity: "1위",
    icon: "🟨",
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
    icon: "🔷",
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
    icon: "🐍",
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
    icon: "☕",
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
    icon: "🐘",
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
    icon: "🟣",
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
    icon: "🐹",
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
    icon: "💎",
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
    icon: "🦀",
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
    icon: "⚡",
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
    icon: "📄",
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
%>`,
  },

  html: {
    name: "HTML Script Tag",
    description: "가장 간단한 연동 방법",
    popularity: "빠른 시작",
    icon: "🌐",
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
    icon: "⚛️",
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
}`,
  },

  nextjs: {
    name: "Next.js",
    description: "App Router / Pages Router",
    popularity: "프론트엔드",
    icon: "▲",
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
    icon: "💚",
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
</template>`,
  },

  curl: {
    name: "cURL",
    description: "터미널에서 테스트",
    popularity: "테스트",
    icon: "🔧",
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

// Modern Code Block with Syntax Highlighting
function CodeBlock({
  code,
  language,
  onCopy,
}: {
  code: string
  language: string
  onCopy: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    onCopy()
    setTimeout(() => setCopied(false), 2000)
  }

  const prismLanguage = LANGUAGE_MAP[language] || "text"

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-[#282c34] shadow-2xl">
      {/* Header bar with file type indicator */}
      <div className="flex items-center justify-between border-slate-700/50 border-b bg-slate-800/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>
          <span className="ml-2 font-mono text-slate-400 text-xs">{prismLanguage}</span>
        </div>
        <Button
          className={cn(
            "h-8 gap-1.5 rounded-lg border-0 px-3 font-medium text-xs transition-all duration-200",
            copied
              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white",
          )}
          onClick={handleCopy}
          size="sm"
          variant="ghost"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              복사됨
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              복사
            </>
          )}
        </Button>
      </div>
      {/* Code content with syntax highlighting */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "0.8125rem",
            lineHeight: "1.6",
          }}
          language={prismLanguage}
          showLineNumbers
          style={oneDark}
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

// API 테스트 결과 타입
type ApiTestResult = {
  success: boolean
  data?: {
    tracked: boolean
    isNewVisitor: boolean
    visitorId?: string
    skipped?: boolean
    skipReason?: string
    visitor?: {
      ipAddress: string
      country: string
      countryCode: string
      city: string
      companyName?: string
      companyDomain?: string
    }
  }
  error?: string
  responseTime?: number
}

// Modern Language Button
function LanguageButton({
  example,
  isSelected,
  onClick,
}: {
  example: { name: string; icon: string }
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all duration-200",
        isSelected
          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/25 shadow-lg"
          : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-600 dark:hover:bg-blue-950/50 dark:hover:text-blue-400",
      )}
      onClick={onClick}
      type="button"
    >
      <span>{example.icon}</span>
      <span>{example.name}</span>
    </button>
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

  // API 테스트 상태
  const [isTestLoading, setIsTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<ApiTestResult | null>(null)
  const [showTestInputs, setShowTestInputs] = useState(false)

  // 테스트 입력 필드 (프로덕션 예시 데이터 기본값)
  const [testIpAddress, setTestIpAddress] = useState("166.104.168.42") // 예시: 한양대학교 (education)
  const [testLandingPage, setTestLandingPage] = useState("https://rinda.ai/features")
  const [testReferrer, setTestReferrer] = useState("https://www.google.com")

  const codeExamples = generateCodeExamples(workspaceId, apiBaseUrl)

  const handleCopy = () => {
    setCopiedCount((prev) => prev + 1)
  }

  // 라이브 API 테스트 실행 (현재 origin 사용 - CSP 우회)
  const handleApiTest = async () => {
    setIsTestLoading(true)
    setTestResult(null)

    const startTime = performance.now()

    try {
      // API_BASE_URL 사용 (프로덕션에서는 현재 origin, 개발에서는 proxy)
      const response = await fetch(`${API_BASE_URL}/api/v1/visitors/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          ipAddress: testIpAddress || undefined,
          landingPage: testLandingPage || window.location.href,
          referrer: testReferrer || document.referrer || null,
        }),
      })

      const responseTime = Math.round(performance.now() - startTime)
      const data = await response.json()

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          data: data.data,
          responseTime,
        })
      } else {
        setTestResult({
          success: false,
          error: data.message || `HTTP ${response.status}`,
          responseTime,
        })
      }
    } catch (error) {
      const responseTime = Math.round(performance.now() - startTime)
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "네트워크 오류",
        responseTime,
      })
    } finally {
      setIsTestLoading(false)
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-2xl" side="right">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2.5 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25 shadow-lg">
              <Code2 className="h-4 w-4 text-white" />
            </div>
            방문자 트래킹 연동 가이드
          </SheetTitle>
          <SheetDescription className="text-sm">
            아래 코드를 웹사이트에 추가하면 방문자 데이터 수집이 시작됩니다.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] pr-4">
          <div className="space-y-8">
            {/* ========================================== */}
            {/* 1. 연동 테스트 */}
            {/* ========================================== */}
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-xs">
                  1
                </div>
                <h3 className="font-semibold text-base">연동 테스트</h3>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200/50 bg-gradient-to-br from-slate-50 to-slate-100/50 shadow-sm dark:border-slate-700/50 dark:from-slate-800/50 dark:to-slate-900/50">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 font-medium text-slate-500 text-xs uppercase tracking-wide dark:text-slate-400">
                        연동 워크스페이스
                      </p>
                      <p className="truncate font-semibold text-slate-900 text-sm dark:text-white">
                        {workspaceName}
                      </p>
                      <p className="font-mono text-slate-500 text-xs dark:text-slate-400">
                        {workspaceId}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        className="h-8 w-8 rounded-lg"
                        onClick={() => setShowTestInputs(!showTestInputs)}
                        size="icon"
                        variant="ghost"
                      >
                        {showTestInputs ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        className={cn(
                          "h-9 gap-2 rounded-lg font-medium text-sm shadow-lg transition-all duration-300",
                          testResult?.success
                            ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25 hover:from-green-600 hover:to-emerald-600"
                            : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700",
                        )}
                        disabled={isTestLoading}
                        onClick={handleApiTest}
                      >
                        {isTestLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : testResult?.success ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            연동 성공
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4" />
                            테스트 실행
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* 테스트 입력 필드 */}
                  {showTestInputs && (
                    <div className="mt-4 space-y-3 border-slate-200/50 border-t pt-4 dark:border-slate-700/50">
                      <p className="text-slate-500 text-xs dark:text-slate-400">
                        테스트할 값을 입력하세요. 비워두면 기본값이 사용됩니다.
                      </p>
                      <div className="grid gap-3">
                        <div className="space-y-1.5">
                          <Label className="font-medium text-xs" htmlFor="test-ip">
                            IP 주소
                          </Label>
                          <Input
                            className="h-9 rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800"
                            id="test-ip"
                            onChange={(e) => setTestIpAddress(e.target.value)}
                            placeholder="예: 166.104.168.42"
                            value={testIpAddress}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="font-medium text-xs" htmlFor="test-landing">
                            랜딩 페이지
                          </Label>
                          <Input
                            className="h-9 rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800"
                            id="test-landing"
                            onChange={(e) => setTestLandingPage(e.target.value)}
                            placeholder="예: https://rinda.ai/features"
                            value={testLandingPage}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="font-medium text-xs" htmlFor="test-referrer">
                            유입 경로 (Referrer)
                          </Label>
                          <Input
                            className="h-9 rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800"
                            id="test-referrer"
                            onChange={(e) => setTestReferrer(e.target.value)}
                            placeholder="예: https://www.google.com"
                            value={testReferrer}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 테스트 결과 - Modern Style */}
                  {testResult && (
                    <div className="mt-4 border-slate-200/50 border-t pt-4 dark:border-slate-700/50">
                      {testResult.success ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                            </div>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {testResult.data?.skipped
                                ? `ISP 필터링: ${testResult.data.skipReason}`
                                : testResult.data?.isNewVisitor
                                  ? "새 방문자 등록됨"
                                  : "기존 방문자 업데이트"}
                            </span>
                            {testResult.responseTime && (
                              <Badge className="ml-auto" variant="secondary">
                                {testResult.responseTime}ms
                              </Badge>
                            )}
                          </div>
                          {testResult.data?.visitor && !testResult.data.skipped && (
                            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800">
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">IP:</span>{" "}
                                <span className="font-medium">
                                  {testResult.data.visitor.ipAddress}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">위치:</span>{" "}
                                <span className="font-medium">
                                  {testResult.data.visitor.city || testResult.data.visitor.country}
                                </span>
                              </div>
                              {testResult.data.visitor.companyName && (
                                <div className="col-span-2">
                                  <span className="text-slate-500 dark:text-slate-400">회사:</span>{" "}
                                  <span className="font-medium">
                                    {testResult.data.visitor.companyName}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/10">
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                          </div>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {testResult.error}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-slate-200 border-t dark:border-slate-700" />
              </div>
            </div>

            {/* ========================================== */}
            {/* 2. API 엔드포인트 */}
            {/* ========================================== */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-xs">
                  2
                </div>
                <h3 className="font-semibold text-base">API 엔드포인트</h3>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 shadow-xl">
                <Badge className="shrink-0 rounded-md bg-gradient-to-r from-green-500 to-emerald-500 px-2.5 py-1 font-bold text-white text-xs shadow-green-500/25 shadow-lg">
                  POST
                </Badge>
                <code className="overflow-hidden text-ellipsis text-slate-100 text-sm">
                  {apiBaseUrl}/api/v1/visitors/track
                </code>
                <a
                  className="ml-auto shrink-0 text-slate-400 hover:text-white"
                  href={`${apiBaseUrl}/api/v1/visitors/track`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              {/* 필수/선택 파라미터 - Modern Table */}
              <div className="space-y-3">
                <h4 className="font-medium text-slate-600 text-sm dark:text-slate-400">
                  요청 파라미터
                </h4>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide dark:text-slate-300">
                          필드
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide dark:text-slate-300">
                          필수
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide dark:text-slate-300">
                          설명
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      <tr className="bg-white dark:bg-slate-900">
                        <td className="px-4 py-3 font-mono text-blue-600 text-xs dark:text-blue-400">
                          workspaceId
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="rounded-md bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm">
                            필수
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          워크스페이스 UUID
                        </td>
                      </tr>
                      <tr className="bg-white dark:bg-slate-900">
                        <td className="px-4 py-3 font-mono text-blue-600 text-xs dark:text-blue-400">
                          landingPage
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="rounded-md" variant="secondary">
                            선택
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          현재 페이지 URL
                        </td>
                      </tr>
                      <tr className="bg-white dark:bg-slate-900">
                        <td className="px-4 py-3 font-mono text-blue-600 text-xs dark:text-blue-400">
                          referrer
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="rounded-md" variant="secondary">
                            선택
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          유입 경로 URL
                        </td>
                      </tr>
                      <tr className="bg-white dark:bg-slate-900">
                        <td className="px-4 py-3 font-mono text-blue-600 text-xs dark:text-blue-400">
                          ipAddress
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="rounded-md" variant="secondary">
                            선택
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          서버 환경에서만 전달
                        </td>
                      </tr>
                      <tr className="bg-white dark:bg-slate-900">
                        <td className="px-4 py-3 font-mono text-blue-600 text-xs dark:text-blue-400">
                          userAgent
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="rounded-md" variant="secondary">
                            선택
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          브라우저 User-Agent
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-slate-200 border-t dark:border-slate-700" />
              </div>
            </div>

            {/* ========================================== */}
            {/* 3. 코드 연동 예제 */}
            {/* ========================================== */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-xs">
                    3
                  </div>
                  <h3 className="font-semibold text-base">코드 연동 예제</h3>
                </div>
                {copiedCount > 0 && (
                  <Badge className="gap-1 rounded-full" variant="secondary">
                    <Copy className="h-3 w-3" />
                    {copiedCount}회 복사됨
                  </Badge>
                )}
              </div>

              <Tabs
                defaultValue="html"
                onValueChange={setSelectedLanguage}
                value={selectedLanguage}
              >
                <div className="space-y-4">
                  {LANGUAGE_GROUPS.map((group) => (
                    <div key={group.name}>
                      <p className="mb-2 font-medium text-slate-500 text-xs uppercase tracking-wide dark:text-slate-400">
                        {group.name}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.languages.map((lang) => {
                          const example = codeExamples[lang as keyof typeof codeExamples]
                          return (
                            <LanguageButton
                              example={example}
                              isSelected={selectedLanguage === lang}
                              key={lang}
                              onClick={() => setSelectedLanguage(lang)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {Object.entries(codeExamples).map(([lang, example]) => (
                  <TabsContent className="mt-4" key={lang} value={lang}>
                    <div className="space-y-3">
                      <p className="text-slate-600 text-sm dark:text-slate-400">
                        {example.description}
                      </p>
                      <CodeBlock code={example.code} language={lang} onCopy={handleCopy} />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-slate-200 border-t dark:border-slate-700" />
              </div>
            </div>

            {/* ========================================== */}
            {/* 4. 주의사항 */}
            {/* ========================================== */}
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-xs">
                  4
                </div>
                <h3 className="font-semibold text-base">주의사항</h3>
              </div>
              <div className="overflow-hidden rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-yellow-50/50 dark:border-amber-900/50 dark:from-amber-950/50 dark:to-yellow-950/30">
                <div className="p-4">
                  <ul className="space-y-1.5 text-amber-700 text-xs dark:text-amber-300">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                      브라우저에서 호출 시 IP는 자동으로 감지됩니다 (X-Forwarded-For,
                      CF-Connecting-IP)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                      서버 환경에서는 클라이언트 IP를 직접 전달해야 합니다
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                      ISP 트래픽 (가정용 인터넷)은 자동으로 필터링되어 기업 방문자만 수집됩니다
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                      워크스페이스 고유 ID를 기반으로 방문자 트래픽이 관리됩니다
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
