import type { Category } from "@/lib/api/types/category";
import type { Product } from "@/lib/api/types/product";

// Test mode products data that matches the API structure
export const mockProducts: Product[] = [
	{
		id: "1",
		category_id: "1",
		category_name: "외륜",
		category_path: "조향장치 > 외륜",
		name: "CAULKING GAUGE",
		description:
			"베어링 외륜의 코킹 부위를 정밀하게 측정하는 전용 게이지입니다. 자동차 휠 베어링의 코킹 품질 검사에 최적화되어 조향 성능과 안전성을 보장합니다.",
		features: "정밀 측정, 코킹 품질 검사, 조향 성능 보장",
		specifications: {
			"측정 범위": "0.1-10mm",
			정밀도: "±0.001mm",
			"적용 분야": "자동차 휠 베어링",
		},
		is_featured: true,
		is_active: true,
		sort_order: 1,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "1",
				product_id: "1",
				s3_file_id: "1",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/30328af9-10ba-4408-ac1f-4d60a47ca02e.png",
				file_name: "caulking-gauge.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
			{
				id: "2",
				product_id: "1",
				s3_file_id: "2",
				file_url: "https://disziplin1.github.io/TJT_/TRUNNION/Journal_DIA/",
				file_name: "demo-video.mp4",
				file_size: 5024000,
				media_type: "video",
				is_primary: false,
				is_active: true,
				sort_order: 2,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
	{
		id: "2",
		category_id: "1",
		category_name: "외륜",
		category_path: "조향장치 > 외륜",
		name: "내경기준 외경동심도 측정기",
		description:
			"조향 베어링 외륜의 내경을 기준으로 외경의 동심도를 정밀하게 측정합니다. 조향감의 정확성과 진동 특성에 직접적인 영향을 미치는 동심도 오차를 마이크로미터 단위로 측정합니다.",
		features: "동심도 측정, 마이크로미터 정밀도, 진동 특성 분석",
		specifications: {
			"측정 범위": "0.001-1.000mm",
			정밀도: "±0.0001mm",
			"적용 분야": "베어링 정밀도",
		},
		is_featured: false,
		is_active: true,
		sort_order: 2,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "3",
				product_id: "2",
				s3_file_id: "3",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/9d7ea8f8-88a5-4918-a6b5-6ada18261742.png",
				file_name: "concentricity-1.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
			{
				id: "4",
				product_id: "2",
				s3_file_id: "4",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/60e0c37e-aed1-48fc-82c1-ad17fbf011aa.png",
				file_name: "concentricity-2.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: false,
				is_active: true,
				sort_order: 2,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
			{
				id: "5",
				product_id: "2",
				s3_file_id: "5",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/1c488597-6fea-4a46-a695-bea9010238c9.png",
				file_name: "concentricity-3.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: false,
				is_active: true,
				sort_order: 3,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
	{
		id: "3",
		category_id: "1",
		category_name: "외륜",
		category_path: "조향장치 > 외륜",
		name: "P ERROR GAUGE",
		description:
			"베어링 외륜의 피치 오차를 정확하게 측정하는 정밀 게이지입니다. 조향 베어링의 회전 정밀도와 소음 특성에 직접적인 영향을 미치는 피치 정확도를 관리합니다.",
		features: "피치 오차 측정, 회전 정밀도 관리, 소음 특성 분석",
		specifications: {
			"측정 범위": "0.01-5.00mm",
			정밀도: "±0.001mm",
			"적용 분야": "피치 검사",
		},
		is_featured: false,
		is_active: true,
		sort_order: 3,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "6",
				product_id: "3",
				s3_file_id: "6",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/10418312-a0ce-4456-9b35-f7ec753c1166.png",
				file_name: "p-error-gauge.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
	{
		id: "4",
		category_id: "1",
		category_name: "외륜",
		category_path: "조향장치 > 외륜",
		name: "GO/NOGO SPLINE RING GAUGE",
		description:
			"조향 시스템의 스플라인 형상 합격/불합격을 신속하게 판정하는 링 게이지입니다. 조향축과 조향 기어박스의 스플라인 연결부 품질 검사에 필수적입니다.",
		features: "합격/불합격 판정, 신속 검사, 스플라인 형상 측정",
		specifications: {
			"측정 범위": "표준 스플라인 규격",
			정밀도: "ISO 규격 준수",
			"적용 분야": "스플라인 검사",
		},
		is_featured: true,
		is_active: true,
		sort_order: 4,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "7",
				product_id: "4",
				s3_file_id: "7",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/18f80a44-9a76-464f-b147-b996a91ecb43.png",
				file_name: "spline-ring-gauge.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
	{
		id: "5",
		category_id: "1",
		category_name: "외륜",
		category_path: "조향장치 > 외륜",
		name: "TRACK 심위치 측정기",
		description:
			"조향 베어링 외륜의 트랙 중심 위치를 정밀하게 측정합니다. 베어링 회전 시 하중 분포와 조향 성능에 직접적인 영향을 미치는 핵심 품질 요소를 관리합니다.",
		features: "트랙 중심 위치 측정, 하중 분포 분석, 조향 성능 최적화",
		specifications: {
			"측정 범위": "0.001-10.000mm",
			정밀도: "±0.0005mm",
			"적용 분야": "트랙 정밀도",
		},
		is_featured: false,
		is_active: true,
		sort_order: 5,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "8",
				product_id: "5",
				s3_file_id: "8",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/b8ecc1b3-a2f5-4e10-966f-e15ec4bc15fd.jpg",
				file_name: "track-center-1.jpg",
				file_size: 2048000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
			{
				id: "9",
				product_id: "5",
				s3_file_id: "9",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/5fcc762c-a526-4845-8e08-df7372504515.jpg",
				file_name: "track-center-2.jpg",
				file_size: 2048000,
				media_type: "image",
				is_primary: false,
				is_active: true,
				sort_order: 2,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
	{
		id: "6",
		category_id: "2",
		category_name: "내륜",
		category_path: "조향장치 > 내륜",
		name: "PCR측정기",
		description:
			"조향 베어링 내륜과 축 사이의 클리어런스를 정확하게 측정하여 조향감과 내구성을 최적화합니다. 조향 시스템의 적절한 끼워맞춤을 보장합니다.",
		features: "클리어런스 측정, 조향감 최적화, 내구성 향상",
		specifications: {
			"측정 범위": "0.001-0.100mm",
			정밀도: "±0.0001mm",
			"적용 분야": "베어링 조립",
		},
		is_featured: true,
		is_active: true,
		sort_order: 6,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "10",
				product_id: "6",
				s3_file_id: "10",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/13f657a0-4430-437a-a53a-b37b89267ea8.png",
				file_name: "pcr-1.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
			{
				id: "11",
				product_id: "6",
				s3_file_id: "11",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/22409585-87da-4404-87da-3aa2d5ad83ae.png",
				file_name: "pcr-2.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: false,
				is_active: true,
				sort_order: 2,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
	{
		id: "7",
		category_id: "3",
		category_name: "비접촉식",
		category_path: "측정기 > 비접촉식",
		name: "레이저 간섭계",
		description:
			"레이저 간섭 원리를 이용한 초정밀 거리 측정 장비입니다. 나노미터 분해능으로 변위와 진동을 측정하여 정밀 기계와 측정 장비의 교정에 활용됩니다.",
		features: "나노미터 분해능, 비접촉 측정, 레이저 간섭 원리",
		specifications: {
			"측정 범위": "0.1nm-1m",
			정밀도: "±0.1nm",
			"적용 분야": "정밀 측정, 교정 시스템",
		},
		is_featured: true,
		is_active: true,
		sort_order: 7,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "12",
				product_id: "7",
				s3_file_id: "12",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/9e49a0a4-e40e-436f-8b87-218b579c6a38.png",
				file_name: "laser-interferometer.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
	{
		id: "8",
		category_id: "4",
		category_name: "반도체",
		category_path: "반도체 > 반도체",
		name: "웨이퍼 두께 측정기",
		description:
			"반도체 웨이퍼의 두께를 나노미터 정밀도로 측정하는 장비입니다. 웨이퍼 전면의 두께 균일성과 평탄도를 실시간으로 모니터링하여 반도체 공정 품질을 보장합니다.",
		features: "나노미터 정밀도, 실시간 모니터링, 두께 균일성 측정",
		specifications: {
			"측정 범위": "1nm-10mm",
			정밀도: "±1nm",
			"적용 분야": "반도체, 웨이퍼 검사",
		},
		is_featured: false,
		is_active: true,
		sort_order: 8,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "13",
				product_id: "8",
				s3_file_id: "13",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/83a7ec11-2160-406c-8ded-cedb94c423e7.png",
				file_name: "wafer-thickness.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
	{
		id: "9",
		category_id: "5",
		category_name: "베어링 간극측정",
		category_path: "엔진 > 베어링 간극측정",
		name: "크랭크샤프트 베어링 간극 측정기",
		description:
			"엔진 크랭크샤프트와 베어링 사이의 간극을 정밀 측정하여 엔진 성능과 수명을 최적화합니다. 오일 압력과 윤활 특성에 직접적인 영향을 미치는 핵심 측정 장비입니다.",
		features: "정밀 간극 측정, 엔진 성능 최적화, 윤활 특성 분석",
		specifications: {
			"측정 범위": "0.001-0.500mm",
			정밀도: "±0.0005mm",
			"적용 분야": "엔진, 크랭크샤프트",
		},
		is_featured: true,
		is_active: true,
		sort_order: 9,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "14",
				product_id: "9",
				s3_file_id: "14",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/36ee0e41-4512-4d4b-a0c2-7bf72159b1d2.jpg",
				file_name: "crankshaft-clearance.jpg",
				file_size: 2048000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
	{
		id: "10",
		category_id: "5",
		category_name: "베어링 간극측정",
		category_path: "엔진 > 베어링 간극측정",
		name: "컨로드 베어링 간극 측정기",
		description:
			"연결봉(컨로드) 베어링의 간극을 정밀 측정하여 엔진의 회전 균형과 진동 특성을 관리합니다. 피스톤 운동의 정밀도와 엔진 내구성에 직접적인 영향을 미칩니다.",
		features: "회전 균형 분석, 진동 특성 관리, 피스톤 운동 정밀도",
		specifications: {
			"측정 범위": "0.001-0.300mm",
			정밀도: "±0.0005mm",
			"적용 분야": "엔진, 연결봉 베어링",
		},
		is_featured: false,
		is_active: true,
		sort_order: 10,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		media: [
			{
				id: "15",
				product_id: "10",
				s3_file_id: "15",
				file_url:
					"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/36e297c7-94b5-4cb7-aa6c-77d48f6d494b.png",
				file_name: "connecting-rod-clearance.png",
				file_size: 1024000,
				media_type: "image",
				is_primary: true,
				is_active: true,
				sort_order: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			},
		],
	},
];

// Mock categories data
export const mockCategories: Category[] = [
	{
		id: "1",
		name: "외륜",
		description: "조향장치 외륜 관련 측정 장비",
		parent_id: "11",
		path: "11.1",
		sort_order: 1,
		is_active: true,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	},
	{
		id: "2",
		name: "내륜",
		description: "조향장치 내륜 관련 측정 장비",
		parent_id: "11",
		path: "11.2",
		sort_order: 2,
		is_active: true,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	},
	{
		id: "3",
		name: "비접촉식",
		description: "비접촉식 측정 장비",
		parent_id: "12",
		path: "12.3",
		sort_order: 1,
		is_active: true,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	},
	{
		id: "4",
		name: "반도체",
		description: "반도체 관련 측정 장비",
		parent_id: "13",
		path: "13.4",
		sort_order: 1,
		is_active: true,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	},
	{
		id: "5",
		name: "베어링 간극측정",
		description: "엔진 베어링 간극 측정 장비",
		parent_id: "14",
		path: "14.5",
		sort_order: 1,
		is_active: true,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	},
	{
		id: "11",
		name: "조향장치",
		description: "자동차 조향 시스템용 정밀 측정 장비",
		parent_id: undefined,
		path: "11",
		sort_order: 1,
		is_active: true,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	},
	{
		id: "12",
		name: "측정기",
		description: "산업용 정밀 측정 및 검사 장비",
		parent_id: undefined,
		path: "12",
		sort_order: 2,
		is_active: true,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	},
	{
		id: "13",
		name: "반도체",
		description: "반도체 제조 공정용 정밀 측정 및 검사 장비",
		parent_id: undefined,
		path: "13",
		sort_order: 3,
		is_active: true,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	},
	{
		id: "14",
		name: "엔진",
		description: "자동차 엔진 시스템용 정밀 측정 및 가공 장비",
		parent_id: undefined,
		path: "14",
		sort_order: 4,
		is_active: true,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
	},
];

// Legacy export for backward compatibility
export const products = {
	industries: [
		{
			industry: "조향장치",
			description: "자동차 조향 시스템용 정밀 측정 장비",
			categories: [
				{
					category: "외륜",
					items: [
						{
							name: "CAULKING GAUGE",
							path: "/products/steering/outer-ring/caulking-gauge",
							description:
								"베어링 외륜의 코킹 부위를 정밀하게 측정하는 전용 게이지입니다. 자동차 휠 베어링의 코킹 품질 검사에 최적화되어 조향 성능과 안전성을 보장합니다.",
							applications: ["조향장치", "휠 베어링"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/30328af9-10ba-4408-ac1f-4d60a47ca02e.png",
							],
							hasVideo: true,
							videoUrl:
								"https://disziplin1.github.io/TJT_/TRUNNION/Journal_DIA/",
						},
						{
							name: "내경기준 외경동심도 측정기",
							path: "/products/steering/outer-ring/concentricity",
							description:
								"조향 베어링 외륜의 내경을 기준으로 외경의 동심도를 정밀하게 측정합니다. 조향감의 정확성과 진동 특성에 직접적인 영향을 미치는 동심도 오차를 마이크로미터 단위로 측정합니다.",
							applications: ["조향장치", "베어링 정밀도"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/9d7ea8f8-88a5-4918-a6b5-6ada18261742.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/60e0c37e-aed1-48fc-82c1-ad17fbf011aa.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/1c488597-6fea-4a46-a695-bea9010238c9.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "P ERROR GAUGE",
							path: "/products/steering/outer-ring/p-error",
							description:
								"베어링 외륜의 피치 오차를 정확하게 측정하는 정밀 게이지입니다. 조향 베어링의 회전 정밀도와 소음 특성에 직접적인 영향을 미치는 피치 정확도를 관리합니다.",
							applications: ["조향장치", "피치 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/10418312-a0ce-4456-9b35-f7ec753c1166.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "GO/NOGO SPLINE RING GAUGE",
							path: "/products/steering/outer-ring/spline-ring",
							description:
								"조향 시스템의 스플라인 형상 합격/불합격을 신속하게 판정하는 링 게이지입니다. 조향축과 조향 기어박스의 스플라인 연결부 품질 검사에 필수적입니다.",
							applications: ["조향장치", "스플라인 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/18f80a44-9a76-464f-b147-b996a91ecb43.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "TRACK 심위치 측정기",
							path: "/products/steering/outer-ring/track-center",
							description:
								"조향 베어링 외륜의 트랙 중심 위치를 정밀하게 측정합니다. 베어링 회전 시 하중 분포와 조향 성능에 직접적인 영향을 미치는 핵심 품질 요소를 관리합니다.",
							applications: ["조향장치", "트랙 정밀도"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/b8ecc1b3-a2f5-4e10-966f-e15ec4bc15fd.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/5fcc762c-a526-4845-8e08-df7372504515.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/9a02aaf0-0f44-4032-b686-25ad180fc5bd.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/43f0ce18-a50e-4df3-bcda-7476823dd8eb.jpg",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "PCD측정기",
							path: "/products/steering/outer-ring/pcd",
							description:
								"베어링 외륜의 PCD(Pitch Circle Diameter)를 정밀 측정하여 볼 베어링의 조립 정밀도를 보장합니다. 볼의 위치 정확도와 하중 분포 균일성을 관리합니다.",
							applications: ["조향장치", "PCD 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/9bd73fb9-0033-4009-8591-81e72ec007b0.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/2db44fb0-31af-454d-a3fd-416598dc16a8.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/e591b593-19b1-4472-8916-f63c9e7d0749.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/ffb3c898-698c-4394-a510-e285c12c2855.jpg",
							],
							hasVideo: false,
							videoUrl: "",
						},
					],
				},
				{
					category: "내륜",
					items: [
						{
							name: "PCR측정기",
							path: "/products/steering/inner-ring/pcr",
							description:
								"조향 베어링 내륜과 축 사이의 클리어런스를 정확하게 측정하여 조향감과 내구성을 최적화합니다. 조향 시스템의 적절한 끼워맞춤을 보장합니다.",
							applications: ["조향장치", "베어링 조립"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/13f657a0-4430-437a-a53a-b37b89267ea8.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/22409585-87da-4404-87da-3aa2d5ad83ae.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/9ac29894-08af-4d95-878b-73ca608a5bee.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "TRACK심위치 측정기",
							path: "/products/steering/inner-ring/track-position",
							description:
								"조향 베어링 내륜의 트랙 중심 위치를 정확하게 측정합니다. 조향 시 하중 분포와 회전 정밀도에 직접적인 영향을 미치는 핵심 품질 요소를 관리합니다.",
							applications: ["조향장치", "베어링 정밀도"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/b4d9d547-1758-4ce1-b1e6-bca264c4e381.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/945ec3ee-68fa-4378-a0ad-8fbf62d8d8ea.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/b8af808a-b60e-40a5-af76-1c2771a72a41.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "외경&트랙동심도 측정기",
							path: "/products/steering/inner-ring/outer-track-concentricity",
							description:
								"베어링 내륜의 외경과 트랙 간의 동심도를 측정합니다. 내륜의 기하학적 정밀도를 종합적으로 평가하여 조향 베어링의 회전 안정성을 보장합니다.",
							applications: ["조향장치", "동심도 분석"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/1547f96d-7701-4cf4-88d3-e27a45f6a02f.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "SPLINE BAR GAUGE",
							path: "/products/steering/inner-ring/spline-bar",
							description:
								"조향축 내륜의 스플라인 형상을 정밀하게 측정하여 조향 전달 정확도를 보장합니다. 스플라인의 피치, 치형, 치폭 등을 동시에 측정합니다.",
							applications: ["조향장치", "조향축 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/e79d4479-32ae-4df5-8827-700017518523.png",
							],
							hasVideo: false,
							videoUrl: "test",
						},
						{
							name: "PCD각도 측정기",
							path: "/products/steering/inner-ring/pcd-angle",
							description:
								"베어링 내륜의 PCD 각도를 정밀 측정하여 볼 베어링의 각도 정확도를 보장합니다. 볼의 각도 배치와 회전 균형성에 직접적인 영향을 미칩니다.",
							applications: ["조향장치", "각도 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/24627543-9e35-4ce7-a76c-86bd708ae81e.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
					],
				},
				{
					category: "케이지",
					items: [
						{
							name: "내경 DIA 측정기",
							path: "/products/steering/cage/dia",
							description:
								"조향 베어링 케이지 내경을 정밀 측정하여 볼 베어링의 안정적인 회전과 조향감을 보장합니다. 3점 또는 4점 측정 방식을 통해 진원도와 평균 직경을 정확히 측정합니다.",
							applications: ["조향장치", "베어링 케이지"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/18cee2f6-00b5-4661-8c68-80d51799ff48.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "내경심위치 측정기",
							path: "/products/steering/cage/inner-position",
							description:
								"조향 베어링 케이지 내경의 중심 위치를 정밀하게 측정합니다. 조향 시 롤링 엘리먼트의 균등한 하중 분포와 안정적인 회전 성능을 보장합니다.",
							applications: ["조향장치", "베어링 안정성"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/24c776bb-9999-4d7e-854c-043be912ff2c.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "내경 기준 외경동심도 측정기",
							path: "/products/steering/cage/inner-outer-concentricity",
							description:
								"케이지의 내경을 기준으로 외경의 동심도를 정밀 측정합니다. 케이지의 기하학적 정밀도를 보장하여 베어링 전체의 회전 성능과 수명을 향상시킵니다.",
							applications: ["조향장치", "케이지 동심도"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/82ce36f9-b352-41dd-8e53-ade711730fc5.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/d661646f-637c-459f-94e5-b8012fb612c9.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "창폭창위치 측정기",
							path: "/products/steering/cage/pocket",
							description:
								"조향 베어링 케이지의 포켓 정밀도를 측정하여 조향 시 진동과 소음을 최소화합니다. 포켓의 크기와 위치 정확도로 윤활유 순환과 베어링 수명을 향상시킵니다.",
							applications: ["조향장치", "진동 제어"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/77f71891-c9ad-4974-beda-1ec7ae3842ad.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/38dfb8fa-d90d-4007-8f0b-5ef9f26bcdb4.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/274753e5-75bb-40b5-a870-4c2c1d85cc97.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/5972faa4-ada4-4ec6-aa0e-8caac1ded670.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
					],
				},
				{
					category: "샤프트",
					items: [
						{
							name: "샤프트 직진도 측정기",
							path: "/products/steering/shaft/straightness",
							description:
								"조향 샤프트의 직진도를 정밀 측정하여 조향 시 진동과 소음을 최소화합니다. 샤프트의 휨 변형과 비틀림을 마이크로미터 단위로 검출하여 조향 정밀도를 보장합니다.",
							applications: ["조향장치", "샤프트 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/70bcd5d1-3165-436a-b165-efca168054ef.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/92ae49f2-cd13-4d21-aa0f-26997ca80d06.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/1c3b4239-5628-4f21-aa09-6a11ff42a410.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/fefe33ec-75bc-4c7e-b18c-ddde12224ca4.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "샤프트 동심도 측정기",
							path: "/products/steering/shaft/concentricity",
							description:
								"조향 샤프트의 다단부 동심도를 정밀 측정하는 전용 장비입니다. 각 단계별 중심축의 일치성을 평가하여 조향감의 일관성과 부드러운 회전을 보장합니다.",
							applications: ["조향장치", "동심도 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/1750577593_축부동축도_2.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "샤프트 표면 거칠기 측정기",
							path: "/products/steering/shaft/surface-roughness",
							description:
								"조향 샤프트 표면의 거칠기를 정밀 측정하여 마찰 특성과 윤활 효과를 최적화합니다. 표면 조도가 조향 성능과 내구성에 미치는 영향을 정량적으로 평가합니다.",
							applications: ["조향장치", "표면 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/e9865076-7d7c-4d9c-a573-dbdf6eff78d1.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
					],
				},
			],
		},
		{
			industry: "측정기",
			description: "산업용 정밀 측정 및 검사 장비",
			categories: [
				{
					category: "비접촉식",
					items: [
						{
							name: "레이저 간섭계",
							path: "/products/measuring/non-contact/laser-interferometer",
							description:
								"레이저 간섭 원리를 이용한 초정밀 거리 측정 장비입니다. 나노미터 분해능으로 변위와 진동을 측정하여 정밀 기계와 측정 장비의 교정에 활용됩니다.",
							applications: ["정밀 측정", "교정 시스템"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/9e49a0a4-e40e-436f-8b87-218b579c6a38.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "광학 3D 스캐너",
							path: "/products/measuring/non-contact/optical-3d-scanner",
							description:
								"구조광 또는 레이저를 이용하여 물체의 3차원 형상을 비접촉으로 스캔하는 장비입니다. 복잡한 곡면과 미세 구조를 빠르고 정확하게 디지털화합니다.",
							applications: ["정밀 측정", "3D 스캐닝"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/88009f9e-5952-4d30-b9e7-a8dd2dcddf9d.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/5df4877e-8946-487a-8a75-c6ff32d3556b.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/09ec396f-0308-430d-81f9-b5428b45ca9a.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/88231721-e30e-4e79-9769-562aaa0f3b0a.jpg",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "비접촉 두께 측정기",
							path: "/products/measuring/non-contact/thickness-gauge",
							description:
								"초음파 또는 와전류 방식을 이용하여 재료의 두께를 비접촉으로 측정합니다. 코팅 두께, 필름 두께, 금속 두께를 손상 없이 정밀하게 측정합니다.",
							applications: ["정밀 측정", "두께 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/c336098d-c4c1-48b8-b313-72d0777d1cab.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/b083632d-457c-4867-8890-a2f28d02883f.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/a8dac703-e871-4194-98f2-abab0f93f1fd.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/775000f5-4cad-4b14-908a-e0d2a83a11fb.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "진동 측정 시스템",
							path: "/products/measuring/non-contact/vibration-measurement",
							description:
								"제조 장비의 미세 진동을 측정하여 공정 정밀도를 보장합니다. 나노미터 단위의 진동 변위를 검출하여 공정 품질을 최적화합니다.",
							applications: ["정밀 측정", "진동 제어"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/f8faffd1-626f-4a30-97e7-d121fc846c88.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/f54faedf-f0ce-4aa4-97a1-ecfc98da7186.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/ab1e5ff7-ec48-4e19-90ae-b7e8e7642e60.jpg",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/d3997d1b-3508-489a-b4cf-beb95ff50788.jpg",
							],
							hasVideo: false,
							videoUrl: "",
						},
					],
				},
				{
					category: "접촉식",
					items: [
						{
							name: "3차원 좌표 측정기(CMM)",
							path: "/products/measuring/contact/cmm",
							description:
								"고정밀 3차원 좌표 측정이 가능한 접촉식 CMM입니다. 복잡한 3D 형상의 치수와 기하공차를 마이크로미터 정밀도로 측정하여 품질 관리와 역설계에 활용됩니다.",
							applications: ["정밀 측정", "3D 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/c65ed10d-0b86-4342-8c67-b71a96d2992d.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/3f6f7ada-bbe9-494e-a346-47bd04e3a30f.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/37c3d2b3-3a00-46d7-931a-113c9d745e03.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "표면 거칠기 측정기",
							path: "/products/measuring/contact/surface-roughness",
							description:
								"접촉식 프로브를 이용하여 표면 거칠기를 나노미터 정밀도로 측정합니다. Ra, Rz, Rq 등 다양한 거칠기 파라미터를 측정하여 표면 품질과 기능성을 평가합니다.",
							applications: ["정밀 측정", "표면 분석"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/064a1d73-f7d7-4907-8f08-aff32da68fc8.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "형상 측정기",
							path: "/products/measuring/contact/profile-measuring",
							description:
								"접촉식 스타일러스로 부품의 형상과 윤곽을 정밀 측정하는 장비입니다. 직선도, 평면도, 진원도 등의 기하공차를 정확히 측정하여 부품의 기하학적 품질을 보장합니다.",
							applications: ["정밀 측정", "형상 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/a5417692-dd82-49a0-ab67-9ab5973f6a84.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/3ef28575-ffa8-4ad9-8b5a-24368bcbe8db.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/6619e9e2-5eff-4014-8d67-1acfce8af4ef.png",
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/5030d81d-8df2-4f45-bdf0-61bdd9dc0a70.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "GO/NOGO 게이지",
							path: "/products/measuring/contact/go-nogo-gauge",
							description:
								"부품의 치수를 합격/불합격 기준으로 신속하게 판정하는 검사 게이지입니다. 대량 생산 라인에서 빠른 품질 검사가 가능하며 작업자 친화적인 설계입니다.",
							applications: ["정밀 측정", "품질 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/1f68b6fc-f92a-4402-8024-6634d38d0ae9.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
					],
				},
			],
		},
		{
			industry: "반도체",
			description: "반도체 제조 공정용 정밀 측정 및 검사 장비",
			categories: [
				{
					category: "반도체",
					items: [
						{
							name: "웨이퍼 두께 측정기",
							path: "/products/semiconductor/wafer-thickness",
							description:
								"반도체 웨이퍼의 두께를 나노미터 정밀도로 측정하는 장비입니다. 웨이퍼 전면의 두께 균일성과 평탄도를 실시간으로 모니터링하여 반도체 공정 품질을 보장합니다.",
							applications: ["반도체", "웨이퍼 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/83a7ec11-2160-406c-8ded-cedb94c423e7.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "패턴 정렬도 측정기",
							path: "/products/semiconductor/pattern-alignment",
							description:
								"반도체 칩의 패턴 정렬 정밀도를 측정하여 리소그래피 공정의 품질을 관리합니다. 다층 패턴의 정렬 오차를 서브미크론 단위로 검출하여 수율과 성능을 최적화합니다.",
							applications: ["반도체", "패턴 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/c460043b-4480-47ad-9228-af4444346e0d.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "표면 결함 검사기",
							path: "/products/semiconductor/surface-defect",
							description:
								"반도체 웨이퍼 표면의 미세 결함을 광학적으로 검출하는 고해상도 검사 장비입니다. 파티클, 스크래치, 얼룩 등의 결함을 자동으로 분류하고 정량화합니다.",
							applications: ["반도체", "결함 검사"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/5500049c-57a4-40d3-a646-4772ef2cd206.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "클린룸 환경 모니터링 시스템",
							path: "/products/semiconductor/cleanroom-monitoring",
							description:
								"반도체 제조 클린룸의 환경 조건을 실시간으로 모니터링하는 통합 시스템입니다. 온도, 습도, 파티클 농도, 기류 패턴을 연속적으로 측정하여 최적의 제조 환경을 유지합니다.",
							applications: ["반도체", "환경 관리"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/cc707c71-d85a-492c-8275-148db1d73aa0.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "정전기 측정기",
							path: "/products/semiconductor/static-electricity",
							description:
								"반도체 제조 공정에서 발생하는 정전기를 정밀 측정하여 ESD 손상을 방지합니다. 작업 환경과 장비의 정전기 레벨을 실시간으로 모니터링하여 제품 신뢰성을 향상시킵니다.",
							applications: ["반도체", "ESD 관리"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/80d0e06d-b882-466e-b180-f216dc6adce0.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
					],
				},
			],
		},
		{
			industry: "엔진",
			description: "자동차 엔진 시스템용 정밀 측정 및 가공 장비",
			categories: [
				{
					category: "베어링 간극측정",
					items: [
						{
							name: "크랭크샤프트 베어링 간극 측정기",
							path: "/products/engine/bearing-clearance/crankshaft-clearance",
							description:
								"엔진 크랭크샤프트와 베어링 사이의 간극을 정밀 측정하여 엔진 성능과 수명을 최적화합니다. 오일 압력과 윤활 특성에 직접적인 영향을 미치는 핵심 측정 장비입니다.",
							applications: ["엔진", "크랭크샤프트"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/36ee0e41-4512-4d4b-a0c2-7bf72159b1d2.jpg",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "컨로드 베어링 간극 측정기",
							path: "/products/engine/bearing-clearance/connecting-rod-clearance",
							description:
								"연결봉(컨로드) 베어링의 간극을 정밀 측정하여 엔진의 회전 균형과 진동 특성을 관리합니다. 피스톤 운동의 정밀도와 엔진 내구성에 직접적인 영향을 미칩니다.",
							applications: ["엔진", "연결봉 베어링"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/36e297c7-94b5-4cb7-aa6c-77d48f6d494b.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "캠샤프트 베어링 간극 측정기",
							path: "/products/engine/bearing-clearance/camshaft-clearance",
							description:
								"캠샤프트 베어링의 간극을 정확하게 측정하여 밸브 타이밍과 엔진 성능을 보장합니다. 캠샤프트의 회전 정밀도와 윤활 상태를 종합적으로 평가합니다.",
							applications: ["엔진", "캠샤프트"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/1c3b4239-5628-4f21-aa09-6a11ff42a410.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "베어링 클리어런스 툴",
							path: "/products/engine/bearing-clearance/bearing-clearance-tool",
							description:
								"엔진 베어링의 간극을 정밀 측정하여 최적의 회전 성능과 수명을 보장합니다. 베어링과 축 사이의 클리어런스를 정확히 관리하여 엔진 성능과 내구성을 최적화합니다.",
							applications: ["엔진", "베어링 간극"],
							imageUrls: [
								"https://tjtenj-s3.s3.ap-northeast-2.amazonaws.com/uploads/9cb30ccb-f462-4cd3-8833-8df9210abfe7.png",
							],
							hasVideo: false,
							videoUrl: "",
						},
					],
				},
				{
					category: "세척장비",
					items: [
						{
							name: "엔진블록 초음파 세척기",
							path: "/products/engine/cleaning/ultrasonic-block",
							description:
								"엔진 블록의 정밀 세척을 위한 초음파 세척 시스템입니다. 복잡한 냉각수 통로와 오일 통로의 이물질을 완전히 제거하여 엔진 성능과 신뢰성을 향상시킵니다.",
							applications: ["엔진", "엔진 블록"],
							imageUrls: [],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "실린더 헤드 세척기",
							path: "/products/engine/cleaning/cylinder-head",
							description:
								"실린더 헤드의 밸브 시트와 포트를 정밀 세척하는 전용 장비입니다. 연소실의 카본 제거와 밸브 시트의 청정성을 보장하여 엔진 압축비와 출력을 최적화합니다.",
							applications: ["엔진", "실린더 헤드"],
							imageUrls: [],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "연료시스템 세척기",
							path: "/products/engine/cleaning/fuel-system",
							description:
								"연료 인젝터와 연료시스템의 정밀 세척을 위한 고압 세척 장비입니다. 연료 분사 정밀도와 연소 효율을 향상시켜 엔진 성능과 배기가스 품질을 개선합니다.",
							applications: ["엔진", "연료 시스템"],
							imageUrls: [],
							hasVideo: false,
							videoUrl: "",
						},
						{
							name: "부품 정밀 세척 시스템",
							path: "/products/engine/cleaning/precision-parts-cleaning",
							description:
								"엔진 부품의 정밀 세척을 위한 멀티 스테이지 세척 시스템입니다. 다양한 세척 방식(초음파, 고압, 화학적)을 조합하여 최적의 청정도를 달성합니다.",
							applications: ["엔진", "부품 세척"],
							imageUrls: [],
							hasVideo: false,
							videoUrl: "",
						},
					],
				},
			],
		},
	],
};
