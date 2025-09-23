/**
 * 현재 시간을 기준으로 상대적인 시간을 한국어로 반환하는 함수
 */
export function getRelativeTime(date: string | Date): string {
	// Handle null, undefined, or empty string
	if (!date) {
		return "-";
	}

	const targetDate = typeof date === "string" ? new Date(date) : new Date(date);

	// Check if date is valid
	if (Number.isNaN(targetDate.getTime())) {
		console.warn("Invalid date provided to getRelativeTime:", date);
		return "-";
	}

	const now = new Date();
	const diffInSeconds = Math.floor(
		(now.getTime() - targetDate.getTime()) / 1000,
	);

	// 미래 시간인 경우
	if (diffInSeconds < 0) {
		return "방금";
	}

	// 1분 미만
	if (diffInSeconds < 60) {
		return "방금";
	}

	// 1시간 미만
	if (diffInSeconds < 3600) {
		const minutes = Math.floor(diffInSeconds / 60);
		return `${minutes}분 전`;
	}

	// 1일 미만
	if (diffInSeconds < 86400) {
		const hours = Math.floor(diffInSeconds / 3600);
		return `${hours}시간 전`;
	}

	// 30일 미만
	if (diffInSeconds < 2592000) {
		const days = Math.floor(diffInSeconds / 86400);
		return `${days}일 전`;
	}

	// 12개월 미만
	if (diffInSeconds < 31536000) {
		const months = Math.floor(diffInSeconds / 2592000);
		return `${months}개월 전`;
	}

	// 1년 이상
	const years = Math.floor(diffInSeconds / 31536000);
	return `${years}년 전`;
}

/**
 * 날짜를 한국어 형식으로 포맷팅하는 함수 (fallback용)
 */
export function formatKoreanDate(date: string | Date): string {
	if (!date) {
		return "-";
	}

	const targetDate = typeof date === "string" ? new Date(date) : new Date(date);

	if (Number.isNaN(targetDate.getTime())) {
		console.warn("Invalid date provided to formatKoreanDate:", date);
		return "-";
	}

	return targetDate.toLocaleDateString("ko-KR", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

/**
 * 상대 시간과 절대 시간을 함께 표시하는 함수
 */
export function getDisplayTime(date: string | Date): string {
	if (!date) {
		return "-";
	}

	const relativeTime = getRelativeTime(date);
	const absoluteTime = formatKoreanDate(date);

	// If either function returned '-', just return '-'
	if (relativeTime === "-" || absoluteTime === "-") {
		return "-";
	}

	// 7일 이상 지난 경우에는 절대 시간도 함께 표시
	const targetDate = typeof date === "string" ? new Date(date) : new Date(date);

	if (Number.isNaN(targetDate.getTime())) {
		return "-";
	}

	const now = new Date();
	const diffInDays = Math.floor(
		(now.getTime() - targetDate.getTime()) / 86400000,
	);

	if (diffInDays >= 7) {
		return `${relativeTime} (${absoluteTime})`;
	}

	return relativeTime;
}

/**
 * 날짜를 간단한 형식으로 포맷팅하는 함수
 */
export function formatDate(date: string | Date): string {
	if (!date) {
		return "-";
	}

	const targetDate = typeof date === "string" ? new Date(date) : new Date(date);

	if (Number.isNaN(targetDate.getTime())) {
		console.warn("Invalid date provided to formatDate:", date);
		return "-";
	}

	return targetDate.toLocaleDateString("ko-KR", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

/**
 * 로그 시간을 최적화된 형식으로 포맷팅하는 함수
 * 년월일시분초를 간결하게 표시
 */
export function formatLogTime(date: string | Date): string {
	if (!date) {
		return "-";
	}

	const targetDate = typeof date === "string" ? new Date(date) : new Date(date);

	if (Number.isNaN(targetDate.getTime())) {
		console.warn("Invalid date provided to formatLogTime:", date);
		return "-";
	}

	const year = targetDate.getFullYear();
	const month = String(targetDate.getMonth() + 1).padStart(2, "0");
	const day = String(targetDate.getDate()).padStart(2, "0");
	const hours = String(targetDate.getHours()).padStart(2, "0");
	const minutes = String(targetDate.getMinutes()).padStart(2, "0");
	const seconds = String(targetDate.getSeconds()).padStart(2, "0");

	return `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`;
}
