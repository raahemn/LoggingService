export type ApplicationStatus = 'active' | 'inactive';

export interface Log {
  _id: string;
  message: string;
  logLevel: string;
  traceId: string;
  time: string;
  sourceApp: string;
}

export interface Application {
  _id: string;
  name: string;
  description: string;
  active: boolean;
  lastUpdate: string;
  logsToday: number;
  errorsToday: number;
  threshold?: number;
  timePeriod?: number;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface StatusBadgeConfig {
  class: string;
  text: string;
}

export interface ApplicationFilters {
  active?: boolean;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

export interface CreateApplicationData {
  name: string;
  description: string;
}

export interface UpdateApplicationData {
  name?: string;
  description?: string;
  active?: boolean;
}

export interface DropdownOption {
  value: string;
  label: string;
}

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

export interface ApplicationsResponse {
  applications: Application[];
  pagination: Pagination;
}

export interface UseApplicationsOptions {
  pageSize?: number;
}

export interface OriginalFormValues {
  name: string;
  description: string;
  active: boolean;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: {
    name?: string;
    description?: string;
  };
}

export interface ApplicationsSummary {
  total: number;
  active: number;
  inactive: number;
  warnings: number;
  totalLogs: number;
  totalErrors: number;
}