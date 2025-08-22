export interface Log {
  _id: string;
  message: string;
  logLevel: string;
  traceId: string;
  time: string;
  sourceApp: string;
}

export interface TableLog {
  id: string;
  timestamp: string;
  logLevel: string;
  sourceApp: string;
  message: string;
  traceId: string;
}

export interface LogFilters {
  applications?: string[];
  logLevels?: string[];
  fromDate?: string;
  toDate?: string;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

export interface LogsResponse {
  logs: Log[];
  pagination: Pagination;
}

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

export interface ExportResponse {
  message: string;
  exportId?: string;
  status?: string;
}

export interface UseLogsOptions {
  onUnauthorized?: () => void;
  pageSize?: number;
}

export interface LogStats {
  totalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
}

export interface LogCounts {
  logsToday: number;
  errors: number;
}

export type LogCountsRecord = Record<string, LogCounts>;

export type SortDirection = 'asc' | 'desc' | 'default';
export type SortableColumn = 'timestamp' | 'logLevel' | 'sourceApp' | 'traceId' | 'message';

export interface FilterState {
  applications: string[];
  logLevels: string[];
  fromDate: string | null;
  toDate: string | null;
}

export interface DropdownOption {
  value: string;
  label: string;
}

export interface LogTableProps {
  logs: Log[];
  pagination: Pagination;
  loading?: boolean;
  onSort?: (sortBy?: string, sortOrder?: 'asc' | 'desc' | 'default') => void;
}