import NextAuth from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { apiClient } from "@/lib/api";

// 백엔드에서 반환되는 사용자 타입 정의
interface BackendUser {
	id: string;
	username: string;
	email: string;
	image_url?: string;
	role: string;
	permissions?: string[];
	is_active: boolean;
	created_at: string;
	updated_at: string;
	last_login?: string;
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
					const user = JSON.parse(credentials.user);
					return {
						id: user.id,
						email: user.email,
						name: user.username,
						image: user.image_url,
						accessToken: credentials.token,
						...user,
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
			// JWT에서 사용자 데이터를 세션으로 전달 (업데이트된 프로필 사진 포함)
			if (token.user && typeof token.user === "object") {
				const backendUser = token.user as BackendUser; // 백엔드에서 온 사용자 데이터
				session.user = {
					...session.user,
					...token.user,
					// 백엔드에서 업데이트된 프로필 사진 사용
					image: backendUser.image_url || session.user?.image,
				};
			}
			if (token.accessToken && typeof token.accessToken === "string") {
				(session as any).accessToken = token.accessToken;
			}
			return session;
		},
		async jwt({ token, user, account, trigger, session }) {
			// Handle session update trigger (when updateSession is called)
			if (trigger === "update" && session?.user) {
				// Update token with new user data from updateSession
				token.user = {
					...(token.user || {}),
					...session.user,
					image_url: session.user.image, // Map image to image_url for backend compatibility
				} as BackendUser;
				return token;
			}

			// Google 로그인 시 매번 사용자 정보 업데이트
			if (user && account && account.provider === "google") {
				try {
					// 통일된 API 클라이언트 사용
					const authResponse = await apiClient.auth.googleAuth({
						name: user.name || "",
						email: user.email || "",
						picture: user.image || "",
						google_id: user.id,
						id_token: account.id_token || "",
						update_profile: true,
					});

					token.accessToken = authResponse.token;
					token.user = authResponse.user;
					token.authError = null;
				} catch (error) {
					// 백엔드 연결 실패 시에도 기본 사용자 정보로 로그인 허용
					token.user = {
						id: user.id,
						email: user.email || "",
						username: user.name || "",
						image_url: user.image || "",
						role: "user",
						is_active: true,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};
					token.accessToken = null;
					token.authError =
						error instanceof Error ? error.message : "Network error";
				}
			}

			// Credentials 로그인 처리
			if (user && account && account.provider === "credentials") {
				token.accessToken = (user as any).accessToken;
				token.user = user;
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
