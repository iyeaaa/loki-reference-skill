"use client";

import { Bug, Home, Mail, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface ErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
	const router = useRouter();

	useEffect(() => {
		// Log the error to an error reporting service
		console.error("Global error:", error);
	}, [error]);

	const handleGoHome = () => {
		router.push("/");
	};

	const handleContact = () => {
		router.push("/contact");
	};

	return (
		<div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					{/* TJTENG Logo */}
					<div className="flex justify-center mb-6">
						<Image
							src="/images/tjteng.png"
							alt="TJTENG 로고"
							width={100}
							height={50}
							className="h-12 w-auto"
						/>
					</div>

					{/* Error Icon */}
					<div className="flex justify-center mb-4">
						<div className="rounded-full bg-red-100 p-3">
							<Bug className="h-8 w-8 text-red-600" />
						</div>
					</div>

					<CardTitle className="text-2xl font-bold text-gray-900">
						예상치 못한 오류가 발생했습니다
					</CardTitle>
					<CardDescription className="text-gray-600">
						시스템에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="text-center text-sm text-gray-500">
						<p>문제가 지속되면 관리자에게 문의해주세요.</p>
						{error.digest && (
							<p className="mt-2 font-mono text-xs bg-gray-100 p-2 rounded">
								오류 ID: {error.digest}
							</p>
						)}
					</div>

					<div className="space-y-3">
						<Button onClick={reset} className="w-full">
							<RefreshCw className="w-4 h-4 mr-2" />
							다시 시도
						</Button>

						<Button onClick={handleGoHome} variant="outline" className="w-full">
							<Home className="w-4 h-4 mr-2" />
							홈페이지로 이동
						</Button>

						<Button
							onClick={handleContact}
							variant="outline"
							className="w-full"
						>
							<Mail className="w-4 h-4 mr-2" />
							문의하기
						</Button>
					</div>

					<div className="text-center text-xs text-gray-400 pt-4">
						<p>TJTENG 기술지원팀</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
