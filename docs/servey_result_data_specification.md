# Rinda Service Trial : Survey & Result Data Specification

---

## 1. 설문 데이터 구조 (Input Request)
**Endpoint:** `POST /api/v1/trial/submit`

사용자가 입력한 4가지 질문에 대한 요청 본문(Request Body) 구조입니다. (Structure of the request body for the 4 questions answered by the user.)

### **Request Body Schema**

---
json
{
  "industry": "BEAUTY",      // Q1. 산업군 (Industry) - *Determines Market Scenario*
  "targetType": "B2B",       // Q2. 타겟 고객 (Target Audience) - *Determines Email Tone*
  "targetCountry": "JP",     // Q3. 희망 진출 국가 (Target Country) - *Prioritizes List*
  "exportExp": "INITIAL"     // Q4. 수출 경험 (Export Experience) - *Determines Guide/Checklist*
}
---

### **Enum Definitions (선택지 정의 및 로직 매핑)**

#### **Q1. Industry (산업군)**
*Used to determine the 'Market Strategy Scenario' group.*

| Value (Code) | Display Text (KR) | Display Text (EN) | Scenario Group |
| :--- | :--- | :--- | :--- |
| `IT_SW` | IT / 소프트웨어 | IT / Software | **Tech-Driven** |
| `MANUFACTURING` | 제조 / 부품 | Manufacturing / Parts | **Tech-Driven** |
| `BEAUTY` | 뷰티 / 화장품 | Beauty / Cosmetics | **Trend-Driven** |
| `FASHION` | 패션 / 의류 | Fashion / Apparel | **Trend-Driven** |
| `FOOD` | 식품 / 건기식 | Food / Health Supple. | **Trend-Driven** |
| `LIVING` | 생활용품 | Living / Home | **Trend-Driven** |
| `CONTENT` | 콘텐츠 | Content / Media | **General** |
| `OTHER` | 기타 | Other | **General** |

#### **Q2. Target Type (타겟 고객)**
*Used to customize email strategy tone in the result.*

| Value (Code) | Display Text (KR) | Display Text (EN) |
| :--- | :--- | :--- |
| `B2B` | 기업 대상 | Business to Business |
| `B2C` | 소비자 대상 | Business to Consumer |
| `BOTH` | 둘 다 | Both |

#### **Q3. Target Country (희망 국가)**
*Used to prioritize the recommendation list or add specific tag.*

| Value (Code) | Display Text (KR) | Display Text (EN) |
| :--- | :--- | :--- |
| `JP` | 일본 | Japan |
| `US` | 미국 | United States |
| `CN` | 중국 | China |
| `SEA` | 동남아 (베트남, 인도네시아 등) | Southeast Asia (Vietnam, Indonesia, etc.) |
| `EU` | 유럽 (독일, 프랑스, 영국 등) | Europe (Germany, France, UK, etc.) |
| `ME` | 중동 (UAE, 사우디아라비아 등) | Middle East (UAE, Saudi Arabia, etc.) |

#### **Q4. Export Experience (수출 경험)**
*Used to determine 'Linda's Direction' & 'Checklist' content.*

| Value (Code) | Display Text (KR) | Display Text (EN) | Logic |
| :--- | :--- | :--- | :--- |
| `INITIAL` | 처음입니다 | First time | **Beginner Guide** |
| `JUNIOR` | 1~3회 (초기) | 1-3 times (Early stage) | **Beginner Guide** |
| `SENIOR` | 능숙함 (4회 이상) | Experienced (4+ times) | **Pro Guide** |

---

## 2. 결과 리포트 로직 (Business Logic)

백엔드는 입력값을 바탕으로 아래 두 가지 로직을 조합하여 응답을 생성합니다.
(The backend generates the response by combining the following two logic sets based on the input.)

### **A. 시나리오 매핑 (Scenario Mapping by Q1)**
산업군(Industry)에 따라 추천 국가와 세일즈 전략이 결정됩니다.

* **Trend-Driven Group (Beauty, Fashion, Food, Living)**
    * **Key Markets:** Japan (JP), Southeast Asia (SEA), USA (US)
    * **Strategy Keywords:** Visuals, Trends, Samples, Influencers, Offline Pop-up
* **Tech-Driven Group (IT, Manufacturing, Parts)**
    * **Key Markets:** USA (US), Europe (EU), Middle East (ME)
    * **Strategy Keywords:** Specs, ROI, Certifications, Reliability, Cost Reduction

### **B. 가이드 매핑 (Guide Mapping by Q4)**
수출 경험(Experience)에 따라 린다의 솔루션 제안과 체크리스트가 변경됩니다.

* **Beginner (Initial/Junior):**
    * **Focus:** Preparation basics (Catalog, Pricing), Finding buyers, Sending Samples.
    * **Tone:** Supportive, Educational.
* **Pro (Senior):**
    * **Focus:** Automation, Scaling, Efficiency, CRM Integration.
    * **Tone:** Professional, Efficient.

---

## 3. 결과 리포트 데이터 구조 (Response Data Structure)
**Response Status:** `200 OK`

프론트엔드 UI 렌더링을 위한 최종 JSON 구조입니다.
(Final JSON structure for Frontend UI rendering. Supports multi-language.)

