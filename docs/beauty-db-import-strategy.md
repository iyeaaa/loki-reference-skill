# 뷰티 DB 데이터 임포트 전략

## 1. 개요

이 문서는 `뷰티-DB-최종.xlsx` 파일의 "뷰티-DB-통합데이터" 시트에 있는 111,187개의 리드 데이터를 PostgreSQL 데이터베이스로 임포트하는 전략을 설명합니다.

## 2. 데이터 소스 분석

### 2.1 실제 데이터 통계 (111,187개 레코드)

#### NULL 비율 분석 (높은 순서)
| 컬럼명 | NULL 비율 | 실제 데이터 개수 | 비고 |
|--------|-----------|----------------|------|
| twitter_url | 89.3% | 11,856 | 거의 대부분 NULL |
| linkedin_url | 88.8% | 12,490 | 거의 대부분 NULL |
| founded_year | 79.2% | 23,142 | 설립연도 정보 부족 |
| instagram_url | 68.5% | 34,980 | 약 31% 보유 |
| facebook_url | 67.9% | 35,736 | 약 32% 보유 |
| state | 65.5% | 38,367 | 주/도 정보 부족 |
| address | 65.3% | 38,580 | 주소 정보 부족 |
| email | 63.5% | 40,556 | **중요**: 이메일 36.5%만 보유 |
| phone_number | 62.1% | 42,133 | **중요**: 전화번호 37.9%만 보유 |
| city | 60.0% | 44,516 | 도시 정보 부족 |
| error_message | 53.1% | 52,177 | 약 절반에 에러 존재 |
| product_categories | 50.3% | 55,257 | 약 절반만 카테고리 보유 |
| employee_count | 49.4% | 56,283 | 약 절반만 직원수 보유 |
| country | 47.7% | 58,170 | 약 절반만 국가 정보 보유 |
| industry_types | 46.5% | 59,524 | 약 절반만 산업 유형 보유 |
| products | 45.7% | 60,369 | **중요**: 약 54% 제품 정보 보유 |
| business_sectors | 45.4% | 60,681 | **중요**: 약 55% 섹터 정보 보유 |
| company_name | 43.9% | 62,342 | **주의**: 회사명도 일부 NULL |
| description | 43.9% | 62,414 | 약 56% 설명 보유 |
| name_url_match | 42.1% | 64,405 | 약 58% 매칭 정보 보유 |
| is_business_type_matched | 42.1% | 64,405 | 약 58% 매칭 정보 보유 |
| website_url | 0% | 111,187 | **필수**: 모든 레코드 보유 |
| business_type | 0% | 111,187 | **필수**: 모든 레코드 "뷰티" |
| lead_source | 0% | 111,187 | **필수**: 모든 레코드 "뷰티DB" |

#### 콤마 구분 필드 통계
| 필드명 | 데이터 보유율 | 평균 항목 개수 | 최대 항목 개수 | 비고 |
|--------|-------------|--------------|--------------|------|
| products | 54.3% | 8.6개 | 49개 | 제품 리스트 |
| business_sectors | 54.6% | 4.6개 | 19개 | 비즈니스 섹터 |
| product_categories | 49.7% | 3.2개 | 8개 | 제품 카테고리 (한글) |
| industry_types | 53.5% | 3.6개 | 12개 | 산업 유형 (한글) |

#### 복수 연락처 통계
| 필드명 | 전체 보유율 | 복수 값 비율 | 비고 |
|--------|-----------|------------|------|
| phone_number | 37.9% | 48.1% | 약 절반이 복수 전화번호 |
| email | 36.5% | 37.3% | 약 1/3이 복수 이메일 |

### 2.2 Excel 데이터 구조 (30개 컬럼)

