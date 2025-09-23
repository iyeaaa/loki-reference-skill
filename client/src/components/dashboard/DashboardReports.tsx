"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function DashboardReports() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>보고서</CardTitle>
				<CardDescription>정기 보고서 및 커스텀 리포트</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="h-[400px] flex items-center justify-center text-muted-foreground">
					보고서 콘텐츠 영역
				</div>
			</CardContent>
		</Card>
	);
}
