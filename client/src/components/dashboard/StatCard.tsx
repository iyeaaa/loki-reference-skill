"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
	title: string;
	value: string | number;
	description?: string;
	icon: LucideIcon;
	trend?: {
		value: number;
		isPositive: boolean;
	};
	className?: string;
}

export function StatCard({
	title,
	value,
	description,
	icon: Icon,
	trend,
	className,
}: StatCardProps) {
	return (
		<Card className={cn("", className)}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<Icon className="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold">{value}</div>
				{description && (
					<p className="text-xs text-muted-foreground">{description}</p>
				)}
				{trend && (
					<div className="flex items-center text-xs mt-2">
						<span
							className={cn(
								"font-medium",
								trend.isPositive ? "text-green-600" : "text-red-600",
							)}
						>
							{trend.isPositive ? "+" : ""}
							{trend.value}%
						</span>
						<span className="text-muted-foreground ml-1">지난달 대비</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