| 컬럼명 | 데이터 타입 | 설명 |
|--------|------------|------|
| website_url | text | 원본 웹사이트 URL |
| business_type | text | 비즈니스 유형 |
| company_name | text | 회사명 |
| final_url | text | 최종 리다이렉트된 URL |
| http_status | float | HTTP 상태 코드 |
| found_company_name | text | 발견된 회사명 |
| name_url_match | text | 이름-URL 매칭 여부 |
| is_business_type_matched | text | 비즈니스 타입 매칭 여부 |
| description | text | 회사 설명 |
| address | text | 주소 |
| country | text | 국가 |
| city | text | 도시 |
| state | text | 주/도 |
| founded_year | text | 설립연도 |
| phone_number | text | 전화번호 |
| email | text | 이메일 주소 |
| facebook_url | text | 페이스북 URL |
| instagram_url | text | 인스타그램 URL |
| twitter_url | text | 트위터 URL |
| linkedin_url | text | 링크드인 URL |
| employee_count | text | 직원 수 |
| products | text | 제품 정보 (콤마로 구분된 리스트) |
| business_sectors | text | 비즈니스 섹터 (콤마로 구분된 리스트) |
| product_categories | text | 제품 카테고리 (콤마로 구분된 리스트) |
| industry_types | text | 산업 유형 (콤마로 구분된 리스트) |
| crawl_time_seconds | float | 크롤링 소요 시간 |
| gpt_time_seconds | float | GPT 처리 소요 시간 |
| collected_at | datetime | 수집 일시 |
| error_message | text | 에러 메시지 |
| lead_source | text | 리드 소스 (모두 "뷰티DB") |

## 3. 데이터베이스 스키마 분석

### 3.1 메인 테이블: `leads`

```sql
-- 주요 필드
id                       uuid PRIMARY KEY
workspace_id             uuid NOT NULL (FK to workspaces)
company_name             varchar(255)
found_company_name       varchar(255)
website_url              varchar(500)
final_url                varchar(500)
http_status              integer
name_url_match           boolean
business_type            varchar(100)
is_business_type_matched boolean
description              text
address                  text
country                  varchar(100)
city                     varchar(100)
state                    varchar(100)
founded_year             integer
employee_count           varchar(50)
lead_source              varchar(100)
lead_status              lead_status_enum DEFAULT 'new'
lead_score               integer
notes                    text
crawl_time_seconds       numeric(10,2)
gpt_time_seconds         numeric(10,2)
collected_at             timestamptz
error_message            text
created_by               uuid (FK to users)
created_at               timestamptz DEFAULT now()
updated_at               timestamptz DEFAULT now()
last_contacted_at        timestamptz
```

### 3.2 관계형 테이블들

