export interface Partner {
	id: string;
	name: string;
	description: string;
	logo: string;
	website?: string;
	industry: string;
	partnership_type: "technology" | "supply" | "distribution" | "strategic";
	established_year?: number;
	location: string;
	products?: string[];
	collaboration_areas: string[];
}

export const partners: Partner[] = [
	{
		id: "partner-001",
		name: "프리시전테크",
		description:
			"고정밀 측정기기 전문 제조사로서 3차원 측정기와 레이저 간섭계 분야에서 혁신적인 기술을 보유하고 있습니다.",
		logo: "/images/partners/precisiontech-logo.png",
		website: "https://www.precisiontech.com",
		industry: "정밀측정기기",
		partnership_type: "technology",
		established_year: 1998,
		location: "대전, 대한민국",
		products: ["3차원 좌표 측정기(CMM)", "레이저 간섭계", "광학 3D 스캐너"],
		collaboration_areas: [
			"정밀 측정 시스템",
			"품질 검사 솔루션",
			"자동화 측정",
		],
	},
	{
		id: "partner-002",
		name: "넥스트스티어링",
		description:
			"자동차 조향장치 측정 시스템 전문기업으로 혁신적인 베어링 측정 솔루션을 제공합니다.",
		logo: "/images/partners/nextsteering-logo.png",
		website: "https://www.nextsteering.com",
		industry: "자동차부품",
		partnership_type: "strategic",
		established_year: 2005,
		location: "울산, 대한민국",
		products: ["베어링 간극 측정기", "조향축 측정시스템", "TRACK 측정기"],
		collaboration_areas: ["조향장치 측정", "품질 관리", "자동화 검사"],
	},
	{
		id: "partner-003",
		name: "세미콘솔루션즈",
		description:
			"반도체 검사장비 전문기업으로서 웨이퍼 측정과 패턴 검사 분야의 선도적 기술을 보유하고 있습니다.",
		logo: "/images/partners/semicon-logo.png",
		website: "https://www.semiconsolutions.com",
		industry: "반도체장비",
		partnership_type: "technology",
		established_year: 2008,
		location: "화성, 대한민국",
		products: ["웨이퍼 두께 측정기", "패턴 정렬도 측정기", "표면 결함 검사기"],
		collaboration_areas: ["반도체 검사", "정밀 측정", "결함 분석"],
	},
	{
		id: "partner-004",
		name: "엔진테크놀로지",
		description:
			"자동차 엔진 측정 및 검사 시스템 전문기업으로 베어링 간극 측정 분야에서 우수한 기술력을 보유하고 있습니다.",
		logo: "/images/partners/enginetech-logo.png",
		website: "https://www.enginetech.com",
		industry: "자동차엔진",
		partnership_type: "supply",
		established_year: 2001,
		location: "창원, 대한민국",
		products: [
			"크랭크샤프트 베어링 간극 측정기",
			"실린더 보어 측정기",
			"밸브 시트 측정기",
		],
		collaboration_areas: ["엔진 측정", "정밀 가공", "품질 검사"],
	},
	{
		id: "partner-005",
		name: "메트롤로지시스템즈",
		description:
			"산업용 측정기기 유통 전문기업으로서 글로벌 정밀 측정 장비의 공급과 기술 지원을 제공합니다.",
		logo: "/images/partners/metrology-logo.png",
		industry: "측정기기유통",
		partnership_type: "distribution",
		established_year: 1995,
		location: "인천, 대한민국",
		products: ["3차원 측정기", "표면 거칠기 측정기", "형상 측정기"],
		collaboration_areas: ["장비 유통", "기술 지원", "애프터서비스"],
	},
	{
		id: "partner-006",
		name: "스마트팩토리솔루션",
		description:
			"자동화 측정 시스템 전문기업으로 스마트 팩토리를 위한 통합 측정 솔루션을 제공합니다.",
		logo: "/images/partners/smartfactory-logo.png",
		website: "https://www.smartfactorysolution.com",
		industry: "자동화시스템",
		partnership_type: "strategic",
		established_year: 2012,
		location: "성남, 대한민국",
		products: [
			"자동 측정 시스템",
			"측정 데이터 분석 소프트웨어",
			"교정 시스템",
		],
		collaboration_areas: ["공정 자동화", "데이터 분석", "시스템 통합"],
	},
];

export const partnershipTypes = {
	technology: "기술 파트너십",
	supply: "공급 파트너십",
	distribution: "유통 파트너십",
	strategic: "전략적 제휴",
};

export const industries = [
	"정밀측정기기",
	"자동차부품",
	"반도체장비",
	"자동차엔진",
	"측정기기유통",
	"자동화시스템",
];
