"use client";

import {
	BarChart,
	FileText,
	LayoutDashboard,
	Mail,
	Menu,
	Settings,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const sidebarItems = [
	{
		key: "dashboard",
		icon: LayoutDashboard,
		href: "/dashboard",
	},
	{
		key: "users",
		icon: Users,
		href: "/dashboard/users",
	},
	{
		key: "emails",
		icon: Mail,
		href: "/dashboard/emails",
	},
	{
		key: "analytics",
		icon: BarChart,
		href: "/dashboard/analytics",
	},
	{
		key: "reports",
		icon: FileText,
		href: "/dashboard/reports",
	},
	{
		key: "settings",
		icon: Settings,
		href: "/dashboard/settings",
	},
];

const getMenuLabel = (key: string) => {
	const labels: Record<string, string> = {
		dashboard: "대시보드",
		users: "사용자 관리",
		emails: "이메일 관리",
		analytics: "통계",
		reports: "보고서",
		settings: "설정",
	};
	return labels[key] || key;
};

export function DashboardSidebar() {
	const [mobileOpen, setMobileOpen] = useState(false);
	const pathname = usePathname();

	const SidebarContent = () => (
		<>
			<div className="px-6 py-4">
				<h2 className="text-lg font-semibold">관리자 대시보드</h2>
			</div>
			<ScrollArea className="flex-1 px-3">
				<div className="space-y-1 p-2">
					{sidebarItems.map((item) => {
						const Icon = item.icon;
						const isActive = pathname === item.href;

						return (
							<Link key={item.key} href={item.href}>
								<Button
									variant={isActive ? "secondary" : "ghost"}
									className={cn(
										"w-full justify-start",
										isActive && "bg-secondary",
									)}
								>
									<Icon className="mr-2 h-4 w-4" />
									{getMenuLabel(item.key)}
								</Button>
							</Link>
						);
					})}
				</div>
			</ScrollArea>
		</>
	);

	return (
		<>
			{/* Mobile Menu Button */}
			<Button
				variant="ghost"
				size="icon"
				className="lg:hidden fixed top-4 left-4 z-50"
				onClick={() => setMobileOpen(true)}
			>
				<Menu className="h-5 w-5" />
				<span className="sr-only">Toggle sidebar</span>
			</Button>

			{/* Desktop Sidebar */}
			<div className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r">
				<SidebarContent />
			</div>

			{/* Mobile Sidebar */}
			<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
				<SheetContent side="left" className="w-64 p-0">
					<SidebarContent />
				</SheetContent>
			</Sheet>
		</>
	);
}