#### `lead_contacts` - 연락처 정보
```sql
id            uuid PRIMARY KEY
lead_id       uuid NOT NULL (FK to leads)
contact_type  contact_type_enum NOT NULL  -- 'phone', 'email', 'fax', 'other'
contact_value varchar(255) NOT NULL
label         varchar(100)
is_primary    boolean DEFAULT false
is_verified   boolean DEFAULT false
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

#### `lead_social_media` - 소셜 미디어 정보
```sql
id             uuid PRIMARY KEY
lead_id        uuid NOT NULL (FK to leads)
platform       social_media_platform_enum NOT NULL  -- 'facebook', 'instagram', 'twitter', 'linkedin'
url            varchar(500) NOT NULL
username       varchar(255)
follower_count varchar(50)
is_verified    boolean DEFAULT false
created_at     timestamptz DEFAULT now()
updated_at     timestamptz DEFAULT now()
```

#### `lead_products` - 제품 정보
```sql
id           uuid PRIMARY KEY
lead_id      uuid NOT NULL (FK to leads)
product_name varchar(255) NOT NULL
description  text
created_at   timestamptz DEFAULT now()
```

#### `lead_business_sectors` - 비즈니스 섹터
```sql
id          uuid PRIMARY KEY
lead_id     uuid NOT NULL (FK to leads)
sector_name varchar(255) NOT NULL
created_at  timestamptz DEFAULT now()
```

#### `lead_industry_types` - 산업 유형
```sql
id            uuid PRIMARY KEY
lead_id       uuid NOT NULL (FK to leads)
industry_name varchar(255) NOT NULL
created_at    timestamptz DEFAULT now()
```

#### `lead_product_categories` - 제품 카테고리
```sql
id            uuid PRIMARY KEY
lead_id       uuid NOT NULL (FK to leads)
category_name varchar(255) NOT NULL
created_at    timestamptz DEFAULT now()
```

## 4. 데이터 매핑 전략

### 4.1 직접 매핑 (leads 테이블)

| Excel 컬럼 | DB 컬럼 | 변환 로직 |
|-----------|---------|-----------|
| company_name | company_name | 직접 매핑 |
| found_company_name | found_company_name | 직접 매핑 |
| website_url | website_url | 직접 매핑 |
| final_url | final_url | 직접 매핑 |
| http_status | http_status | float → int 변환 |
| name_url_match | name_url_match | 문자열 → boolean 변환 |
| business_type | business_type | 직접 매핑 |
| is_business_type_matched | is_business_type_matched | 문자열 → boolean 변환 |
| description | description | 직접 매핑 |
| address | address | 직접 매핑 |
| country | country | 직접 매핑 |
| city | city | 직접 매핑 |
| state | state | 직접 매핑 |
| founded_year | founded_year | 문자열 → int 변환 (유효성 검사) |
| employee_count | employee_count | 직접 매핑 |
| crawl_time_seconds | crawl_time_seconds | 직접 매핑 |
| gpt_time_seconds | gpt_time_seconds | 직접 매핑 |
| collected_at | collected_at | 직접 매핑 |
| error_message | error_message | 직접 매핑 |
| lead_source | lead_source | **"뷰티DB"로 고정** |

### 4.2 연락처 정보 분리 (lead_contacts 테이블)

#### 중요: 복수 연락처 처리
Excel 데이터의 **48.1%가 복수 전화번호**, **37.3%가 복수 이메일**을 가지고 있습니다.

**파싱 전략:**
| Excel 컬럼 | 변환 로직 | 예시 |
|-----------|-----------|------|
| phone_number | 콤마로 분리 후 각각 별도 레코드<br>첫 번째는 is_primary=true | `"604-299-8463, 1-877-299-8500"` → 2개 레코드 |
| email | 콤마로 분리 후 각각 별도 레코드<br>첫 번째는 is_primary=true | `"info@site.com, support@site.com"` → 2개 레코드 |

**실제 데이터 패턴:**
- 전화번호: `"'+375 29 960-7-085, '+375 33 340-2-475"`
- 이메일: `"info@normon.it, amministrazione@normon.it, specialist@normon.it"`

**처리 규칙:**
- NULL이나 빈 값은 삽입하지 않음
- 콤마로 분리하여 각각 별도 레코드 생성
- 첫 번째 값은 `is_primary=true`, 나머지는 `is_primary=false`
- `..@domain.com` 같은 불완전한 이메일은 필터링

### 4.3 소셜 미디어 분리 (lead_social_media 테이블)

#### 소셜 미디어 보유율
| Excel 컬럼 | platform 값 | 보유율 | 비고 |
|-----------|------------|-------|------|
| facebook_url | 'facebook' | 32.1% | 35,736개 |
| instagram_url | 'instagram' | 31.5% | 34,980개 |
| twitter_url | 'twitter' | 10.7% | 11,856개 (매우 적음) |
| linkedin_url | 'linkedin' | 11.2% | 12,490개 (적음) |

**실제 데이터 패턴:**
- Facebook: `https://www.facebook.com/EDPBY-301621023273647/`
- Instagram: `https://www.instagram.com/edp.by/`
- Twitter: `https://twitter.com/MedivaPharma`
- LinkedIn: `https://www.linkedin.com/company/rofersam/`

**처리 규칙:**
- NULL이나 빈 URL은 삽입하지 않음
- URL에서 username 자동 추출 시도
- 유효하지 않은 URL 형식은 스킵

### 4.4 콤마 구분 리스트 파싱

#### 실제 데이터 통계 및 파싱 전략

