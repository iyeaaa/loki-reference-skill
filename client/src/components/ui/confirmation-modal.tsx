"use client";

import { AlertTriangle, CheckCircle, Trash2, XCircle } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmationModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	description: string;
	confirmText?: string;
	cancelText?: string;
	type?: "danger" | "warning" | "success" | "info";
	loading?: boolean;
}

export default function ConfirmationModal({
	isOpen,
	onClose,
	onConfirm,
	title,
	description,
	confirmText = "확인",
	cancelText = "취소",
	type = "warning",
	loading = false,
}: ConfirmationModalProps) {
	const getIcon = () => {
		switch (type) {
			case "danger":
				return <XCircle className="w-6 h-6 text-red-500" />;
			case "warning":
				return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
			case "success":
				return <CheckCircle className="w-6 h-6 text-green-500" />;
			case "info":
				return <Trash2 className="w-6 h-6 text-blue-500" />;
			default:
				return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
		}
	};

	const getConfirmButtonClass = () => {
		switch (type) {
			case "danger":
				return "bg-red-600 hover:bg-red-700 text-white";
			case "warning":
				return "bg-yellow-600 hover:bg-yellow-700 text-white";
			case "success":
				return "bg-green-600 hover:bg-green-700 text-white";
			case "info":
				return "bg-blue-600 hover:bg-blue-700 text-white";
			default:
				return "bg-yellow-600 hover:bg-yellow-700 text-white";
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-3">
						{getIcon()}
						{title}
					</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<button
						type="button"
						onClick={onClose}
						disabled={loading}
						className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{cancelText}
					</button>
					<button
						type="button"
						onClick={onConfirm}
						disabled={loading}
						className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonClass()}`}
					>
						{loading ? "처리 중..." : confirmText}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
