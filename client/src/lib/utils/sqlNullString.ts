// 안전한 문자열 렌더링 유틸리티

/**
 * null이 될 수 있는 문자열을 안전하게 렌더링
 * null을 undefined로 변환하여 더 안전하게 처리
 * @param value - 변환할 값
 * @returns 안전한 문자열 또는 빈 문자열
 */
export function safeRenderString(value: string | null | undefined): string {
	// null을 undefined로 변환하여 안전하게 처리
	const safeValue = value === null ? undefined : value;
	return safeValue || "";
}

/**
 * null이 될 수 있는 문자열을 안전하게 표시 문자열로 변환
 * null을 undefined로 변환하여 더 안전하게 처리
 * @param value - 변환할 값
 * @param fallback - 값이 없을 때 표시할 기본값
 * @returns 안전한 표시 문자열
 */
export function safeDisplayString(
	value: string | null | undefined,
	fallback: string = "-",
): string {
	// null을 undefined로 변환하여 안전하게 처리
	const safeValue = value === null ? undefined : value;
	return safeValue || fallback;
}