| 필드 → 테이블 | 보유율 | 평균 항목 | 최대 항목 | 설명 |
|--------------|--------|----------|----------|------|
| products → lead_products | 54.3% | 8.6개 | 49개 | 제품명 리스트 |
| business_sectors → lead_business_sectors | 54.6% | 4.6개 | 19개 | 비즈니스 섹터 |
| product_categories → lead_product_categories | 49.7% | 3.2개 | 8개 | 제품 카테고리 (한글) |
| industry_types → lead_industry_types | 53.5% | 3.6개 | 12개 | 산업 유형 (한글) |

**실제 데이터 예시:**

##### products → lead_products
```python
# 예시 1 (6개 항목):
"Perfumes, Fragrances, Perfume samples, Skincare products, Haircare products, Cosmetics"
→ 6개의 lead_products 레코드

# 예시 2 (괄호 포함, 14개 항목):
"Perfumes, Makeup (lipstick, foundation, mascara 등), Facial skincare (masks, serums, cleansers), ..."
→ 14개의 lead_products 레코드
# 주의: 괄호 안의 콤마는 구분자가 아님

# 예시 3 (한글 포함):
"니치 향수, Eau de Parfum, 캔들, 바디크림, 트래블/샘플 세트, 면도용품"
→ 6개의 lead_products 레코드
```

##### business_sectors → lead_business_sectors
```python
# 예시 1:
"Perfume retail, Cosmetics retail, Beauty e-commerce"
→ 3개의 lead_business_sectors 레코드

# 예시 2:
"Cosmetics, Beauty, Personal Care, Private Label/Contract Manufacturing"
→ 4개의 lead_business_sectors 레코드
```

##### product_categories → lead_product_categories
```python
# 한글 카테고리:
"스킨케어, 메이크업, 헤어케어, 향수"
→ 4개의 lead_product_categories 레코드

"향수, 풋&핸드케어, 면도제모, 기타"
→ 4개의 lead_product_categories 레코드
```

##### industry_types → lead_industry_types
```python
# 한글 산업 유형:
"수입업체, 유통업체, 도매업체, 소매업체, 온라인 플랫폼"
→ 5개의 lead_industry_types 레코드

"브랜드 소유자, ODM&OEM, 패키지 공급"
→ 3개의 lead_industry_types 레코드
```

**중요 파싱 주의사항:**
1. **괄호 처리**: 제품명에 괄호가 포함된 경우 괄호 안의 콤마는 구분자로 취급하지 않음
2. **특수 문자**: `&`, `/`, `-` 등은 단어의 일부로 유지
3. **한글/영문 혼재**: 정상 처리
4. **공백 제거**: 각 항목의 앞뒤 공백은 trim
5. **빈 값 제거**: 콤마만 연속된 경우 빈 항목 제거

## 5. 최적화된 데이터 파싱 규칙 (실제 데이터 기반)

### 5.1 콤마 구분 값 처리 (개선된 버전)

**기본 버전 (단순 콤마 분리):**
```python
def parse_comma_separated_simple(value: str) -> list[str]:
    """
    콤마로 구분된 문자열을 파싱 (단순 버전)

    실제 데이터 예시:
    - "Perfumes, Fragrances, Cosmetics" → ["Perfumes", "Fragrances", "Cosmetics"]
    - "스킨케어, 메이크업, 헤어케어" → ["스킨케어", "메이크업", "헤어케어"]
    """
    if not value or pd.isna(value):
        return []

    # 콤마로 분리
    items = [item.strip() for item in str(value).split(',')]

    # 빈 문자열 제거
    items = [item for item in items if item]

    return items
```

