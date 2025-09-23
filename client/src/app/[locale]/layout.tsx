"use client";

import "../globals.css";
import { notFound } from "next/navigation";
import Script from "next/script";
import { SessionProvider } from "next-auth/react";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import { use } from "react";
import { Toaster } from "react-hot-toast";
import { geistMono, geistSans } from "@/app/lib/fonts";
import { routing } from "@/i18n/routing";

export default function RootLayout({
	children,
	params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}>) {
	const { locale } = use(params);
	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	return (
		<html
			lang={locale}
			className={`${geistSans.variable} ${geistMono.variable}`}
			suppressHydrationWarning
		>
			<head>
				<meta
					name="google-site-verification"
					content="2qyvKwMJzHfCgjnllOarBjv-OzFWIHzEeRcCgEK9DJM"
				/>
				<meta
					name="naver-site-verification"
					content="f680452377bbd0736139b8515d89feb06d4075ca"
				/>
			</head>
			<body>
				<SessionProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="light"
						enableSystem
						disableTransitionOnChange
					>
						<NextIntlClientProvider locale={locale}>
							{children}
						</NextIntlClientProvider>
						<Toaster
							position="top-right"
							reverseOrder={false}
							gutter={8}
							containerClassName=""
							containerStyle={{}}
							toastOptions={{
								className: "",
								duration: 4000,
								style: {
									background: "#363636",
									color: "#fff",
								},
								success: {
									duration: 3000,
									style: {
										background: "#10b981",
										color: "#fff",
									},
									iconTheme: {
										primary: "#fff",
										secondary: "#10b981",
									},
								},
								error: {
									duration: 4000,
									style: {
										background: "#ef4444",
										color: "#fff",
									},
									iconTheme: {
										primary: "#fff",
										secondary: "#ef4444",
									},
								},
							}}
						/>
					</ThemeProvider>
				</SessionProvider>
				<Script
					id="google-analytics"
					strategy="afterInteractive"
					src="https://www.googletagmanager.com/gtag/js?id=G-M4E7X1PNB7"
				/>
				<Script id="google-analytics-config" strategy="afterInteractive">
					{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-M4E7X1PNB7');
            `}
				</Script>
			</body>
		</html>
	);
}
