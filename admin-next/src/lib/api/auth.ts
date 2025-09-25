import { BaseApiClient } from "./base";

// Auth Types (aligned with new database schema)
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  user_role: string;
  is_active: boolean;
  department_id: string;
  employee_id: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  department_name?: string;
  department_code?: string;
}

export interface EmailLoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface VerifyTokenResponse {
  user: AuthUser;
}

export interface RefreshTokenResponse {
  token: string;
}

export interface AdminCheckResponse {
  is_admin: boolean;
}

export interface GoogleAuthRequest {
  email: string;
  name: string;
  google_id: string;
  profile_picture?: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  department_id: string;
  employee_id: string;
}

export interface SignupResponse {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

export class AuthApi extends BaseApiClient {
  /**
   * Admin email login
   */
  async emailLogin(data: EmailLoginRequest): Promise<AuthResponse> {
    return this.requestPublic<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Verify current token and get user info
   */
  async verifyToken(): Promise<VerifyTokenResponse> {
    return this.request<VerifyTokenResponse>("/api/v1/auth/verify", {
      method: "POST",
    });
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<RefreshTokenResponse> {
    return this.request<RefreshTokenResponse>("/api/v1/auth/refresh", {
      method: "POST",
    });
  }

  /**
   * Check if current user has admin role
   */
  async checkAdminRole(): Promise<AdminCheckResponse> {
    return this.request<AdminCheckResponse>("/api/v1/auth/admin-check");
  }

  /**
   * Google OAuth authentication
   */
  async googleAuth(data: GoogleAuthRequest): Promise<AuthResponse> {
    return this.requestPublic<AuthResponse>("/api/v1/auth/google", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * User signup (public endpoint)
   */
  async signup(data: SignupRequest): Promise<SignupResponse> {
    return this.requestPublic<SignupResponse>("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

// Export singleton instance
export const authApi = new AuthApi();