**고급 버전 (괄호 안 콤마 무시):**
```python
import re

def parse_comma_separated_advanced(value: str) -> list[str]:
    """
    콤마로 구분된 문자열을 파싱 (괄호 안 콤마는 무시)

    실제 데이터 예시:
    - "Makeup (lipstick, foundation, mascara 등), Haircare, Cosmetics"
      → ["Makeup (lipstick, foundation, mascara 등)", "Haircare", "Cosmetics"]

    괄호 안의 콤마는 제품명의 일부로 간주하여 분리하지 않음
    """
    if not value or pd.isna(value):
        return []

    # 괄호 밖의 콤마만 분리하는 정규식
    # 괄호 depth를 추적하며 파싱
    items = []
    current_item = []
    depth = 0

    for char in str(value):
        if char == '(':
            depth += 1
            current_item.append(char)
        elif char == ')':
            depth -= 1
            current_item.append(char)
        elif char == ',' and depth == 0:
            # 괄호 밖의 콤마 - 항목 구분자
            item = ''.join(current_item).strip()
            if item:
                items.append(item)
            current_item = []
        else:
            current_item.append(char)

    # 마지막 항목 추가
    item = ''.join(current_item).strip()
    if item:
        items.append(item)

    return items


# 추천: 대부분의 경우 단순 버전으로 충분
# 괄호 안 콤마가 많은 products 필드만 고급 버전 사용
def parse_products(value: str) -> list[str]:
    """제품 필드 전용 파서 (괄호 처리)"""
    return parse_comma_separated_advanced(value)

def parse_other_comma_fields(value: str) -> list[str]:
    """기타 콤마 구분 필드 파서 (단순 버전)"""
    return parse_comma_separated_simple(value)
```

### 5.2 Boolean 변환 (실제 데이터 기반)

**실제 데이터 패턴:**
- `name_url_match`: `"yes"` (59,632개), `"no"` (4,773개), NULL (46,782개)
- `is_business_type_matched`: `"yes"` (43,516개), `"no"` (20,889개), NULL (46,782개)

```python
def parse_boolean(value) -> bool | None:
    """
    문자열을 boolean으로 변환

    실제 데이터 값:
    - "yes" → True
    - "no" → False
    - NULL/빈값 → None
    """
    if pd.isna(value) or value == '':
        return None

    str_value = str(value).lower().strip()

    if str_value in ['true', 'yes', '1', 't', 'y']:
        return True
    elif str_value in ['false', 'no', '0', 'f', 'n']:
        return False
    else:
        # 예상치 못한 값은 로그 기록하고 None 반환
        print(f"Warning: Unexpected boolean value: {repr(value)}")
        return None
```

### 5.3 정수 변환 (실제 데이터 기반)

**실제 데이터 패턴:**
- `http_status`: 200.0 (float 타입) → 200 (int)
- `founded_year`: 2013, 1990, 2010 등 (int 타입 또는 object)
  - 보유율: 20.8% (23,142개만 데이터 존재)

```python
def parse_integer(value) -> int | None:
    """
    문자열/숫자를 정수로 변환

    실제 데이터 예시:
    - http_status: 200.0 → 200
    - founded_year: 2013 → 2013
    - NULL/빈값 → None
    """
    if pd.isna(value) or value == '':
        return None

    try:
        # float를 거쳐 int로 변환 (소수점이 있는 경우 대비)
        num = int(float(value))

        # founded_year 검증 (1800-2100 범위)
        # 이 범위를 벗어나면 유효하지 않은 값으로 간주
        return num
    except (ValueError, TypeError):
        return None


def parse_founded_year(value) -> int | None:
    """
    설립연도 파싱 및 검증

    유효 범위: 1800 ~ 현재년도+1
    """
    year = parse_integer(value)
    if year is None:
        return None

    current_year = 2025  # 또는 datetime.now().year
    if 1800 <= year <= current_year + 1:
        return year
    else:
        print(f"Warning: Invalid founded_year: {year}")
        return None
```

### 5.4 URL에서 Username 추출 (실제 데이터 기반)

**실제 데이터 예시:**
- Facebook: `https://www.facebook.com/EDPBY-301621023273647/` → username: `EDPBY-301621023273647`
- Instagram: `https://www.instagram.com/edp.by/` → username: `edp.by`
- Twitter: `https://twitter.com/MedivaPharma` → username: `MedivaPharma`
- LinkedIn: `https://www.linkedin.com/company/rofersam/` → username: `rofersam`

