import { Log, LogCounts, LogCountsRecord, TableLog, FilterState, LogFilters, SortableColumn, SortDirection } from '../components/pages/Dashboard/types';

export class LogUtils {
  static computeLogCounts(logs: Log[]): LogCountsRecord {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts: LogCountsRecord = {};

    logs.forEach(log => {
      const sourceAppId = log.sourceApp;

      if (!sourceAppId) {
        return;
      }

      const logDate = new Date(log.time);
      if (isNaN(logDate.getTime())) {
        return;
      }

      logDate.setHours(0, 0, 0, 0);

      if (!counts[sourceAppId]) {
        counts[sourceAppId] = { logsToday: 0, errors: 0 };
      }

      counts[sourceAppId].logsToday++;

      if (log.logLevel && log.logLevel.toLowerCase().includes('error')) {
        counts[sourceAppId].errors++;
      }
    });

    return counts;
  }

  static getLatestLogDate(logs: Log[]): string | null {
    if (logs.length === 0) return null;
    return logs[logs.length - 1].time;
  }

  static mergeLogs(existingLogs: Log[], newLogs: Log[]): Log[] {
    return [...existingLogs, ...newLogs];
  }

  static filterLogsBySourceApp(logs: Log[], sourceApp: string): Log[] {
    return logs.filter(log => log.sourceApp === sourceApp);
  }

  static filterLogsByLevel(logs: Log[], level: string): Log[] {
    return logs.filter(log => 
      log.logLevel && log.logLevel.toLowerCase().includes(level.toLowerCase())
    );
  }
}

export const formatTimestamp = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

export const convertLogsToTableFormat = (logs: Log[]): TableLog[] => {
  return logs.map((log, index) => ({
    id: log._id || index.toString(),
    timestamp: formatTimestamp(log.time),
    logLevel: log.logLevel,
    traceId: log.traceId || 'N/A',
    sourceApp: log.sourceApp || 'Unknown',
    message: log.message,
  }));
};

export const convertFiltersToApiFormat = (filterState: FilterState): LogFilters => {
  const apiFilters: LogFilters = {};

  if (filterState.applications.length > 0) {
    apiFilters.applications = filterState.applications;
  }

  if (filterState.logLevels.length > 0) {
    apiFilters.logLevels = filterState.logLevels;
  }

  if (filterState.fromDate) {
    apiFilters.fromDate = filterState.fromDate;
  }

  if (filterState.toDate) {
    apiFilters.toDate = filterState.toDate;
  }

  return apiFilters;
};

export const sortTableData = (
  data: TableLog[], 
  sortColumn: SortableColumn | null, 
  sortDirection: SortDirection
): TableLog[] => {
  if (!sortColumn || !sortDirection) {
    return data;
  }

  return [...data].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortColumn) {
      case 'timestamp':
        aVal = a.timestamp;
        bVal = b.timestamp;
        break;
      case 'logLevel':
        aVal = a.logLevel.toLowerCase();
        bVal = b.logLevel.toLowerCase();
        break;
      case 'sourceApp':
        aVal = a.sourceApp.toLowerCase();
        bVal = b.sourceApp.toLowerCase();
        break;
      case 'traceId':
        aVal = (a.traceId || '').toLowerCase();
        bVal = (b.traceId || '').toLowerCase();
        break;
      case 'message':
        aVal = a.message.toLowerCase();
        bVal = b.message.toLowerCase();
        break;
      default:
        return 0;
    }

    if (aVal < bVal) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aVal > bVal) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

export const createHeaderText = (text: string, column: SortableColumn, sortColumn: SortableColumn | null, sortDirection: SortDirection): string => {
  let icon: string;
  
  if (sortColumn === column && sortDirection) {
    icon = sortDirection === 'asc' ? ' ▲' : ' ▼';
  } else {
    icon = ' ⇅';
  }
  
  return text + icon;
};

export const getVisiblePageNumbers = (currentPage: number, totalPages: number): number[] => {
  const visiblePages: number[] = [];
  const maxVisiblePages = 7;
  
  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      visiblePages.push(i);
    }
  } else {
    const halfVisible = Math.floor(maxVisiblePages / 2);
    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      visiblePages.push(i);
    }
  }
  
  return visiblePages;
};

export default LogUtils;