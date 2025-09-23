import type { PaginatedResponse } from "../../types/common";
import { BaseApiClient } from "./base";

// Log Level enum
export type LogLevel = "error" | "warning" | "info" | "debug";

// HTTP Method enum
export type HttpMethod =
	| "GET"
	| "POST"
	| "PUT"
	| "DELETE"
	| "PATCH"
	| "OPTIONS"
	| "HEAD";

// Device Type enum
export type DeviceType = "desktop" | "mobile" | "tablet" | "bot" | "unknown";

// HTTP Status Code types
export type HttpStatusCode =
	| 200
	| 201
	| 204 // 2xx Success
	| 301
	| 302
	| 304 // 3xx Redirection
	| 400
	| 401
	| 403
	| 404
	| 405
	| 409
	| 422
	| 429 // 4xx Client Error
	| 500
	| 502
	| 503
	| 504; // 5xx Server Error

// Status Code Group definitions
export interface StatusCodeGroup {
	label: string;
	codes: Array<{
		code: HttpStatusCode;
		label: string;
		description: string;
	}>;
}

// Status Code Groups
export const STATUS_CODE_GROUPS: Record<string, StatusCodeGroup> = {
	"2xx": {
		label: "2xx (성공)",
		codes: [
			{ code: 200, label: "200", description: "성공" },
			{ code: 201, label: "201", description: "생성됨" },
			{ code: 204, label: "204", description: "내용 없음" },
		],
	},
	"3xx": {
		label: "3xx (리다이렉션)",
		codes: [
			{ code: 301, label: "301", description: "영구 이동" },
			{ code: 302, label: "302", description: "임시 이동" },
			{ code: 304, label: "304", description: "수정되지 않음" },
		],
	},
	"4xx": {
		label: "4xx (클라이언트 오류)",
		codes: [
			{ code: 400, label: "400", description: "잘못된 요청" },
			{ code: 401, label: "401", description: "인증 필요" },
			{ code: 403, label: "403", description: "권한 없음" },
			{ code: 404, label: "404", description: "찾을 수 없음" },
			{ code: 405, label: "405", description: "허용되지 않는 메서드" },
			{ code: 409, label: "409", description: "충돌" },
			{ code: 422, label: "422", description: "처리할 수 없는 엔티티" },
			{ code: 429, label: "429", description: "너무 많은 요청" },
		],
	},
	"5xx": {
		label: "5xx (서버 오류)",
		codes: [
			{ code: 500, label: "500", description: "서버 오류" },
			{ code: 502, label: "502", description: "잘못된 게이트웨이" },
			{ code: 503, label: "503", description: "서비스 이용 불가" },
			{ code: 504, label: "504", description: "게이트웨이 시간 초과" },
		],
	},
};

// Request Log interface
export interface RequestLog {
	id: string;
	request_id: string;
	user_id?: string;
	username?: string;
	image_url?: string;
	http_method: HttpMethod;
	endpoint: string;
	client_ip: string;
	user_agent?: string;
	response_status_code?: number;
	response_time_ms?: number;
	log_level: LogLevel;
	device_type: DeviceType;
	is_bot: boolean;
	country_code?: string;
	country_name?: string;
	created_at: string;
	error_code?: string;
	error_message?: string;
	request_body?: string;
	response_body?: string;
}

// Request Log Filters interface
export interface RequestLogFilters {
	page?: number;
	limit?: number;
	date_from?: string;
	date_to?: string;
	user_id?: string;
	endpoint?: string;
	client_ip?: string;
	status_code?: number; // Legacy single status code (for backward compatibility)
	status_codes?: HttpStatusCode[]; // Multiple status codes
	country_code?: string;
	device_type?: DeviceType;
	is_bot?: boolean;
	min_response_time?: number;
	http_methods?: HttpMethod[];
	log_levels?: LogLevel[];
	search?: string; // Global search term
}

// Performance Metrics interface
export interface PerformanceMetrics {
	total_requests: number;
	avg_response_time: number;
	p95_response_time: number;
	p99_response_time: number;
	avg_db_time: number;
	avg_memory_usage: number;
	avg_cpu_usage: number;
	error_count: number;
	server_error_count: number;
}