```python
import re

def extract_username(url: str, platform: str) -> str | None:
    """
    소셜 미디어 URL에서 username 추출

    실제 URL 패턴에 맞게 최적화됨
    """
    if not url or pd.isna(url):
        return None

    # URL 정리 (공백 제거)
    url = str(url).strip()

    # 플랫폼별 정규식 패턴
    patterns = {
        'facebook': r'facebook\.com/([^/?]+)',
        'instagram': r'instagram\.com/([^/?]+)',
        'twitter': r'twitter\.com/([^/?]+)',
        'linkedin': r'linkedin\.com/(?:company|in)/([^/?]+)'
    }

    pattern = patterns.get(platform)
    if pattern:
        match = re.search(pattern, url, re.IGNORECASE)
        if match:
            username = match.group(1)
            # 특수 문자 정리 (선택사항)
            # username = username.rstrip('/')
            return username

    return None


def validate_email(email: str) -> bool:
    """
    이메일 유효성 검증

    실제 데이터에서 발견된 문제:
    - "..@jecev.com" 같은 불완전한 이메일 제외
    """
    if not email or pd.isna(email):
        return False

    email = str(email).strip()

    # 기본 이메일 형식 검증
    if '..' in email or email.startswith('.') or '@' not in email:
        return False

    # 간단한 정규식 검증
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))
```

## 6. 임포트 프로세스

### 6.1 필수 사전 조건
1. **workspace_id 결정**: 모든 리드가 속할 workspace의 UUID 확인
2. **created_by 결정**: 데이터를 생성하는 사용자의 UUID 확인 (선택사항)

### 6.2 배치 처리 전략
```python
BATCH_SIZE = 1000  # 한 번에 처리할 레코드 수

# 111,187개 레코드를 1,000개씩 배치 처리
# 총 약 112개 배치
```

### 6.3 트랜잭션 관리
```python
# 각 리드는 하나의 트랜잭션으로 처리
# - leads 테이블에 INSERT
# - 연락처, 소셜 미디어, 제품 등 관련 테이블에 INSERT
# - 하나라도 실패하면 전체 ROLLBACK
```

### 6.4 임포트 순서
1. `leads` 테이블에 메인 레코드 삽입 → lead_id 반환
2. `lead_contacts` 테이블에 연락처 정보 삽입
3. `lead_social_media` 테이블에 소셜 미디어 정보 삽입
4. `lead_products` 테이블에 제품 정보 삽입
5. `lead_business_sectors` 테이블에 비즈니스 섹터 삽입
6. `lead_product_categories` 테이블에 제품 카테고리 삽입
7. `lead_industry_types` 테이블에 산업 유형 삽입

## 7. 에러 핸들링

### 7.1 데이터 검증
- **필수 필드 검증**: workspace_id는 반드시 존재해야 함
- **타입 검증**: http_status는 유효한 정수여야 함
- **길이 검증**: varchar 필드는 최대 길이 준수
- **외래 키 검증**: workspace_id, created_by는 유효한 UUID여야 함

### 7.2 중복 처리
- **website_url 기준**: 동일한 workspace 내에서 같은 website_url이 있으면 스킵 또는 업데이트
- **로그 기록**: 중복 또는 에러 발생 시 별도 로그 파일에 기록

### 7.3 에러 로그
```python
# 실패한 레코드를 별도 파일로 저장
failed_records = []

# 형식:
{
    'row_number': 1234,
    'company_name': 'Example Corp',
    'error': 'Invalid workspace_id',
    'data': {...}  # 원본 데이터
}
```

## 8. 임포트 스크립트 구조

