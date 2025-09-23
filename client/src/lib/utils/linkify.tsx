import React from "react";

/**
 * URL 패턴을 감지하고 하이퍼링크로 변환하는 유틸리티 함수
 * @param text 텍스트 내용
 * @returns 링크가 포함된 React 요소 배열
 */
export function linkifyText(
	text: string | null | undefined,
): React.ReactNode[] {
	if (!text) return [];

	// URL 패턴 정규식 (http://, https://, www. 시작하는 URL 감지)
	const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<]+/gi;

	// URL을 찾아서 위치 정보와 함께 저장
	const matches: Array<{ url: string; start: number; end: number }> = [];
	let result: RegExpExecArray | null = null;

	// biome-ignore lint/suspicious/noAssignInExpressions: 정규식 exec 패턴은 표준적인 사용법
	while ((result = urlPattern.exec(text)) !== null) {
		matches.push({
			url: result[0],
			start: result.index,
			end: result.index + result[0].length,
		});
	}

	// 매치된 URL들을 기반으로 텍스트 분할
	const elements: React.ReactNode[] = [];
	let lastIndex = 0;

	for (let i = 0; i < matches.length; i++) {
		const matchInfo = matches[i];

		// URL 이전의 텍스트
		if (matchInfo.start > lastIndex) {
			const textPart = text.substring(lastIndex, matchInfo.start);
			if (textPart) {
				elements.push(
					<React.Fragment key={`text-${lastIndex}-${matchInfo.start}`}>
						{textPart}
					</React.Fragment>,
				);
			}
		}

		// URL 부분
		let href = matchInfo.url;
		// www로 시작하는 경우 https:// 추가
		if (matchInfo.url.startsWith("www.")) {
			href = `https://${matchInfo.url}`;
		}

		elements.push(
			<a
				key={`link-${matchInfo.start}-${matchInfo.end}`}
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className="text-blue-600 hover:text-blue-800 underline break-words"
			>
				{matchInfo.url}
			</a>,
		);

		lastIndex = matchInfo.end;
	}

	// 마지막 URL 이후의 텍스트
	if (lastIndex < text.length) {
		const textPart = text.substring(lastIndex);
		if (textPart) {
			elements.push(
				<React.Fragment key={`text-final-${lastIndex}`}>
					{textPart}
				</React.Fragment>,
			);
		}
	}

	return elements;
}

/**
 * 텍스트를 받아서 링크가 포함된 JSX를 반환하는 컴포넌트
 */
export const LinkifiedText: React.FC<{
	text: string | null | undefined;
	className?: string;
}> = ({ text, className = "" }) => {
	const linkedContent = linkifyText(text);

	return <span className={className}>{linkedContent}</span>;
};