// Top Endpoint interface
export interface TopEndpoint {
	endpoint: string;
	request_count: number;
	avg_response_time: number;
	error_count: number;
	unique_users: number;
}

// Device Stats interface
export interface DeviceStats {
	device_type: DeviceType;
	request_count: number;
	unique_users: number;
	avg_response_time: number;
}

// Error Analytics interface
export interface ErrorAnalytics {
	response_status_code?: number;
	error_code?: string;
	error_count: number;
	endpoint: string;
	affected_users: number;
}

// Log Statistics interface
export interface LogStatistics {
	performance_metrics: PerformanceMetrics;
	top_endpoints: TopEndpoint[];
	device_stats: DeviceStats[];
	error_analytics: ErrorAnalytics[];
	date_range: {
		from: string;
		to: string;
	};
}

// Log Retention Stats interface
export interface LogRetentionStats {
	total_logs: number;
	logs_older_30_days: number;
	logs_older_90_days: number;
	logs_older_1_year: number;
	oldest_log: string;
	newest_log: string;
	table_size: string;
}

export class LogsApi extends BaseApiClient {
	/**
	 * Get request logs with filtering and pagination
	 */
	async getRequestLogs(
		filters: RequestLogFilters = {},
	): Promise<PaginatedResponse<RequestLog>> {
		const params = new URLSearchParams();

		if (filters.page) params.append("page", filters.page.toString());
		if (filters.limit) params.append("limit", filters.limit.toString());
		if (filters.date_from) params.append("date_from", filters.date_from);
		if (filters.date_to) params.append("date_to", filters.date_to);
		if (filters.user_id) params.append("user_id", filters.user_id);
		if (filters.endpoint) params.append("endpoint", filters.endpoint);
		if (filters.client_ip) params.append("client_ip", filters.client_ip);
		if (filters.status_code)
			params.append("status_code", filters.status_code.toString());
		if (filters.status_codes?.length)
			params.append("status_codes", filters.status_codes.join(","));
		if (filters.country_code)
			params.append("country_code", filters.country_code);
		if (filters.device_type) params.append("device_type", filters.device_type);
		if (filters.is_bot !== undefined)
			params.append("is_bot", filters.is_bot.toString());
		if (filters.min_response_time !== undefined)
			params.append("min_response_time", filters.min_response_time.toString());
		if (filters.http_methods?.length)
			params.append("http_methods", filters.http_methods.join(","));
		if (filters.log_levels?.length)
			params.append("log_levels", filters.log_levels.join(","));
		if (filters.search) params.append("search", filters.search);

		const response = await this.request<PaginatedResponse<RequestLog>>(
			`/api/v1/admin/logs?${params.toString()}`,
		);
		return response;
	}

	/**
	 * Get a specific request log by ID
	 */
	async getRequestLogById(id: string): Promise<RequestLog> {
		const response = await this.request<{ data: RequestLog }>(
			`/api/v1/admin/logs/${id}`,
		);
		return response.data;
	}

	/**
	 * Get request log statistics
	 */
	async getLogStatistics(
		dateFrom?: string,
		dateTo?: string,
	): Promise<LogStatistics> {
		const params = new URLSearchParams();
		if (dateFrom) params.append("date_from", dateFrom);
		if (dateTo) params.append("date_to", dateTo);

		const response = await this.request<{ data: LogStatistics }>(
			`/api/v1/admin/logs/stats?${params.toString()}`,
		);
		return response.data;
	}

	/**
	 * Get log retention statistics
	 */
	async getLogRetentionStats(): Promise<LogRetentionStats> {
		const response = await this.request<{ data: LogRetentionStats }>(
			"/api/v1/admin/logs/retention",
		);
		return response.data;
	}

	/**
	 * Delete old logs (cleanup)
	 */
	async deleteOldLogs(days: number = 90): Promise<void> {
		const params = new URLSearchParams({ days: days.toString() });
		await this.request(`/api/v1/admin/logs/cleanup?${params.toString()}`, {
			method: "DELETE",
		});
	}
}
