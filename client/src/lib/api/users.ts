import { BaseApiClient } from "./base";
import type { User } from "./types/user";

export class UsersApi extends BaseApiClient {
	async getUsers(params?: {
		page?: number;
		limit?: number;
		role?: string;
		roles?: string;
		active_state?: string;
		active_states?: string;
		login_type?: string;
		login_types?: string;
		platform?: string;
		platforms?: string;
		search?: string;
	}) {
		const searchParams = new URLSearchParams();
		if (params?.page) searchParams.append("page", params.page.toString());
		if (params?.limit) searchParams.append("limit", params.limit.toString());

		// Single filter parameters
		if (params?.role && params.role !== "all")
			searchParams.append("role", params.role);
		if (params?.active_state && params.active_state !== "all")
			searchParams.append("active_state", params.active_state);
		if (params?.login_type && params.login_type !== "all")
			searchParams.append("login_type", params.login_type);
		if (params?.platform && params.platform !== "all")
			searchParams.append("platform", params.platform);

		// Multi-filter parameters (comma-separated values)
		if (params?.roles && params.roles !== "all")
			searchParams.append("roles", params.roles);
		if (params?.active_states && params.active_states !== "all")
			searchParams.append("active_states", params.active_states);
		if (params?.login_types && params.login_types !== "all")
			searchParams.append("login_types", params.login_types);
		if (params?.platforms && params.platforms !== "all")
			searchParams.append("platforms", params.platforms);

		if (params?.search) searchParams.append("search", params.search);

		const query = searchParams.toString();
		return this.request<{
			users: User[];
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
				role?: string;
				active_state?: string;
				login_type?: string;
				platform?: string;
				search?: string;
			};
		}>(`/api/v1/admin/users${query ? `?${query}` : ""}`);
	}

	async getUserDetails(userId: string) {
		return this.request<{ user: User }>(`/api/v1/admin/users/${userId}`);
	}

	async createUser(userData: Partial<User>) {
		return this.request<{ user: User }>("/api/v1/admin/users", {
			method: "POST",
			body: JSON.stringify(userData),
		});
	}

	async updateUser(userId: string, userData: Partial<User>) {
		// Filter out undefined values but keep explicit falsy values like false
		const filteredData: Partial<User> = {};
		Object.entries(userData).forEach(([key, value]) => {
			if (value !== undefined) {
				// Keep boolean false values, filter out empty strings
				if (
					typeof value === "boolean" ||
					(typeof value === "string" && value !== "") ||
					value === null ||
					Array.isArray(value)
				) {
					(filteredData as Record<keyof User, unknown>)[key as keyof User] =
						value;
				}
			}
		});

		return this.request<{ user: User }>(`/api/v1/admin/users/${userId}`, {
			method: "PUT",
			body: JSON.stringify(filteredData),
		});
	}

	async deleteUser(userId: string) {
		return this.request<{ message: string }>(`/api/v1/admin/users/${userId}`, {
			method: "DELETE",
		});
	}

	async bulkUpdateUsers(userIds: string[], updates: Partial<User>) {
		// Filter out undefined values but keep explicit falsy values like false
		const filteredUpdates: Partial<User> = {};
		Object.entries(updates).forEach(([key, value]) => {
			if (value !== undefined) {
				// Keep boolean false values, filter out empty strings
				if (
					typeof value === "boolean" ||
					(typeof value === "string" && value !== "") ||
					value === null ||
					Array.isArray(value)
				) {
					(filteredUpdates as Record<keyof User, unknown>)[key as keyof User] =
						value;
				}
			}
		});

		return this.request<{
			message: string;
			updated_users: User[];
			updated_count: number;
			total_requested: number;
			failed_user_ids?: string[];
			failed_count?: number;
		}>("/api/v1/admin/users/bulk", {
			method: "PUT",
			body: JSON.stringify({ user_ids: userIds, updates: filteredUpdates }),
		});
	}

	async getAssignableUsers() {
		return this.request<{
			users: Array<{
				id: string;
				username: string;
				email: string;
				role: string;
				image_url?: string | null;
			}>;
			count: number;
		}>("/api/v1/admin/users/assignable");
	}
}
