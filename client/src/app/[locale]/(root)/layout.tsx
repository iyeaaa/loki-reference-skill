import type React from "react";

export default async function AppLayout({
	children,
	// params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}>) {
	return <div className="flex min-h-screen flex-col w-full">{children}</div>;
}
