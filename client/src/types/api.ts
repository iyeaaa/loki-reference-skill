// API-related types

// API Response wrapper types
export interface ApiResponse<T = unknown> {
	data: T;
	success: boolean;
	message?: string;
	error?: string;
}

// Products API types
export interface ProductsApiParams {
	page?: number;
	limit?: number;
	category_id?: string;
	category_ids?: string;
	is_active?: string;
	is_active_filter?: string;
	is_featured?: string;
	is_featured_filter?: string;
	search?: string;
	hierarchy?: string;
	locale?: string;
}

export interface ProductsApiResponse {
	products: Array<{
		id: string;
		category_id: string;
		sku?: string | null;
		name: string | null;
		description?: string | null;
		features?: string | null;
		specifications?: Record<string, string | number | boolean> | null;
		meta_title?: string | null;
		meta_description?: string | null;
		language?: string | null;
		image_url?: string;
		category?: string;
		category_name?: string | null;
		category_path?: string | null;
		price?: number;
		is_active: boolean;
		is_featured: boolean;
		sort_order: number;
		created_at: string;
		updated_at: string;
	}>;
	total: number;
	page: number;
	limit: number;
	total_pages: number;
	pagination: {
		current_page: number;
		per_page: number;
		total: number;
		total_pages: number;
		has_next: boolean;
		has_prev: boolean;
	};
	filters: {
		category_id?: string;
		is_active?: string;
		is_featured?: string;
		search?: string;
	};
}

// Categories API types
export interface CategoriesApiResponse {
	categories: Array<{
		id: string;
		name: string;
		parent_id?: string;
		children?: Array<{
			id: string;
			name: string;
			parent_id?: string;
		}>;
		product_count?: number;
	}>;
}

// Media API types
export interface MediaUploadResponse {
	id: string;
	filename: string;
	url: string;
	size: number;
	mime_type: string;
	uploaded_at: string;
}

export interface MediaDeleteResponse {
	message: string;
	deleted_id: string;
}

// Auth API types
export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	token: string;
	user: {
		id: string;
		email: string;
		name: string;
		role: string;
	};
	expires_at: string;
}

export interface RegisterRequest {
	email: string;
	password: string;
	name: string;
}

export interface RegisterResponse {
	user: {
		id: string;
		email: string;
		name: string;
		role: string;
	};
	message: string;
}

// Admin API types
export interface AdminCheckResponse {
	is_admin: boolean;
	user_id: string;
	role: string;
}

// Bulk operations types
export interface BulkUpdateRequest<T = Record<string, unknown>> {
	ids: string[];
	updates: Partial<T>;
}

export interface BulkUpdateResponse<T = Record<string, unknown>> {
	message: string;
	updated_items: T[];
	updated_count: number;
	total_requested: number;
	failed_ids?: string[];
	failed_count?: number;
}

// Error types
export interface ApiError {
	message: string;
	code?: string;
	details?: Record<string, unknown>;
	field?: string;
}

export interface ValidationError {
	field: string;
	message: string;
	code?: string;
}

export interface ApiErrorResponse {
	error: string;
	message: string;
	details?: ApiError[];
	validation_errors?: ValidationError[];
	status_code?: number;
}

// Pagination types
export interface PaginationParams {
	page?: number;
	limit?: number;
	offset?: number;
}

export interface PaginationMeta {
	current_page: number;
	per_page: number;
	total: number;
	total_pages: number;
	has_next: boolean;
	has_prev: boolean;
}

// Filter types
export interface FilterParams {
	[key: string]: string | number | boolean | undefined;
}

export interface SortParams {
	field: string;
	direction: "asc" | "desc";
}

// Search types
export interface SearchParams {
	query: string;
	fields?: string[];
	filters?: FilterParams;
	sort?: SortParams;
}

export interface SearchResponse<T = unknown> {
	results: T[];
	total: number;
	query: string;
	filters?: FilterParams;
	sort?: SortParams;
	pagination?: PaginationMeta;
}

// File upload types
export interface FileUploadParams {
	file: File;
	folder?: string;
	public?: boolean;
}

export interface FileUploadProgress {
	loaded: number;
	total: number;
	percentage: number;
}

export interface FileUploadResult {
	id: string;
	filename: string;
	url: string;
	size: number;
	mime_type: string;
	success: boolean;
	error?: string;
}

// Request configuration types
export interface RequestConfig {
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	headers?: Record<string, string>;
	body?: string | FormData;
	timeout?: number;
	retries?: number;
}

// API client configuration
export interface ApiClientConfig {
	baseUrl: string;
	timeout?: number;
	retries?: number;
	headers?: Record<string, string>;
	onError?: (error: ApiError) => void;
	onSuccess?: (response: unknown) => void;
}

// Webhook types
export interface WebhookPayload {
	event: string;
	data: Record<string, unknown>;
	timestamp: string;
	id: string;
}

export interface WebhookResponse {
	success: boolean;
	message?: string;
	processed_at: string;
}
