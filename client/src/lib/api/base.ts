import { getSession } from "next-auth/react";

export const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_URL || "http://13.125.103.72:8080";

interface ExtendedSession {
	accessToken?: string;
	user?: {
		id?: string;
		email?: string;
		name?: string;
	};
	expires?: string;
}

export class BaseApiClient {
	protected baseURL: string;

	constructor(baseURL: string = API_BASE_URL) {
		this.baseURL = baseURL;
	}

	protected async getAuthHeaders(): Promise<Record<string, string>> {
		const headers: Record<string, string> = {};

		// Get the session to extract the JWT token
		const session = (await getSession()) as ExtendedSession | null;
		if (session?.accessToken) {
			headers.Authorization = `Bearer ${session.accessToken}`;
		}

		return headers;
	}

	protected async request<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;

		// Get authentication headers
		const authHeaders = await this.getAuthHeaders();

		// Add timeout and retry logic
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

		const config: RequestInit = {
			headers: {
				"Content-Type": "application/json",
				...authHeaders,
				...options.headers,
			},
			signal: controller.signal,
			...options,
		};

		// FormData인 경우 Content-Type 제거
		if (options.body instanceof FormData) {
			const headers = config.headers as Record<string, string>;
			delete headers["Content-Type"];
		}

		try {
			const response = await fetch(url, config);
			clearTimeout(timeoutId);

			// Handle authentication errors
			if (response.status === 401) {
				// Don't redirect automatically - let the calling code handle the error
				throw new Error("Authentication required");
			}

			// Handle forbidden access (403)
			if (response.status === 403) {
				// Don't redirect automatically - let the calling code handle the error
				throw new Error("Access forbidden");
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`HTTP error! status: ${response.status} - ${errorText}`,
				);
			}

			const responseData = await response.json();
			return responseData;
		} catch (error) {
			clearTimeout(timeoutId);

			// Provide more specific error messages
			if (error instanceof Error) {
				if (error.name === "AbortError") {
					throw new Error("Request timeout - server is not responding");
				} else if (error.message.includes("fetch")) {
					throw new Error("Network connection failed");
				}
			}

			console.error("API request failed:", error);
			throw error;
		}
	}

	// Method for making requests without authentication (for public endpoints)
	protected async requestPublic<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;

		// Add timeout for public requests too
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

		const config: RequestInit = {
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
			signal: controller.signal,
			...options,
		};

		// FormData인 경우 Content-Type 제거
		if (options.body instanceof FormData) {
			const headers = config.headers as Record<string, string>;
			delete headers["Content-Type"];
		}

		try {
			const response = await fetch(url, config);
			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				console.error("Public API error response:", errorText);
				throw new Error(
					`HTTP error! status: ${response.status} - ${errorText}`,
				);
			}

			const data = await response.json();
			return data;
		} catch (error) {
			clearTimeout(timeoutId);

			// Provide more specific error messages for public requests
			if (error instanceof Error) {
				if (error.name === "AbortError") {
					throw new Error("Request timeout - server is not responding");
				} else if (error.message.includes("fetch")) {
					throw new Error("Network connection failed");
				}
			}

			console.error("Public API request failed:", error);
			throw error;
		}
	}
}

// Retry configuration
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Helper function for making API requests with retry logic
export async function makeApiRequest(
	url: string,
	options: RequestInit,
	retries: number = RETRY_ATTEMPTS,
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		return response;
	} catch (error) {
		clearTimeout(timeoutId);

		if (retries > 0 && error instanceof Error && error.name !== "AbortError") {
			console.log(
				`API request failed, retrying... (${RETRY_ATTEMPTS - retries + 1}/${RETRY_ATTEMPTS})`,
			);
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
			return makeApiRequest(url, options, retries - 1);
		}

		throw error;
	}
}
