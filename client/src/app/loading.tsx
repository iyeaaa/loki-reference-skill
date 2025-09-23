import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function GlobalLoading() {
	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="text-center">
				{/* TJTENG Logo */}
				<div className="flex justify-center mb-8">
					<Image
						src="/images/tjteng.png"
						alt="TJTENG 로고"
						width={120}
						height={60}
						className="h-16 w-auto"
					/>
				</div>

				{/* Loading Spinner */}
				<div className="flex justify-center mb-4">
					<Loader2 className="h-8 w-8 animate-spin text-blue-600" />
				</div>

				<p className="text-gray-600 text-lg font-medium">로딩 중...</p>
				<p className="text-gray-400 text-sm mt-2">잠시만 기다려주세요</p>
			</div>
		</div>
	);
}
