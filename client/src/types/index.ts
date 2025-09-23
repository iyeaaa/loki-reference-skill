// Central type exports

// Re-export API types (use lib/api/types as primary source)
export * from "../lib/api/types";

// Re-export specific types from api.ts to avoid conflicts
export type {
	AdminCheckResponse,
	ApiClientConfig,
	ApiErrorResponse,
	BulkUpdateRequest,
	BulkUpdateResponse,
	CategoriesApiResponse,
	FileUploadParams,
	FilterParams,
	LoginRequest,
	LoginResponse,
	MediaDeleteResponse,
	MediaUploadResponse,
	PaginationMeta,
	PaginationParams,
	ProductsApiParams,
	ProductsApiResponse,
	RegisterRequest,
	RegisterResponse,
	RequestConfig,
	SortParams,
	WebhookPayload,
	WebhookResponse,
} from "./api";

// Re-export all types from other files
export * from "./common";
export * from "./component";
export * from "./hooks";

// Additional global types
// Note: ChannelIO types are declared in app/lib/channeltalk.ts

// Environment variables
export interface EnvConfig {
	API_URL: string;
	APP_URL: string;
	NEXTAUTH_SECRET: string;
	NEXTAUTH_URL: string;
	DATABASE_URL: string;
	AWS_ACCESS_KEY_ID: string;
	AWS_SECRET_ACCESS_KEY: string;
	AWS_REGION: string;
	AWS_S3_BUCKET: string;
	CHANNELTALK_PLUGIN_KEY: string;
}

// Next.js specific types
export interface NextPageProps {
	params: {
		locale: string;
		[key: string]: string | string[];
	};
	searchParams?: {
		[key: string]: string | string[] | undefined;
	};
}

export interface NextLayoutProps {
	children: React.ReactNode;
	params: {
		locale: string;
	};
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredField<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type NullableField<T, K extends keyof T> = T & {
	[P in K]: T[P] | null;
};

// Database entity base
export interface BaseEntity {
	id: string;
	created_at: string;
	updated_at: string;
}

// API endpoints
export interface ApiEndpoints {
	auth: {
		login: string;
		logout: string;
		register: string;
		refresh: string;
	};
	products: {
		list: string;
		create: string;
		update: string;
		delete: string;
		detail: string;
	};
	categories: {
		list: string;
		create: string;
		update: string;
		delete: string;
		tree: string;
	};
	users: {
		list: string;
		create: string;
		update: string;
		delete: string;
		profile: string;
	};
	uploads: {
		single: string;
		multiple: string;
		delete: string;
	};
}