```python
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import uuid
from typing import Optional, List, Dict
import re

# 설정
EXCEL_FILE = 'docs/뷰티-DB-최종.xlsx'
SHEET_NAME = '뷰티-DB-통합데이터'
BATCH_SIZE = 1000
WORKSPACE_ID = 'YOUR_WORKSPACE_UUID'  # 실제 UUID로 변경 필요
CREATED_BY = None  # 선택사항

# DB 연결
conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='postgres',
    password='Pg7mK9nL2xR5wQ8vB4zT6yH3pN1dF9cM',
    database='postgres'
)

# 메인 처리 함수
def import_leads():
    # Excel 파일 읽기
    df = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)

    # 배치 처리
    for i in range(0, len(df), BATCH_SIZE):
        batch = df[i:i+BATCH_SIZE]
        process_batch(batch, i)

    conn.close()

def process_batch(batch, start_idx):
    cursor = conn.cursor()

    for idx, row in batch.iterrows():
        try:
            # 트랜잭션 시작
            cursor.execute("BEGIN")

            # 1. leads 테이블에 삽입
            lead_id = insert_lead(cursor, row)

            # 2. 관련 데이터 삽입
            insert_contacts(cursor, lead_id, row)
            insert_social_media(cursor, lead_id, row)
            insert_products(cursor, lead_id, row)
            insert_business_sectors(cursor, lead_id, row)
            insert_product_categories(cursor, lead_id, row)
            insert_industry_types(cursor, lead_id, row)

            # 커밋
            cursor.execute("COMMIT")

        except Exception as e:
            # 롤백
            cursor.execute("ROLLBACK")
            log_error(start_idx + idx, row, str(e))

    cursor.close()
```

## 9. 실행 전 체크리스트

- [ ] workspace_id 확인 및 설정
- [ ] DB 연결 정보 확인 (호스트, 포트, 비밀번호)
- [ ] Excel 파일 경로 확인
- [ ] 테스트용 소규모 데이터로 먼저 테스트
- [ ] 에러 로그 파일 경로 설정
- [ ] 백업 계획 수립

## 10. 성능 고려사항 및 예상 통계

### 10.1 예상 처리 시간
- **총 레코드**: 111,187개
- **예상 관계형 레코드 수** (실제 데이터 기반):
  - lead_contacts: ~82,689개 (전화 42,133 + 이메일 40,556)
    - 복수 전화번호 48.1% 고려 시 추가 레코드 발생
    - 복수 이메일 37.3% 고려 시 추가 레코드 발생
    - 예상: 약 100,000개 이상
  - lead_social_media: ~95,062개 (Facebook 35,736 + Instagram 34,980 + Twitter 11,856 + LinkedIn 12,490)
  - lead_products: ~520,000개 (60,369개 리드 × 평균 8.6개)
  - lead_business_sectors: ~280,000개 (60,681개 리드 × 평균 4.6개)
  - lead_product_categories: ~177,000개 (55,257개 리드 × 평균 3.2개)
  - lead_industry_types: ~214,000개 (59,524개 리드 × 평균 3.6개)
- **총 예상 INSERT 수**: ~1,387,000개 이상
- **배치 크기**: 1,000개 리드씩 (총 112 배치)
- **예상 시간**: 10-20분 (네트워크 및 DB 성능에 따라 다름)

### 10.2 최적화 방안
1. **Bulk Insert 사용**: execute_values()로 여러 레코드 한 번에 삽입
   - 관계형 테이블은 리드당 여러 레코드를 한 번에 INSERT
2. **인덱스 일시 비활성화**: 대량 삽입 시 인덱스를 잠시 비활성화
   ```sql
   -- 인덱스 비활성화 (선택사항)
   DROP INDEX IF EXISTS lead_products_product_name_idx;
   DROP INDEX IF EXISTS lead_business_sectors_sector_name_idx;
   -- ... 기타 인덱스

   -- 데이터 삽입

   -- 인덱스 재생성
   CREATE INDEX lead_products_product_name_idx ON lead_products(product_name);
   CREATE INDEX lead_business_sectors_sector_name_idx ON lead_business_sectors(sector_name);
   ```
3. **병렬 처리**: 여러 워커로 배치를 동시 처리 (주의: 트랜잭션 관리 필요)
4. **커넥션 풀**: 연결 재사용으로 오버헤드 감소
5. **트랜잭션 크기 조정**: 배치당 하나의 큰 트랜잭션으로 처리

## 11. 검증 방법

