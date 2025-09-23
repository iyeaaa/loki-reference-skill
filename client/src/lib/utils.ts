import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

interface ApiErrorResponse {
	response?: {
		data?: {
			error?: string;
		};
	};
}

interface ErrorWithMessage {
	message: string;
}

type PossibleError = Error | ApiErrorResponse | ErrorWithMessage | string;

/**
 * 다양한 형태의 에러 객체에서 안전하게 에러 메시지를 추출합니다.
 * @param error - 에러 객체
 * @returns 에러 메시지 문자열
 */
export const getErrorMessage = (error: PossibleError | unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "object" && error !== null) {
		// API 에러 응답 처리
		if (
			"response" in error &&
			typeof error.response === "object" &&
			error.response !== null
		) {
			if (
				"data" in error.response &&
				typeof error.response.data === "object" &&
				error.response.data !== null
			) {
				if (
					"error" in error.response.data &&
					typeof error.response.data.error === "string"
				) {
					return error.response.data.error;
				}
			}
		}
		// 일반적인 객체의 message 속성 처리
		if ("message" in error && typeof error.message === "string") {
			return error.message;
		}
	}
	if (typeof error === "string") {
		return error;
	}
	return "알 수 없는 오류가 발생했습니다.";
};
