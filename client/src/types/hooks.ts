// Hook-related types

import type { Dispatch, SetStateAction } from "react";

// State management hooks
export interface UseStateReturn<T> {
	value: T;
	setValue: Dispatch<SetStateAction<T>>;
	reset: () => void;
}

export interface UseToggleReturn {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
}

// API hooks
export interface UseApiReturn<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

export interface UseApiOptions {
	immediate?: boolean;
	onSuccess?: (data: unknown) => void;
	onError?: (error: string) => void;
}

export interface UsePaginationReturn {
	currentPage: number;
	totalPages: number;
	hasNext: boolean;
	hasPrevious: boolean;
	goToNext: () => void;
	goToPrevious: () => void;
	goToPage: (page: number) => void;
	setTotalPages: (total: number) => void;
}

export interface UsePaginationOptions {
	initialPage?: number;
	pageSize?: number;
	totalItems?: number;
}

// Form hooks
export interface UseFormReturn<T> {
	values: T;
	errors: Record<keyof T, string>;
	touched: Record<keyof T, boolean>;
	isValid: boolean;
	isSubmitting: boolean;
	setValue: <K extends keyof T>(field: K, value: T[K]) => void;
	setError: <K extends keyof T>(field: K, error: string) => void;
	setTouched: <K extends keyof T>(field: K, touched: boolean) => void;
	handleSubmit: (
		onSubmit: (values: T) => void | Promise<void>,
	) => (event?: React.FormEvent) => void;
	reset: () => void;
}

export interface UseFormOptions<T> {
	initialValues: T;
	validationSchema?: (values: T) => Record<keyof T, string>;
	onSubmit?: (values: T) => void | Promise<void>;
}

// Search hooks
export interface UseSearchReturn<T> {
	query: string;
	results: T[];
	loading: boolean;
	error: string | null;
	setQuery: (query: string) => void;
	clearSearch: () => void;
	refetch: () => Promise<void>;
}

export interface UseSearchOptions {
	debounceMs?: number;
	minQueryLength?: number;
	immediate?: boolean;
}

// Local storage hooks
export interface UseLocalStorageReturn<T> {
	value: T | null;
	setValue: (value: T) => void;
	removeValue: () => void;
	hasValue: boolean;
}

export interface UseLocalStorageOptions {
	serializer?: {
		read: (value: string) => unknown;
		write: (value: unknown) => string;
	};
}

// Theme hooks
export interface UseThemeReturn {
	theme: "light" | "dark" | "system";
	setTheme: (theme: "light" | "dark" | "system") => void;
	toggleTheme: () => void;
	isDark: boolean;
	isLight: boolean;
}

// Media query hooks
export interface UseMediaQueryReturn {
	matches: boolean;
	width?: number;
	height?: number;
}

// Async hooks
export interface UseAsyncReturn<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
	execute: (...args: unknown[]) => Promise<T>;
	reset: () => void;
}

export interface UseAsyncOptions {
	immediate?: boolean;
	onSuccess?: (data: unknown) => void;
	onError?: (error: string) => void;
}

// Fetch hooks
export interface UseFetchReturn<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

export interface UseFetchOptions {
	headers?: Record<string, string>;
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	body?: unknown;
	immediate?: boolean;
}

// Upload hooks
export interface UseUploadReturn {
	uploading: boolean;
	progress: number;
	error: string | null;
	uploadedFiles: Array<{
		file: File;
		url: string;
	}>;
	upload: (files: File[]) => Promise<void>;
	reset: () => void;
}

export interface UseUploadOptions {
	maxFileSize?: number;
	acceptedTypes?: string[];
	maxFiles?: number;
	onProgress?: (progress: number) => void;
	onSuccess?: (files: Array<{ file: File; url: string }>) => void;
	onError?: (error: string) => void;
}

// Debounce hooks
export interface UseDebounceReturn<T> {
	debouncedValue: T;
	isDebouncing: boolean;
}

// Interval hooks
export interface UseIntervalReturn {
	isActive: boolean;
	start: () => void;
	stop: () => void;
	restart: () => void;
}

// Previous value hooks
export interface UsePreviousReturn<T> {
	previous: T | undefined;
	hasPrevious: boolean;
}

// Window size hooks
export interface UseWindowSizeReturn {
	width: number;
	height: number;
	isMobile: boolean;
	isTablet: boolean;
	isDesktop: boolean;
}

// Scroll hooks
export interface UseScrollReturn {
	scrollX: number;
	scrollY: number;
	isScrolling: boolean;
	scrollToTop: () => void;
	scrollToBottom: () => void;
	scrollToElement: (element: HTMLElement | string) => void;
}

// Modal hooks
export interface UseModalReturn {
	isOpen: boolean;
	open: (data?: unknown) => void;
	close: () => void;
	toggle: () => void;
	data: unknown;
}

// Clipboard hooks
export interface UseClipboardReturn {
	copy: (text: string) => Promise<void>;
	copied: boolean;
	error: string | null;
	isSupported: boolean;
}

// Geolocation hooks
export interface UseGeolocationReturn {
	location: {
		latitude: number;
		longitude: number;
		accuracy: number;
	} | null;
	error: string | null;
	loading: boolean;
	refresh: () => void;
}

// Permission hooks
export interface UsePermissionReturn {
	state: "granted" | "denied" | "prompt" | "unknown";
	isGranted: boolean;
	isDenied: boolean;
	request: () => Promise<void>;
}
