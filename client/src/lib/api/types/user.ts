// User schema types
export interface User {
	id: string;
	platform: string;
	login_type: string;
	username: string;
	email: string;
	phone_number?: string;
	image_url?: string;
	role: "admin" | "manager" | "user";
	permissions: string[];
	is_active: boolean;
	created_at: string;
	updated_at: string;
	last_login: string;
}