### 임포트 후 데이터 검증 쿼리
```sql
-- 총 레코드 수 확인
SELECT COUNT(*) FROM leads WHERE lead_source = '뷰티DB';

-- 관련 테이블 레코드 수 확인
SELECT
    (SELECT COUNT(*) FROM leads WHERE lead_source = '뷰티DB') as leads_count,
    (SELECT COUNT(*) FROM lead_contacts WHERE lead_id IN
        (SELECT id FROM leads WHERE lead_source = '뷰티DB')) as contacts_count,
    (SELECT COUNT(*) FROM lead_social_media WHERE lead_id IN
        (SELECT id FROM leads WHERE lead_source = '뷰티DB')) as social_media_count,
    (SELECT COUNT(*) FROM lead_products WHERE lead_id IN
        (SELECT id FROM leads WHERE lead_source = '뷰티DB')) as products_count,
    (SELECT COUNT(*) FROM lead_business_sectors WHERE lead_id IN
        (SELECT id FROM leads WHERE lead_source = '뷰티DB')) as sectors_count,
    (SELECT COUNT(*) FROM lead_product_categories WHERE lead_id IN
        (SELECT id FROM leads WHERE lead_source = '뷰티DB')) as categories_count,
    (SELECT COUNT(*) FROM lead_industry_types WHERE lead_id IN
        (SELECT id FROM leads WHERE lead_source = '뷰티DB')) as industries_count;

-- 샘플 데이터 확인
SELECT * FROM leads WHERE lead_source = '뷰티DB' LIMIT 10;

-- NULL 값 통계
SELECT
    COUNT(*) FILTER (WHERE company_name IS NULL) as null_company_name,
    COUNT(*) FILTER (WHERE website_url IS NULL) as null_website_url,
    COUNT(*) FILTER (WHERE country IS NULL) as null_country
FROM leads WHERE lead_source = '뷰티DB';
```

## 12. 롤백 계획

임포트 실패 시 롤백 방법:
```sql
-- 뷰티DB 소스의 모든 데이터 삭제
DELETE FROM leads WHERE lead_source = '뷰티DB';

-- CASCADE로 인해 관련 테이블의 데이터도 자동 삭제됨
-- - lead_contacts
-- - lead_social_media
-- - lead_products
-- - lead_business_sectors
-- - lead_product_categories
-- - lead_industry_types
```

## 13. 실제 데이터 분석 요약

### 13.1 주요 발견 사항
1. **NULL 비율이 매우 높음**
   - 연락처 정보: 이메일 63.5%, 전화번호 62.1% NULL
   - 소셜 미디어: Twitter 89.3%, LinkedIn 88.8% NULL
   - 기본 정보: 설립연도 79.2%, 주소 65.3% NULL

2. **복수 값이 많음**
   - 전화번호: 48.1%가 복수 값
   - 이메일: 37.3%가 복수 값
   - 제품: 평균 8.6개 항목 (최대 49개)

3. **데이터 품질 이슈**
   - 불완전한 이메일: `..@domain.com`
   - 회사명도 43.9% NULL
   - 에러 메시지 53.1% 존재

4. **예상보다 많은 INSERT 수**
   - 총 ~1,387,000개 이상의 INSERT 문 실행 예상
   - products 테이블만 52만 개 이상 레코드

### 13.2 최적화된 파싱 전략
1. **괄호 안 콤마 처리**: products 필드는 고급 파서 사용
2. **복수 연락처 처리**: 콤마로 분리하여 각각 별도 레코드 생성
3. **이메일 검증**: 불완전한 이메일 필터링
4. **Bulk Insert**: 관계형 테이블은 execute_values() 사용

### 13.3 예상 결과 통계
| 테이블 | 예상 레코드 수 |
|--------|---------------|
| leads | 111,187 |
| lead_contacts | ~100,000+ |
| lead_social_media | ~95,062 |
| lead_products | ~520,000 |
| lead_business_sectors | ~280,000 |
| lead_product_categories | ~177,000 |
| lead_industry_types | ~214,000 |
| **총합** | **~1,497,249** |

## 14. 다음 단계

1. **임포트 스크립트 작성**: Python 스크립트 구현 (최적화된 파서 포함)
2. **테스트 실행**: 100개 레코드로 먼저 테스트
3. **전체 실행**: 전체 111,187개 레코드 임포트
4. **검증**: 데이터 무결성 및 완전성 확인
5. **문서화**: 실제 실행 결과 및 이슈 기록
