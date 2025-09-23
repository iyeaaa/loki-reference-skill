"use client";

import { ArrowLeft, Home, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function LocaleNotFound() {
	const router = useRouter();

	const handleGoHome = () => {
		router.push("/");
	};

	const handleGoBack = () => {
		router.back();
	};

	const handleSearch = () => {
		router.push("/products");
	};

	return (
		<div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold text-gray-900">
						페이지를 찾을 수 없습니다
					</CardTitle>
					<CardDescription className="text-gray-600">
						요청하신 페이지가 존재하지 않거나 이동되었습니다.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="text-center text-sm text-gray-500">
						<p>URL을 다시 확인해주시거나</p>
						<p>아래 버튼을 통해 다른 페이지로 이동해주세요.</p>
					</div>

					<div className="space-y-3">
						<Button onClick={handleGoHome} className="w-full">
							<Home className="w-4 h-4 mr-2" />
							홈페이지로 이동
						</Button>

						<Button onClick={handleSearch} variant="outline" className="w-full">
							<Search className="w-4 h-4 mr-2" />
							제품 둘러보기
						</Button>

						<Button onClick={handleGoBack} variant="outline" className="w-full">
							<ArrowLeft className="w-4 h-4 mr-2" />
							이전 페이지로
						</Button>
					</div>

					<div className="text-center text-xs text-gray-400 pt-4">
						<p>문제가 지속되면 관리자에게 문의해주세요.</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
