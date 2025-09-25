import NextAuth from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { apiClient } from "@/lib/api";

// NextAuth 타입은 src/types/next-auth.d.ts에서 확장됨

// 백엔드에서 반환되는 사용자 타입 정의 (server/handlers/user_handlers.go의 UserResponse 구조와 일치)
interface BackendUser {
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
	edit_languages?: string[];
	review_languages?: string[];
}

// 타입 정의는 src/types/next-auth.d.ts 파일에서 관리

const handler = NextAuth({
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
		CredentialsProvider({
			id: "credentials",
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				token: { label: "Token", type: "text" },
				user: { label: "User", type: "text" },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.token || !credentials?.user) {
					return null;
				}

				try {
					const parsedUser = JSON.parse(credentials.user) as BackendUser;
					return {
						id: parsedUser.id,
						email: parsedUser.email,
						name: parsedUser.username,
						accessToken: credentials.token,
						username: parsedUser.username,
						user_role: parsedUser.user_role,
						is_active: parsedUser.is_active,
						department_id: parsedUser.department_id,
						employee_id: parsedUser.employee_id,
						department_name: parsedUser.department_name,
						department_code: parsedUser.department_code,
						edit_languages: parsedUser.edit_languages,
						review_languages: parsedUser.review_languages,
						last_login_at: parsedUser.last_login_at,
						created_at: parsedUser.created_at,
						updated_at: parsedUser.updated_at,
					};
				} catch (error) {
					console.error("Credentials authorization error:", error);
					return null;
				}
			},
		}),
	],
	callbacks: {
		async session({ session, token }) {
			// JWT에서 사용자 데이터를 세션으로 전달
			if (token.user && typeof token.user === "object") {
				const backendUser = token.user;
				session.user = {
					...session.user,
					id: backendUser.id,
					name: backendUser.username,
					email: backendUser.email,
					username: backendUser.username,
					user_role: backendUser.user_role,
					is_active: backendUser.is_active,
					department_id: backendUser.department_id,
					employee_id: backendUser.employee_id,
					department_name: backendUser.department_name,
					department_code: backendUser.department_code,
					edit_languages: backendUser.edit_languages,
					review_languages: backendUser.review_languages,
					last_login_at: backendUser.last_login_at,
				};
			}
			if (token.accessToken && typeof token.accessToken === "string") {
				session.accessToken = token.accessToken;
			}
			return session;
		},
		async jwt({ token, user, account, trigger, session }) {
			// Handle session update trigger (when updateSession is called)
			if (trigger === "update" && session?.user) {
				// Update token with new user data from updateSession
				const sessionUser = session.user;
				
				if (sessionUser) {
					token.user = {
						...(token.user || {}),
						id: sessionUser.id || "",
						username: sessionUser.name || sessionUser.username || "",
						email: sessionUser.email || "",
						user_role: sessionUser.user_role || "user",
						is_active: sessionUser.is_active ?? true,
						department_id: sessionUser.department_id || "",
						employee_id: sessionUser.employee_id || "",
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
						last_login_at: sessionUser.last_login_at,
						department_name: sessionUser.department_name,
						department_code: sessionUser.department_code,
						edit_languages: sessionUser.edit_languages,
						review_languages: sessionUser.review_languages,
					};
				}
				return token;
			}

			// Google 로그인 시 매번 사용자 정보 업데이트
			if (user && account && account.provider === "google") {
				try {
					// 통일된 API 클라이언트 사용
					const authResponse = await apiClient.auth.googleAuth({
						name: user.name || "",
						email: user.email || "",
						profile_picture: user.image || "",
						google_id: user.id,
					});

					token.accessToken = authResponse.token;
					token.user = authResponse.user;
					token.authError = null;
				} catch (error) {
					// 백엔드 연결 실패 시에도 기본 사용자 정보로 로그인 허용
					token.user = {
						id: user.id || "",
						username: user.name || "",
						email: user.email || "",
						user_role: "user",
						is_active: true,
						department_id: "",
						employee_id: "",
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};
					token.accessToken = undefined;
					token.authError =
						error instanceof Error ? error.message : "Network error";
				}
			}

			// Credentials 로그인 처리
			if (user && account && account.provider === "credentials") {
				token.accessToken = user.accessToken;
				// Convert user data to BackendUser format for JWT
				token.user = {
					id: user.id || "",
					username: user.name || user.username || "",
					email: user.email || "",
					user_role: user.user_role || "user",
					is_active: user.is_active ?? true,
					department_id: user.department_id || "",
					employee_id: user.employee_id || "",
					created_at: user.created_at || new Date().toISOString(),
					updated_at: user.updated_at || new Date().toISOString(),
					last_login_at: user.last_login_at,
					department_name: user.department_name,
					department_code: user.department_code,
					edit_languages: user.edit_languages,
					review_languages: user.review_languages,
				};
				token.authError = null;
			}

			return token;
		},
		async signIn() {
			// Remove duplicate backend validation - this will be handled in JWT callback
			// Just allow the sign-in to proceed
			return true;
		},
	},
	secret: process.env.NEXTAUTH_SECRET,
	pages: {
		signIn: "/login",
		error: "/login",
	},
});

export { handler as GET, handler as POST };
