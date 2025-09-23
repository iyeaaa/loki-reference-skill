"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface EmailStat {
	label: string;
	value: number;
	total: number;
	color: string;
}

interface EmailStatsProps {
	stats: EmailStat[];
}

export function EmailStats({ stats }: EmailStatsProps) {
	const getStatLabel = (label: string) => {
		const labels: Record<string, string> = {
			sent: "발송 완료",
			opened: "오픈",
			clicked: "클릭",
			bounced: "반송",
		};
		return labels[label] || label;
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>이메일 통계</CardTitle>
				<CardDescription>최근 30일간 이메일 발송 현황</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{stats.map((stat) => (
					<div key={stat.label} className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium">{getStatLabel(stat.label)}</span>
							<span className="text-muted-foreground">
								{stat.value.toLocaleString()} / {stat.total.toLocaleString()}
							</span>
						</div>
						<Progress
							value={(stat.value / stat.total) * 100}
							className="h-2"
							style={
								{
									"--progress-background": stat.color,
								} as React.CSSProperties
							}
						/>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
