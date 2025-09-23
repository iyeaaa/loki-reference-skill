"use client";

import { Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardAnalytics } from "./DashboardAnalytics";
import { DashboardCharts } from "./DashboardCharts";
import { DashboardReports } from "./DashboardReports";
import { DashboardStats } from "./DashboardStats";

export function DashboardOverview() {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
				<div className="flex items-center space-x-2">
					<Button variant="outline" size="sm">
						<Download className="mr-2 h-4 w-4" />
						보고서 다운로드
					</Button>
					<Button size="sm">
						<Send className="mr-2 h-4 w-4" />새 캠페인
					</Button>
				</div>
			</div>

			<Tabs defaultValue="overview" className="space-y-4">
				<TabsList>
					<TabsTrigger value="overview">개요</TabsTrigger>
					<TabsTrigger value="analytics">분석</TabsTrigger>
					<TabsTrigger value="reports">보고서</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-4">
					<DashboardStats />
					<DashboardCharts />
				</TabsContent>

				<TabsContent value="analytics" className="space-y-4">
					<DashboardAnalytics />
				</TabsContent>

				<TabsContent value="reports" className="space-y-4">
					<DashboardReports />
				</TabsContent>
			</Tabs>
		</div>
	);
}
