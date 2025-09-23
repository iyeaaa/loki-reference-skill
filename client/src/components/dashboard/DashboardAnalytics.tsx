"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function DashboardAnalytics() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>상세 분석</CardTitle>
				<CardDescription>이메일 캠페인 성과 분석</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="h-[400px] flex items-center justify-center text-muted-foreground">
					상세 분석 콘텐츠 영역
				</div>
			</CardContent>
		</Card>
	);
}
