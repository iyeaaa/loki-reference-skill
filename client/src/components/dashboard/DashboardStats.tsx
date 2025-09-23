"use client";

import { Activity, Mail, TrendingUp, Users } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { EmailStats } from "./EmailStats";
import { RecentActivity } from "./RecentActivity";
import { StatCard } from "./StatCard";

const mockActivities = [
	{
		id: "1",
		user: { name: "김철수", email: "kim@example.com" },
		action: "createdCampaign",
		timestamp: 5,
		unit: "minutes" as const,
	},
	{
		id: "2",
		user: { name: "이영희", email: "lee@example.com" },
		action: "sentEmails",
		timestamp: 10,
		unit: "minutes" as const,
	},
	{
		id: "3",
		user: { name: "박민수", email: "park@example.com" },
		action: "updatedGroup",
		timestamp: 30,
		unit: "minutes" as const,
	},
	{
		id: "4",
		user: { name: "정지원", email: "jung@example.com" },
		action: "editedTemplate",
		timestamp: 1,
		unit: "hours" as const,
	},
];

const emailStats = [
	{ label: "sent", value: 12543, total: 15000, color: "#10b981" },
	{ label: "opened", value: 8234, total: 12543, color: "#3b82f6" },
	{ label: "clicked", value: 3421, total: 8234, color: "#8b5cf6" },
	{ label: "bounced", value: 234, total: 15000, color: "#ef4444" },
];

export function DashboardStats() {
	return (
		<>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="총 사용자"
					value="2,543"
					description="지난달 대비"
					icon={Users}
					trend={{ value: 12.5, isPositive: true }}
				/>
				<StatCard
					title="발송 이메일"
					value="15,234"
					description="이번 달 발송"
					icon={Mail}
					trend={{ value: 8.2, isPositive: true }}
				/>
				<StatCard
					title="오픈율"
					value="65.7%"
					description="평균 오픈율"
					icon={TrendingUp}
					trend={{ value: 3.1, isPositive: true }}
				/>
				<StatCard
					title="클릭률"
					value="27.3%"
					description="평균 클릭률"
					icon={Activity}
					trend={{ value: -2.4, isPositive: false }}
				/>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
				<Card className="col-span-4">
					<CardHeader>
						<CardTitle>최근 활동</CardTitle>
						<CardDescription>팀 멤버들의 최근 활동 내역</CardDescription>
					</CardHeader>
					<CardContent>
						<RecentActivity activities={mockActivities} />
					</CardContent>
				</Card>

				<div className="col-span-3">
					<EmailStats stats={emailStats} />
				</div>
			</div>
		</>
	);
}
