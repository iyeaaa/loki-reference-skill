// Re-export user types first to make Department available
export * from './user';

// Base API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
  timestamp?: string;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Import Department type from user module
import type { Department } from './user';

// Department Response Type
export interface DepartmentsResponse {
  departments: Department[];
}