"use client";

import {
	BarChart,
	Bell,
	ChevronDown,
	FileText,
	LayoutDashboard,
	LogOut,
	Mail,
	Menu,
	Search,
	Settings,
	User,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
	children: React.ReactNode;
}

const sidebarItems = [
	{
		title: "대시보드",
		icon: LayoutDashboard,
		href: "/dashboard",
	},
	{
		title: "사용자 관리",
		icon: Users,
		href: "/dashboard/users",
	},
	{
		title: "이메일 관리",
		icon: Mail,
		href: "/dashboard/emails",
	},
	{
		title: "통계",
		icon: BarChart,
		href: "/dashboard/analytics",
	},
	{
		title: "보고서",
		icon: FileText,
		href: "/dashboard/reports",
	},
	{
		title: "설정",
		icon: Settings,
		href: "/dashboard/settings",
	},
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [activePage, setActivePage] = useState("/dashboard");

	const SidebarContent = () => (
		<>
			<div className="px-6 py-4">
				<h2 className="text-lg font-semibold">Admin Dashboard</h2>
			</div>
			<ScrollArea className="flex-1 px-3">
				<div className="space-y-1 p-2">
					{sidebarItems.map((item) => (
						<Button
							key={item.href}
							variant={activePage === item.href ? "secondary" : "ghost"}
							className={cn(
								"w-full justify-start",
								activePage === item.href && "bg-secondary",
							)}
							onClick={() => setActivePage(item.href)}
						>
							<item.icon className="mr-2 h-4 w-4" />
							{item.title}
						</Button>
					))}
				</div>
			</ScrollArea>
		</>
	);

	return (
		<div className="flex h-screen bg-background">
			{/* Desktop Sidebar */}
			<div className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r">
				<SidebarContent />
			</div>

			{/* Mobile Sidebar */}
			<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
				<SheetContent side="left" className="w-64 p-0">
					<SidebarContent />
				</SheetContent>
			</Sheet>

			{/* Main Content */}
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
					<Button
						variant="ghost"
						size="icon"
						className="lg:hidden"
						onClick={() => setSidebarOpen(true)}
					>
						<Menu className="h-5 w-5" />
						<span className="sr-only">Toggle sidebar</span>
					</Button>

					<div className="flex-1 flex items-center gap-4">
						<div className="relative max-w-md flex-1">
							<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input type="search" placeholder="검색..." className="pl-8" />
						</div>
					</div>

					<div className="flex items-center gap-4">
						<Button variant="ghost" size="icon">
							<Bell className="h-5 w-5" />
							<span className="sr-only">Notifications</span>
						</Button>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="relative h-8 w-8 rounded-full"
								>
									<Avatar className="h-8 w-8">
										<AvatarImage src="/avatars/01.png" alt="@admin" />
										<AvatarFallback>AD</AvatarFallback>
									</Avatar>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-56" align="end" forceMount>
								<DropdownMenuLabel className="font-normal">
									<div className="flex flex-col space-y-1">
										<p className="text-sm font-medium leading-none">관리자</p>
										<p className="text-xs leading-none text-muted-foreground">
											admin@example.com
										</p>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem>
									<User className="mr-2 h-4 w-4" />
									<span>프로필</span>
								</DropdownMenuItem>
								<DropdownMenuItem>
									<Settings className="mr-2 h-4 w-4" />
									<span>설정</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>
									<LogOut className="mr-2 h-4 w-4" />
									<span>로그아웃</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</header>

				{/* Page Content */}
				<main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
			</div>
		</div>
	);
}