--- json
{
  "status": "success",
  "data": {
    // [UI Header] User Context (사용자 입력 요약)
    "userContext": {
      "industryLabel": "Beauty / Cosmetics",
      "experienceLabel": "First time Export"
    },

    // [Section 1] Linda's Direction & Checklist (Determined by Q4 Logic)
    // 수출 경험(Q4)에 따라 달라지는 고정 가이드 데이터
    "lindaSolution": {
      "directionTitle": {
        "kr": "수출 초보시군요? 린다가 바이어 발굴부터 도와드려요.",
        "en": "New to export? Linda helps from buyer sourcing to contact."
      },
      "actionSteps": [
        {
          "step": 1,
          "text_kr": "타겟 국가 바이어 DB 자동 매칭",
          "text_en": "Auto-match with target country buyer DB"
        },
        {
          "step": 2,
          "text_kr": "제품 감성에 맞는 메일 초안 작성",
          "text_en": "Draft AI emails tailored to product mood"
        },
        {
          "step": 3,
          "text_kr": "샘플 발송 및 피드백 자동 관리",
          "text_en": "Automate sample tracking & feedback"
        }
      ],
      "checklist": [
        { "item_kr": "영문/일문 회사소개서 (PDF)", "item_en": "Eng/Jpn Company Profile (PDF)" },
        { "item_kr": "해외 배송용 샘플 패키지", "item_en": "Sample package for overseas shipping" },
        { "item_kr": "MOQ 및 FOB 기준 가격표", "item_en": "Price list (MOQ & FOB based)" }
      ]
    },

    // [Section 2] Market Recommendations (Determined by Q1 Logic)
    // 산업군(Q1)에 따라 미리 정의된 TOP 3 국가 데이터
    "recommendedMarkets": [
      {
        "rank": 1,
        "countryCode": "JP",
        "countryName": "Japan",
        "isBestMatch": true,  // Badge rendering trigger (Best Match)

        // 1. Why recommended (Market Analysis)
        "reasonTitle": {
          "kr": "브랜드 스토리와 디테일을 중시하는 시장",
          "en": "A market valuing brand story and details"
        },
        // 상세 분석 텍스트 (UI 가독성을 위해 Trend와 Strategy 분리)
        "marketTrend": {
          "kr": "패키지 디자인과 성분을 꼼꼼히 확인하며, 오프라인 편집숍 입점이 주요 트렌드입니다.",
          "en": "Scrutinizes packaging & ingredients; offline select shop entry is a key trend."
        },

        // 2. How to sell (Linda's Strategy)
        "salesStrategy": {
          "kr": "텍스트 설명보다 고화질 '룩북'과 '샘플 제안'이 필수적입니다.",
          "en": "High-res 'Lookbooks' & 'Sample offers' work better than text-heavy descriptions."
        },

        // 3. Email Action Plan
        "emailStrategy": {
          "subjectLine": "Exclusive Proposal: K-Beauty Trend for [Company]",
          "keyFocus": {
            "kr": "시각적 자료(Visuals) + 무료 샘플 제안",
            "en": "Visual Assets + Free Sample Proposal"
          }
        },

        // 4. Projected Metrics (Optional for graph visualization)
        "metrics": {
          "openRate": 45,
          "responseRate": 6.2
        }
      },
      {
        "rank": 2,
        "countryCode": "US",
        "countryName": "United States",
        "isBestMatch": false,
        "reasonTitle": {
          "kr": "클린 뷰티 및 인디 브랜드 수요 폭발",
          "en": "High demand for Clean Beauty & Indie Brands"
        },
        "marketTrend": {
          "kr": "틱톡/릴스 등 숏폼 마케팅과 연계된 B2B 소싱이 활발합니다.",
          "en": "B2B sourcing linked with short-form marketing (TikTok/Reels) is active."
        },
        "salesStrategy": {
          "kr": "FDA 등록 여부와 현지 물류(3PL) 가능성을 강조하세요.",
          "en": "Highlight FDA registration & local logistics (3PL) capabilities."
        },
        "emailStrategy": {
          "subjectLine": "Next Viral Brand: Partnership Opportunity",
          "keyFocus": {
            "kr": "소셜 증명(Social Proof) + 성분 안전성",
            "en": "Social Proof + Ingredient Safety"
          }
        },
        "metrics": {
          "openRate": 33,
          "responseRate": 5.1
        }
      }
      // Rank 3 object follows...
    ]
  }
}
---

## 4. 시나리오 데이터 예시 (Content Seed Data)
개발 시 DB 초기 데이터(Seeding)로 사용할 예시 텍스트입니다. (Example text for DB seeding during development.)

### **Scenario A: Beauty/Fashion (Trend-Driven)**
* **Target:** Japan (Rank 1)
* **Market Trend:** Visual-first, Sample verification, K-Brand preference.
* **Sales Strategy:** "Show, don't just tell." Use Lookbooks. Soft approach (Sample first).
* **Checklist:** Lookbook (PDF), Sample Box, Instagram Portfolio.

### **Scenario B: Manufacturing/IT (Tech-Driven)**
* **Target:** USA or Germany (Rank 1)
* **Market Trend:** ROI-focused, Spec verification, Supply chain stability.
* **Sales Strategy:** "Prove with Data." Use Whitepapers/Case Studies. Direct approach (Cost reduction).
* **Checklist:** Tech Sheet/Spec, ISO Certifications, English Website, Reference List.


1일차 - 시퀀스 A, 1스텝
2일차 - 시퀀스 B, 1스텝
3일차 - 시퀀스 C, 1스텝
4일차 - 시퀀스 A, 2스텝
5일차 - 시퀀스 B, 2스텝
6일차 - 시퀀스 C, 2스텝


7일차 - 시퀀스 D, 1스텝
8일차 - 시퀀스 E, 1스텝
9일차 - 시퀀스 F, 1스텝
10일차 - 시퀀스 D, 2스텝
11일차 - 시퀀스 E, 2스텝
12일차 - 시퀀스 F, 2스텝
