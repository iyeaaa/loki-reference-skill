// Component-specific types

import type { ComponentType, ReactNode } from "react";
import type { TranslationFunction } from "./common";

// Header Component Types
export interface HeaderProps {
	locale: string;
	translations: TranslationFunction;
}

export interface NavigationMenuProps {
	locale: string;
	translations: TranslationFunction;
	isAdmin?: boolean;
	onMenuToggle?: () => void;
}

// Product Components
export interface ProductCardProps {
	product: {
		id: string;
		name: string;
		description?: string;
		image_url?: string;
		category?: string;
		price?: number;
	};
	locale: string;
	onSelect?: (productId: string) => void;
}

export interface ProductCarouselProps {
	products: ProductCardProps["product"][];
	locale: string;
	autoPlay?: boolean;
	showControls?: boolean;
}

export interface ProductFilterProps {
	categories: string[];
	selectedCategory?: string;
	onCategoryChange: (category: string) => void;
	onReset?: () => void;
}

// Form Components
export interface PhotoUploadFormProps {
	onFilesChange: (files: File[]) => void;
	maxFiles?: number;
	acceptedTypes?: string[];
	maxSize?: number;
	existingFiles?: File[];
}

export interface FormInputProps {
	name: string;
	label: string;
	type?: "text" | "email" | "password" | "number" | "tel" | "url";
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	error?: string;
	value?: string;
	onChange?: (value: string) => void;
}

export interface FormSelectProps {
	name: string;
	label: string;
	options: Array<{ value: string; label: string }>;
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	error?: string;
	value?: string;
	onChange?: (value: string) => void;
}

export interface FormTextareaProps {
	name: string;
	label: string;
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	error?: string;
	value?: string;
	rows?: number;
	onChange?: (value: string) => void;
}

// Modal Components
export interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: ReactNode;
	size?: "sm" | "md" | "lg" | "xl";
	showCloseButton?: boolean;
}

export interface ConfirmationModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void | Promise<void>;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	type?: "danger" | "warning" | "info";
}

// Category Components
export interface CategoryTreeNode {
	id: string;
	name: string;
	parent_id?: string;
	children?: CategoryTreeNode[];
	product_count?: number;
}

export interface CategoryTreeProps {
	categories: CategoryTreeNode[];
	selectedCategory?: string;
	onCategorySelect: (categoryId: string) => void;
	showProductCount?: boolean;
	expandable?: boolean;
}

export interface CategoryFilterProps {
	categories: CategoryTreeNode[];
	selectedCategories: string[];
	onCategoryChange: (categoryIds: string[]) => void;
	allowMultiple?: boolean;
}

// Layout Components
export interface LayoutProps {
	children: ReactNode;
	locale: string;
	showHeader?: boolean;
	showFooter?: boolean;
	className?: string;
}

export interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
	items: Array<{
		label: string;
		href: string;
		icon?: ComponentType;
	}>;
}

// Table Components
export interface DataTableProps<T = unknown> {
	data: T[];
	columns: Array<{
		key: string;
		label: string;
		sortable?: boolean;
		render?: (value: unknown, row: T) => ReactNode;
	}>;
	loading?: boolean;
	pagination?: {
		current: number;
		total: number;
		pageSize: number;
		onPageChange: (page: number) => void;
	};
	onSort?: (column: string, direction: "asc" | "desc") => void;
	onRowClick?: (row: T) => void;
	emptyMessage?: string;
}

export interface TableActionProps {
	onEdit?: () => void;
	onDelete?: () => void;
	onView?: () => void;
	editLabel?: string;
	deleteLabel?: string;
	viewLabel?: string;
	showEdit?: boolean;
	showDelete?: boolean;
	showView?: boolean;
}

// Search Components
export interface SearchBoxProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	onSubmit?: (value: string) => void;
	debounceMs?: number;
	disabled?: boolean;
}

export interface SearchResultsProps<T = unknown> {
	results: T[];
	query: string;
	loading: boolean;
	error?: string;
	onResultClick?: (result: T) => void;
	renderResult?: (result: T) => ReactNode;
	emptyMessage?: string;
}

// Loading Components
export interface LoadingSpinnerProps {
	size?: "sm" | "md" | "lg";
	color?: string;
	className?: string;
}

export interface LoadingSkeletonProps {
	height?: number | string;
	width?: number | string;
	className?: string;
	rounded?: boolean;
}

// Button Components
export interface ButtonProps {
	variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
	size?: "sm" | "md" | "lg";
	disabled?: boolean;
	loading?: boolean;
	onClick?: () => void | Promise<void>;
	children: ReactNode;
	className?: string;
	type?: "button" | "submit" | "reset";
}

// Toast/Notification Components
export interface ToastProps {
	type: "success" | "error" | "warning" | "info";
	title: string;
	message?: string;
	duration?: number;
	onClose?: () => void;
	position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}
