import { BaseApiClient } from "./base";
import type { User } from "./types/user";

export interface AdminCheckResponse {
	is_admin: boolean;
}

export interface EmailRegisterRequest {
	username: string;
	email: string;
	password: string;
	phone_number?: string;
}

export interface EmailLoginRequest {
	email: string;
	password: string;
}

export interface AuthResponse {
	token: string;
	user: User;
}

export interface VerifyTokenResponse {
	user: User;
}

export interface RefreshTokenResponse {
	token: string;
}

export interface GoogleAuthRequest {
	name: string;
	email: string;
	picture: string;
	google_id: string;
	id_token: string;
	update_profile?: boolean;
}

export interface GoogleAuthResponse {
	token: string;
	user: User;
}

export class AuthApi extends BaseApiClient {
	async checkAdminRole(): Promise<AdminCheckResponse> {
		return this.request<AdminCheckResponse>("/api/v1/auth/admin-check");
	}

	async emailRegister(data: EmailRegisterRequest): Promise<AuthResponse> {
		return this.requestPublic<AuthResponse>("/api/v1/auth/email/register", {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async emailLogin(data: EmailLoginRequest): Promise<AuthResponse> {
		return this.requestPublic<AuthResponse>("/api/v1/auth/email/login", {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async verifyToken(): Promise<VerifyTokenResponse> {
		return this.request<VerifyTokenResponse>("/api/v1/auth/verify");
	}

	async refreshToken(): Promise<RefreshTokenResponse> {
		return this.request<RefreshTokenResponse>("/api/v1/auth/refresh", {
			method: "POST",
		});
	}

	async googleAuth(data: GoogleAuthRequest): Promise<GoogleAuthResponse> {
		return this.requestPublic<GoogleAuthResponse>("/api/v1/auth/google", {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async logout(): Promise<void> {
		return this.request<void>("/api/v1/auth/logout", {
			method: "POST",
		});
	}
}
