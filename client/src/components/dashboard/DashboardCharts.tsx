"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function DashboardCharts() {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>이메일 발송 추이</CardTitle>
					<CardDescription>최근 7일간 발송 현황</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="h-[200px] flex items-center justify-center text-muted-foreground">
						차트 영역 (recharts 등을 사용하여 구현 가능)
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>사용자 증가 추이</CardTitle>
					<CardDescription>최근 30일간 신규 가입자</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="h-[200px] flex items-center justify-center text-muted-foreground">
						차트 영역 (recharts 등을 사용하여 구현 가능)
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
