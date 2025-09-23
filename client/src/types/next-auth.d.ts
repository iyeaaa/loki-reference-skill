declare module "next-auth" {
	interface Session {
		accessToken?: string;
		user?: {
			id?: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
			role?: string;
			permissions?: string[];
			is_active?: boolean;
		};
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		accessToken?: string;
		user?: any; // BackendUser type from route.ts
		authError?: string | null;
	}
}
