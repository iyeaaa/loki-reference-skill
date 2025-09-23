// Common utility types and interfaces

// Error handling types
export interface ApiError {
	message: string;
	code: string;
	details?: Record<string, unknown>;
}

export interface NetworkError extends Error {
	status?: number;
	statusText?: string;
}

export interface ValidationError {
	field: string;
	message: string;
}

// Event handler types
export type AsyncEventHandler = (event: React.FormEvent) => Promise<void>;
export type SyncEventHandler = (event: React.FormEvent) => void;
export type EventHandler = AsyncEventHandler | SyncEventHandler;

// Component types
export interface BaseComponentProps {
	className?: string;
	id?: string;
}

export interface PageProps {
	params: {
		locale: string;
		[key: string]: string | string[];
	};
	searchParams?: Record<string, string | string[] | undefined>;
}

// Utility types for components
export type WithChildren<T = {}> = T & {
	children?: React.ReactNode;
};

export type WithOptionalChildren<T = {}> = T & {
	children?: React.ReactNode;
};

// Form types
export type FormSubmitHandler<T = Record<string, unknown>> = (
	data: T,
	event?: React.FormEvent,
) => Promise<void> | void;

export interface FormFieldError {
	type: string;
	message: string;
}

// API response wrapper types
export interface ApiResponse<T = unknown> {
	data: T;
	success: boolean;
	message?: string;
	error?: ApiError;
}

export interface PaginatedResponse<T = unknown> {
	data: T[];
	meta: {
		total: number;
		current_page: number;
		per_page: number;
		total_pages: number;
	};
	message?: string;
}

// Filter and search types
export interface FilterOptions {
	[key: string]: string | number | boolean | undefined;
}

export interface SearchParams {
	query?: string;
	page?: number;
	limit?: number;
	filters?: FilterOptions;
}

// File upload types
export interface FileUploadError {
	file: File;
	error: string;
}

export interface FileUploadProgress {
	file: File;
	progress: number;
	uploaded: boolean;
}

export interface FileUploadResult {
	file: File;
	url?: string;
	error?: string;
	success: boolean;
}

// Translation types
export type TranslationKey = string;
export type TranslationValues = Record<string, string | number>;
export type TranslationFunction = (
	key: TranslationKey,
	values?: TranslationValues,
) => string;

// Theme types
export type Theme = "light" | "dark" | "system";

// Loading states
export interface LoadingState {
	isLoading: boolean;
	error?: string | null;
}

// Generic callback types
export type Callback = () => void;
export type AsyncCallback = () => Promise<void>;
export type CallbackWithParam<T> = (param: T) => void;
export type AsyncCallbackWithParam<T> = (param: T) => Promise<void>;

// Local storage types
export interface LocalStorageItem<T> {
	value: T;
	timestamp: number;
	expiry?: number;
}

// Navigation types
export interface NavigationItem {
	href: string;
	label: string;
	icon?: React.ComponentType;
	children?: NavigationItem[];
}

// Modal types (removed ModalProps - using the one from component.ts instead)

// Table types
export interface TableColumn<T = unknown> {
	key: string;
	label: string;
	sortable?: boolean;
	render?: (value: unknown, row: T) => React.ReactNode;
}

export interface TableProps<T = unknown> {
	data: T[];
	columns: TableColumn<T>[];
	loading?: boolean;
	onSort?: (column: string, direction: "asc" | "desc") => void;
}

// Notification types
export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationProps {
	type: NotificationType;
	title: string;
	message?: string;
	duration?: number;
	onClose?: () => void;
}
