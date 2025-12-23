# 통계 페이지 구현 가이드

이 문서는 채팅/번역 통계 페이지의 프론트엔드 코드와 라이브러리를 정리한 것입니다.

---

## 목차

1. [사용 라이브러리](#1-사용-라이브러리)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [API 서비스 (RTK Query)](#3-api-서비스-rtk-query)
4. [메인 페이지 컴포넌트](#4-메인-페이지-컴포넌트-chatstatistics)
5. [통계 카드 컴포넌트](#5-통계-카드-컴포넌트-statisticscards)
6. [커스텀 UI 컴포넌트](#6-커스텀-ui-컴포넌트)
7. [설치 및 설정 방법](#7-설치-및-설정-방법)

---

## 1. 사용 라이브러리

### 핵심 라이브러리

```json
{
  "dependencies": {
    // 상태 관리 & API
    "@reduxjs/toolkit": "^2.2.7",
    "react-redux": "^9.1.0",

    // 차트
    "recharts": "^3.5.0",

    // UI 컴포넌트
    "@headlessui/react": "^1.7.18",
    "@radix-ui/react-tooltip": "^1.1.2",
    "lucide-react": "^0.435.0",

    // 날짜 처리
    "date-fns": "^4.1.0",

    // 스타일링
    "tailwindcss": "^3.4.1",
    "tailwind-merge": "^2.5.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",

    // 알림
    "react-toastify": "^10.0.5"
  }
}
```

### 설치 명령어

```bash
npm install @reduxjs/toolkit react-redux recharts @headlessui/react @radix-ui/react-tooltip lucide-react date-fns tailwind-merge class-variance-authority clsx react-toastify
```

---

## 2. 프로젝트 구조

```
src/
├── modules/banker/pages/
│   ├── ChatStatistics.tsx      # 메인 통계 페이지
│   └── StatisticsCards.tsx     # 통계 차트/카드 컴포넌트
├── components/ui/
│   ├── date-picker.tsx         # 날짜 선택기
│   ├── multi-select-combobox.tsx # 다중 선택 콤보박스
│   ├── calendar.tsx            # 달력 컴포넌트
│   ├── button.tsx              # 버튼 (shadcn/ui)
│   ├── input.tsx               # 입력 (shadcn/ui)
│   ├── card.tsx                # 카드 (shadcn/ui)
│   ├── table.tsx               # 테이블 (shadcn/ui)
│   └── tooltip.tsx             # 툴팁 (shadcn/ui)
├── redux/
│   ├── services/
│   │   └── chatroommessages.ts # API 서비스 (RTK Query)
│   └── emptyApi.ts             # RTK Query 기본 설정
└── lib/
    └── utils.ts                # 유틸리티 함수 (cn)
```

---

## 3. API 서비스 (RTK Query)

### 3.1 API 엔드포인트 타입 정의

```typescript
// 통계 테이블 데이터 응답
export type GetStatisticsApiChatRoomMessagesStatisticsGetApiResponse = {
  data: ChatRoomMessageStatistic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// 통계 테이블 요청 파라미터
export type GetStatisticsApiChatRoomMessagesStatisticsGetApiArg = {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  userName?: string;
  role?: string;
  deptCode?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  likeStatus?: string;
};

// 개별 메시지 통계 데이터
export type ChatRoomMessageStatistic = {
  id: string;
  createdAt: string;
  updatedAt: string;
  chatRoomId: string;
  sourceLanguage: string;
  sourceText: string;
  targetLanguage: string | null;
  targetText: string | null;
  createdByUserId: string;
  likeStatus: ChatRoomMessageLikeStatus;
  userName: string | null;
  userDeptCode: string | null;
  chatRoomTitle: string | null;
  userRole?: "banker" | "customer" | "system" | "admin";
};

// 요약 통계 응답
export type GetSummaryApiChatRoomMessagesSummaryGetApiResponse = {
  total_messages: number;
  translated_message_count: number;
  top_users: Array<{ name: string; count: number }>;
  all_users: string[];
  role_distribution: { customer: number; banker: number; system: number; admin: number };
  language_distribution: Record<string, number>;
  target_language_distribution: Record<string, number>;
  dept_codes: string[];
  chatroom_stats: {
    average: number;
    min: number;
    max: number;
    total_chatrooms: number;
  };
  like_distribution: { LIKED: number; DISLIKED: number; NULL: number };
  daily_distribution: Record<string, number>;
  daily_distribution_with_percentage: Record<string, { count: number; percentage: number }>;
  hourly_distribution: Record<string, number>;
  hourly_distribution_with_percentage: Record<string, { count: number; percentage: number }>;
  hourly_group_stats: {
    business: { count: number; percentage: number };
    lunch: { count: number; percentage: number };
    off_hours: { count: number; percentage: number };
  };
  session_duration_hours: number;
  daily_average: number;
  satisfaction_rate: number;
  peak_hour: number | null;
  peak_hour_count: number;
};

// 요약 통계 요청 파라미터
export type GetSummaryApiChatRoomMessagesSummaryGetApiArg = {
  startDate?: string;
  endDate?: string;
};

// 접근 키 검증 응답
export type VerifyAccessKeyApiChatRoomMessagesVerifyAccessKeyPostApiResponse = {
  valid: boolean;
  message: string;
};

// 엑셀 다운로드 요청 파라미터
export type DownloadStatisticsExcelApiArg = {
  startDate?: string;
  endDate?: string;
  userName?: string;
  role?: string;
  deptCode?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  likeStatus?: string;
};

export type ChatRoomMessageLikeStatus = "LIKED" | "DISLIKED" | "NULL";
```

### 3.2 RTK Query API 서비스

```typescript
import { emptySplitApi as api } from "../emptyApi";

export const addTagTypes = ["chat_room_messages"] as const;

const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      // 통계 테이블 조회 (페이지네이션 + 필터)
      getStatisticsApiChatRoomMessagesStatisticsGet: build.query<
        GetStatisticsApiChatRoomMessagesStatisticsGetApiResponse,
        GetStatisticsApiChatRoomMessagesStatisticsGetApiArg
      >({
        query: (queryArg) => ({
          url: `/api/chat_room_messages/statistics`,
          params: {
            page: queryArg.page,
            limit: queryArg.limit,
            startDate: queryArg.startDate,
            endDate: queryArg.endDate,
            userName: queryArg.userName,
            role: queryArg.role,
            deptCode: queryArg.deptCode,
            sourceLanguage: queryArg.sourceLanguage,
            targetLanguage: queryArg.targetLanguage,
            likeStatus: queryArg.likeStatus,
          },
        }),
        providesTags: ["chat_room_messages"],
        keepUnusedDataFor: 0, // 캐시 즉시 만료
      }),

      // 접근 키 검증
      verifyAccessKeyApiChatRoomMessagesVerifyAccessKeyPost: build.mutation<
        VerifyAccessKeyApiChatRoomMessagesVerifyAccessKeyPostApiResponse,
        VerifyAccessKeyApiChatRoomMessagesVerifyAccessKeyPostApiArg
      >({
        query: (queryArg) => ({
          url: `/api/chat_room_messages/verify-access-key`,
          method: "POST",
          params: {
            access_key: queryArg.accessKey,
          },
        }),
      }),

      // 요약 통계 조회
      getSummaryApiChatRoomMessagesSummaryGet: build.query<
        GetSummaryApiChatRoomMessagesSummaryGetApiResponse,
        GetSummaryApiChatRoomMessagesSummaryGetApiArg
      >({
        query: (queryArg) => ({
          url: `/api/chat_room_messages/summary`,
          params: {
            startDate: queryArg?.startDate,
            endDate: queryArg?.endDate,
          },
        }),
        providesTags: ["chat_room_messages"],
        keepUnusedDataFor: 0,
      }),

      // 엑셀 다운로드
      downloadStatisticsExcel: build.mutation<
        Blob,
        DownloadStatisticsExcelApiArg
      >({
        query: (queryArg) => ({
          url: `/api/chat_room_messages/statistics/download`,
          method: "POST",
          params: {
            startDate: queryArg.startDate,
            endDate: queryArg.endDate,
            userName: queryArg.userName,
            role: queryArg.role,
            deptCode: queryArg.deptCode,
            sourceLanguage: queryArg.sourceLanguage,
            targetLanguage: queryArg.targetLanguage,
            likeStatus: queryArg.likeStatus,
          },
          responseHandler: async (response) => {
            return await response.blob();
          },
        }),
      }),

      // 채팅방 메시지 조회 (대화 내역 모달용)
      readAllApiChatRoomMessagesGet: build.query<
        PublicChatRoomMessage[],
        { chatRoomId: string }
      >({
        query: (queryArg) => ({
          url: `/api/chat_room_messages`,
          params: { chat_room_id: queryArg.chatRoomId },
        }),
      }),
    }),
    overrideExisting: false,
  });

export { injectedRtkApi as enhancedApi };

// 훅 내보내기
export const {
  useGetStatisticsApiChatRoomMessagesStatisticsGetQuery,
  useGetSummaryApiChatRoomMessagesSummaryGetQuery,
  useVerifyAccessKeyApiChatRoomMessagesVerifyAccessKeyPostMutation,
  useDownloadStatisticsExcelMutation,
  useReadAllApiChatRoomMessagesGetQuery,
} = injectedRtkApi;
```

### 3.3 Empty API 기본 설정

```typescript
// redux/emptyApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const emptySplitApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_APP_BASE_URL,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("token");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: () => ({}),
});
```

---

## 4. 메인 페이지 컴포넌트 (ChatStatistics)

### 4.1 주요 상태 관리

```typescript
const ChatStatistics = () => {
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 필터 상태
  const [userNameFilter, setUserNameFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [deptCodeFilter, setDeptCodeFilter] = useState<string[]>([]);
  const [sourceLanguageFilter, setSourceLanguageFilter] = useState<string[]>([]);
  const [targetLanguageFilter, setTargetLanguageFilter] = useState<string[]>([]);
  const [likeStatusFilter, setLikeStatusFilter] = useState<string>("all");

  // 날짜 범위
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [activeDateRange, setActiveDateRange] = useState<string>("all");

  // 뷰 모드
  const [viewMode, setViewMode] = useState<"statistics" | "table">("statistics");

  // 인증
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  // 모달
  const [selectedChatRoomId, setSelectedChatRoomId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // ...
};
```

### 4.2 날짜 변환 유틸리티 (KST -> UTC)

```typescript
// KST 날짜를 UTC로 변환하는 함수
const convertKSTDateToUTC = (date: Date, isEndDate: boolean = false): string => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // KST 기준으로 시작일은 00:00:00, 종료일은 23:59:59로 설정
  const kstDate = new Date(year, month, day, isEndDate ? 23 : 0, isEndDate ? 59 : 0, isEndDate ? 59 : 0);

  // KST에서 UTC로 변환 (9시간 빼기)
  const utcDate = new Date(kstDate.getTime() - (9 * 60 * 60 * 1000));

  return utcDate.toISOString().split('T')[0];
};
```

### 4.3 빠른 날짜 범위 설정

```typescript
const setQuickDateRange = (days: number, rangeKey: string) => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);

  const end = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  setStartDate(start);
  setEndDate(end);
  setActiveDateRange(rangeKey);
  setCurrentPage(1);
};

const clearDateRange = () => {
  setStartDate(undefined);
  setEndDate(undefined);
  setActiveDateRange("all");
  setCurrentPage(1);
};
```

### 4.4 API 호출

```typescript
// 통계 테이블 데이터 조회
const {
  data: statisticsData,
  isLoading,
  error,
  refetch: refetchStatistics,
} = useGetStatisticsApiChatRoomMessagesStatisticsGetQuery({
  page: currentPage,
  limit: pageSize,
  startDate: startDate ? convertKSTDateToUTC(startDate, false) : undefined,
  endDate: endDate ? convertKSTDateToUTC(endDate, true) : undefined,
  userName: userNameFilter.length > 0 ? userNameFilter.join(",") : undefined,
  role: roleFilter !== "all" ? roleFilter : undefined,
  deptCode: deptCodeFilter.length > 0 ? deptCodeFilter.join(",") : undefined,
  sourceLanguage: sourceLanguageFilter.length > 0 ? sourceLanguageFilter.join(",") : undefined,
  targetLanguage: targetLanguageFilter.length > 0 ? targetLanguageFilter.join(",") : undefined,
  likeStatus: likeStatusFilter !== "all" ? likeStatusFilter : undefined,
}, {
  skip: !isAuthenticated,
  refetchOnMountOrArgChange: true,
});

// 요약 통계 조회
const {
  data: summaryData,
  isLoading: isSummaryLoading,
  error: summaryError,
  refetch: refetchSummary,
} = useGetSummaryApiChatRoomMessagesSummaryGetQuery({
  startDate: startDate ? convertKSTDateToUTC(startDate, false) : undefined,
  endDate: endDate ? convertKSTDateToUTC(endDate, true) : undefined,
}, {
  skip: !isAuthenticated,
  refetchOnMountOrArgChange: true,
});
```

### 4.5 엑셀 다운로드 핸들러

```typescript
const [downloadStatisticsExcel, { isLoading: isDownloading }] = useDownloadStatisticsExcelMutation();

const handleExcelDownload = async () => {
  try {
    const result = await downloadStatisticsExcel({
      startDate: startDate ? convertKSTDateToUTC(startDate, false) : undefined,
      endDate: endDate ? convertKSTDateToUTC(endDate, true) : undefined,
      userName: userNameFilter.length > 0 ? userNameFilter.join(",") : undefined,
      role: roleFilter !== "all" ? roleFilter : undefined,
      deptCode: deptCodeFilter.length > 0 ? deptCodeFilter.join(",") : undefined,
      sourceLanguage: sourceLanguageFilter.length > 0 ? sourceLanguageFilter.join(",") : undefined,
      targetLanguage: targetLanguageFilter.length > 0 ? targetLanguageFilter.join(",") : undefined,
      likeStatus: likeStatusFilter !== "all" ? likeStatusFilter : undefined,
    }).unwrap();

    // Blob으로부터 다운로드 URL 생성
    const downloadUrl = window.URL.createObjectURL(result);
    const link = document.createElement("a");
    link.href = downloadUrl;

    // 파일명 생성 (현재 날짜 포함)
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    link.download = `statistics_${dateStr}.xlsx`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    toast.info("엑셀 파일 다운로드가 완료되었습니다.");
  } catch (error) {
    console.error("Excel download error:", error);
    toast.error("엑셀 파일 다운로드 중 오류가 발생했습니다.");
  }
};
```

### 4.6 언어 코드 변환 유틸리티

```typescript
const languageCodeToKorean: Record<string, string> = {
  en: "영어",
  zh: "중국어(간체)",
  "zh-hant": "중국어(번체)",
  "zh-tw": "중국어(대만)",
  ja: "일본어",
  vi: "베트남어",
  uz: "우즈베크어",
  ru: "러시아어",
  ne: "네팔어",
  bn: "벵골어",
  th: "태국어",
  mn: "몽골어",
  id: "인도네시아어",
  km: "크메르어",
  pt: "포르투갈어",
  si: "싱할라어",
  ko: "한국어",
  tl: "타갈로그어",
  my: "미얀마어"
};

const getLanguageKoreanName = (code: string): string => {
  return languageCodeToKorean[code] || code;
};
```

### 4.7 접근 키 인증 로직

```typescript
const STORAGE_KEY = "statistics_access_verified";
const STORAGE_KEY_ACCESS_KEY = "statistics_access_key";

const [verifyAccessKey] = useVerifyAccessKeyApiChatRoomMessagesVerifyAccessKeyPostMutation();

useEffect(() => {
  const checkStoredAccess = async () => {
    const hasAccess = localStorage.getItem(STORAGE_KEY);
    const storedKey = localStorage.getItem(STORAGE_KEY_ACCESS_KEY);

    if (hasAccess === "true" && storedKey) {
      try {
        const result = await verifyAccessKey({ accessKey: storedKey });

        if ('data' in result && result.data?.valid) {
          setIsAuthenticated(true);
        } else if ('error' in result) {
          console.warn("키 검증 중 오류 발생:", result.error);
          setIsAuthenticated(true); // 네트워크 오류 시 허용
        } else {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_KEY_ACCESS_KEY);
          setShowKeyInput(true);
        }
      } catch (error) {
        console.warn("키 검증 중 오류 발생:", error);
        setIsAuthenticated(true);
      }
    } else {
      setShowKeyInput(true);
    }

    setIsInitialLoading(false);
  };

  checkStoredAccess();
}, [verifyAccessKey]);

const handleKeySubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!accessKey.trim()) {
    toast.error("접근 키를 입력해주세요.");
    return;
  }

  setIsVerifying(true);
  try {
    const result = await verifyAccessKey({ accessKey });

    if ('data' in result && result.data?.valid) {
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.setItem(STORAGE_KEY_ACCESS_KEY, accessKey);
      setIsAuthenticated(true);
      setShowKeyInput(false);
      toast.info("접근이 승인되었습니다.");
    } else {
      toast.error("잘못된 접근 키입니다.");
      setAccessKey("");
    }
  } catch (error) {
    toast.error("서버 오류가 발생했습니다.");
    setAccessKey("");
  } finally {
    setIsVerifying(false);
  }
};
```

### 4.8 필터 옵션 생성 (summary API 활용)

```typescript
// 원본 언어 옵션
const sourceLanguageOptions = useMemo(() => {
  if (!summaryData) return [];
  return Object.keys(summaryData.language_distribution || {})
    .sort()
    .map(code => ({
      value: code,
      label: getLanguageKoreanName(code),
      sublabel: code
    }));
}, [summaryData]);

// 번역 언어 옵션
const targetLanguageOptions = useMemo(() => {
  if (!summaryData) return [];
  return Object.keys(summaryData.target_language_distribution || {})
    .sort()
    .map(code => ({
      value: code,
      label: getLanguageKoreanName(code),
      sublabel: code
    }));
}, [summaryData]);

// 점번 옵션
const deptCodeOptions = useMemo(() => {
  if (!summaryData?.dept_codes) return [];
  return [...summaryData.dept_codes]
    .sort()
    .map(code => ({
      value: code,
      label: getDeptName(code),
      sublabel: code
    }));
}, [summaryData?.dept_codes]);

// 사용자 옵션
const userNameOptions = useMemo(() => {
  if (!summaryData?.all_users) return [];
  return [...summaryData.all_users].map(name => ({
    value: name,
    label: name
  }));
}, [summaryData?.all_users]);
```

---

## 5. 통계 카드 컴포넌트 (StatisticsCards)

### 5.1 Props 인터페이스

```typescript
interface StatisticsCardsProps {
  data: GetSummaryApiChatRoomMessagesSummaryGetApiResponse;
}
```

### 5.2 차트 색상 및 언어 매핑

```typescript
const COLORS = ["#D52210", "#FF6B5B", "#FFB347", "#4CAF50", "#2196F3", "#9C27B0", "#607D8B", "#795548"];

const languageNames: Record<string, string> = {
  en: "영어",
  zh: "중국어(간체)",
  "zh-hant": "중국어(번체)",
  "zh-tw": "중국어(대만)",
  ja: "일본어",
  vi: "베트남어",
  uz: "우즈베크어",
  ru: "러시아어",
  ne: "네팔어",
  bn: "벵골어",
  th: "태국어",
  mn: "몽골어",
  id: "인도네시아어",
  km: "크메르어",
  pt: "포르투갈어",
  si: "싱할라어",
  ko: "한국어",
  tl: "타갈로그어",
  my: "미얀마어",
};
```

### 5.3 데이터 가공 함수들

```typescript
// KST 변환 함수
const convertToKST = (utcDateString: string): string => {
  const date = new Date(utcDateString);
  if (isNaN(date.getTime())) return utcDateString;
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(date.getTime() + kstOffset);
  const month = kstDate.getMonth() + 1;
  const day = kstDate.getDate();
  return `${month}/${day}`;
};

// 번역 품질 지표
const qualityMetrics = useMemo(() => ({
  liked: data.like_distribution.LIKED,
  disliked: data.like_distribution.DISLIKED,
  satisfactionRate: data.satisfaction_rate,
}), [data.like_distribution, data.satisfaction_rate]);

// 시간대별 데이터 (0-23시)
const hourlyData = useMemo(() => {
  const hourlyWithPercentage = data.hourly_distribution_with_percentage || {};
  return Array.from({ length: 24 }, (_, i) => {
    const isBusinessHour = i >= 9 && i < 16;
    const isLunchHour = i >= 12 && i < 13;
    const hourData = hourlyWithPercentage[i.toString()] || { count: 0, percentage: 0 };
    return {
      hour: `${i}시`,
      count: hourData.count,
      isBusinessHour,
      isLunchHour,
      percentage: hourData.percentage,
    };
  });
}, [data.hourly_distribution_with_percentage]);

// 시간대 그룹별 통계
const hourlyGroupStats = useMemo(() => {
  const groupStats = data.hourly_group_stats || {
    business: { count: 0, percentage: 0 },
    lunch: { count: 0, percentage: 0 },
    off_hours: { count: 0, percentage: 0 }
  };
  return {
    business: groupStats.business,
    lunch: groupStats.lunch,
    offHours: groupStats.off_hours,
  };
}, [data.hourly_group_stats]);

// 일별 추이 데이터
const dailyData = useMemo(() => {
  const dailyWithPercentage = data.daily_distribution_with_percentage || {};
  const entries = Object.entries(dailyWithPercentage)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());

  const maxPoints = 30;
  const step = entries.length > maxPoints ? Math.ceil(entries.length / maxPoints) : 1;

  return entries
    .filter((_, index) => index % step === 0 || index === entries.length - 1)
    .map(([date, dailyInfo]) => ({
      date: convertToKST(date),
      count: (dailyInfo as { count: number; percentage: number }).count,
      percentage: (dailyInfo as { count: number; percentage: number }).percentage,
    }));
}, [data.daily_distribution_with_percentage]);

// 언어별 분포 데이터 (파이 차트용)
const languageData = useMemo(() => {
  return Object.entries(data.language_distribution)
    .sort(([, a], [, b]) => b - a)
    .map(([lang, count]) => ({
      name: languageNames[lang] || lang,
      value: count,
    }));
}, [data.language_distribution]);

// 번역 언어 분포 데이터
const targetLanguageData = useMemo(() => {
  if (!data.target_language_distribution) return [];
  return Object.entries(data.target_language_distribution)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([lang, count]) => ({
      name: languageNames[lang] || lang,
      value: count as number,
    }));
}, [data.target_language_distribution]);

// 피크 시간대
const peakHour = useMemo(() => {
  if (data.peak_hour === null) return null;
  return { hour: data.peak_hour, count: data.peak_hour_count };
}, [data.peak_hour, data.peak_hour_count]);

// 역할별 분포 데이터
const roleData = useMemo(() => {
  const roles = [
    { name: "은행원", value: data.role_distribution.banker, color: "#D52210" },
    { name: "고객", value: data.role_distribution.customer, color: "#2196F3" },
  ];
  if (data.role_distribution.system > 0) {
    roles.push({ name: "시스템", value: data.role_distribution.system, color: "#607D8B" });
  }
  return roles;
}, [data.role_distribution]);

// 숫자 포맷팅
const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
};
```

### 5.4 차트 컴포넌트 사용 예시

#### 시간대별 바 차트

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

<div className="h-[200px]">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={hourlyData}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} stroke="#9ca3af" />
      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
      <Tooltip
        contentStyle={{
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          fontSize: "12px",
        }}
        formatter={(value: number, _name: string, props: any) => {
          const { isBusinessHour, isLunchHour, percentage } = props.payload;
          let label = "영업외";
          if (isLunchHour) label = "점심시간";
          else if (isBusinessHour) label = "영업시간";
          return [`${value.toLocaleString()}건 (${percentage}%)`, label];
        }}
      />
      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#E0E0E0">
        {hourlyData.map((entry, index) => (
          <Cell
            key={`cell-${index}`}
            fill={
              entry.isLunchHour
                ? "#FFB347"
                : entry.isBusinessHour
                ? "#D52210"
                : "#E0E0E0"
            }
          />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
</div>
```

#### 일별 추이 영역 차트

```tsx
import { AreaChart, Area } from "recharts";

<div className="h-[200px]">
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={dailyData}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
      <Tooltip
        contentStyle={{
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          fontSize: "12px",
        }}
        formatter={(value: number, _name: string, props: any) => {
          const { percentage } = props.payload;
          return [`${value.toLocaleString()}건 (${percentage}%)`, "메시지"];
        }}
      />
      <Area
        type="monotone"
        dataKey="count"
        stroke="#D52210"
        fill="url(#colorGradient)"
        strokeWidth={2}
      />
      <defs>
        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#D52210" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#D52210" stopOpacity={0} />
        </linearGradient>
      </defs>
    </AreaChart>
  </ResponsiveContainer>
</div>
```

#### 파이 차트

```tsx
import { PieChart, Pie, Cell } from "recharts";

<div className="h-[200px] flex items-center">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        data={languageData}
        cx="50%"
        cy="50%"
        innerRadius={50}
        outerRadius={80}
        paddingAngle={2}
        dataKey="value"
        nameKey="name"
      >
        {languageData.map((_, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={{
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          fontSize: "12px",
        }}
        formatter={(value: number, name: string) => [`${value.toLocaleString()}건`, name]}
      />
    </PieChart>
  </ResponsiveContainer>
</div>
```

---

## 6. 커스텀 UI 컴포넌트

### 6.1 DatePicker 컴포넌트

```tsx
// components/ui/date-picker.tsx
import * as React from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover as HeadlessPopover, Transition, Portal } from "@headlessui/react";
import { Fragment, useRef, useState, useEffect } from "react";

export interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean | ((date: Date) => boolean);
  className?: string;
  buttonClassName?: string;
  calendarClassName?: string;
  dateFormat?: string;
  showOutsideDays?: boolean;
  popoverSide?: "top" | "right" | "bottom" | "left";
  popoverAlign?: "start" | "center" | "end";
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  ({
    date,
    onDateChange,
    placeholder = "Pick a date",
    disabled,
    className,
    buttonClassName,
    calendarClassName,
    dateFormat = "yyyy. MM. dd",
    showOutsideDays = true,
    popoverSide = "bottom",
    popoverAlign = "start",
    ...props
  }, ref) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

    const updateButtonRect = () => {
      if (buttonRef.current) {
        setButtonRect(buttonRef.current.getBoundingClientRect());
      }
    };

    useEffect(() => {
      window.addEventListener("scroll", updateButtonRect, true);
      window.addEventListener("resize", updateButtonRect);
      return () => {
        window.removeEventListener("scroll", updateButtonRect, true);
        window.removeEventListener("resize", updateButtonRect);
      };
    }, []);

    // ... 포지셔닝 로직 생략

    return (
      <div className={cn("relative inline-block", className)}>
        <HeadlessPopover>
          {({ open }) => (
            <>
              <HeadlessPopover.Button
                ref={buttonRef}
                onClick={updateButtonRect}
                as={Button}
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal whitespace-nowrap",
                  !date && "text-muted-foreground",
                  buttonClassName
                )}
                disabled={typeof disabled === "boolean" ? disabled : false}
                {...props}
              >
                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span>{date ? format(date, dateFormat, { locale: ko }) : placeholder}</span>
              </HeadlessPopover.Button>

              <Portal>
                <Transition
                  show={open}
                  as={Fragment}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <HeadlessPopover.Panel
                    static
                    className="fixed z-[9999] rounded-md border bg-white shadow-lg p-0"
                    style={{ /* 포지셔닝 스타일 */ }}
                  >
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={onDateChange}
                      disabled={typeof disabled === "function" ? disabled : undefined}
                      initialFocus
                      showOutsideDays={showOutsideDays}
                      className={calendarClassName}
                    />
                  </HeadlessPopover.Panel>
                </Transition>
              </Portal>
            </>
          )}
        </HeadlessPopover>
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
export { DatePicker };
```

### 6.2 MultiSelectCombobox 컴포넌트

```tsx
// components/ui/multi-select-combobox.tsx
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import * as React from "react";
import { Combobox, Transition, Portal } from "@headlessui/react";
import { Fragment, useRef, useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: number;
}

export function MultiSelectCombobox({
  options,
  value = [],
  onValueChange,
  placeholder = "선택하세요...",
  searchPlaceholder = "검색...",
  emptyText = "검색 결과가 없습니다.",
  className,
  disabled = false,
  maxHeight = 300,
}: MultiSelectComboboxProps) {
  const [searchValue, setSearchValue] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // 선택된 옵션들
  const selectedOptions = useMemo(() =>
    options.filter((option) => value.includes(option.value)),
    [options, value]
  );

  // 필터링된 옵션들
  const filteredOptions = useMemo(() => {
    if (!searchValue) return options;
    const searchLower = searchValue.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchLower) ||
        option.sublabel?.toLowerCase().includes(searchLower) ||
        option.value.toLowerCase().includes(searchLower),
    );
  }, [options, searchValue]);

  const handleSelect = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onValueChange?.(newValue);
  };

  const handleSelectAll = () => {
    if (value.length === filteredOptions.length) {
      onValueChange?.([]);
    } else {
      onValueChange?.(filteredOptions.map((o) => o.value));
    }
  };

  // ... 나머지 핸들러 및 렌더링 로직
}
```

### 6.3 Calendar 컴포넌트

```tsx
// components/ui/calendar.tsx
import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CalendarProps = {
  className?: string;
  classNames?: { /* 스타일 클래스 */ };
  showOutsideDays?: boolean;
  mode?: "single";
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  initialFocus?: boolean;
};

const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  selected,
  onSelect,
  disabled,
  ...props
}: CalendarProps) => {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDateClick = (date: Date) => {
    if (disabled && disabled(date)) return;
    onSelect?.(date);
  };

  // 헤더, 요일, 날짜 렌더링...
  return (
    <div className={cn("p-3", className)} {...props}>
      {/* 렌더링 내용 */}
    </div>
  );
};

Calendar.displayName = "Calendar";
export { Calendar };
```

### 6.4 유틸리티 함수 (cn)

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 7. 설치 및 설정 방법

### 7.1 필수 패키지 설치

```bash
# 핵심 라이브러리
npm install @reduxjs/toolkit react-redux

# 차트
npm install recharts

# UI 컴포넌트
npm install @headlessui/react @radix-ui/react-tooltip lucide-react

# 날짜 처리
npm install date-fns

# 스타일링
npm install tailwindcss tailwind-merge class-variance-authority clsx

# 알림
npm install react-toastify
```

### 7.2 Redux Store 설정

```typescript
// store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import { enhancedApi } from "@/redux/services/chatroommessages";

export const store = configureStore({
  reducer: {
    [enhancedApi.reducerPath]: enhancedApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(enhancedApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 7.3 환경 변수 설정

```env
# .env
VITE_APP_BASE_URL=https://your-api-server.com
VITE_APP_SHOW_CHAT_IN_STATISTICS=TRUE  # 대화 내용 표시 여부
```

### 7.4 Tailwind CSS 설정

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#D52210",
      },
    },
  },
  plugins: [],
};
```

---

## 부록: 전체 컴포넌트 import 예시

```typescript
// ChatStatistics.tsx 상단 imports
import { useState, useMemo, useEffect } from "react";
import {
  useGetStatisticsApiChatRoomMessagesStatisticsGetQuery,
  useGetSummaryApiChatRoomMessagesSummaryGetQuery,
  useVerifyAccessKeyApiChatRoomMessagesVerifyAccessKeyPostMutation,
  useReadAllApiChatRoomMessagesGetQuery,
  useDownloadStatisticsExcelMutation,
} from "@/redux/services/chatroommessages";
import StatisticsCards from "./StatisticsCards";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { toast } from "react-toastify";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Eye,
  ThumbsUp,
  ThumbsDown,
  X,
  Download,
  HelpCircle,
  BarChart3,
  Search,
  Calendar,
  Filter,
  RefreshCw,
} from "lucide-react";
```

```typescript
// StatisticsCards.tsx 상단 imports
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { GetSummaryApiChatRoomMessagesSummaryGetApiResponse } from "@/redux/services/chatroommessages";
import {
  MessageSquare,
  Languages,
  Users,
  Clock,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
} from "lucide-react";
```

---

## 라이선스

이 코드는 내부 프로젝트용으로 작성되었습니다.
