import { 
  Application, 
  Log, 
  StatusBadgeConfig, 
  ApplicationStatus, 
  FormValidationResult,
  ApplicationsSummary 
} from '../components/pages/Applications/types';

export const getLastLogTime = (appId: string, logs: Log[]): string => {
  const appLogs = logs.filter(log => log.sourceApp === appId);
  
  if (appLogs.length === 0) {
    return 'No logs';
  }

  const sortedLogs = appLogs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const lastLog = sortedLogs[0];
  
  const now = new Date();
  const lastLogDate = new Date(lastLog.time);
  const diffInMinutes = Math.floor((now.getTime() - lastLogDate.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes === 1) {
    return '1 minute ago';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
};

export const getStatusBadge = (app: Application, errorCount: number): StatusBadgeConfig => {
  let status: ApplicationStatus;
  
  if (!app.active) {
    status = 'inactive';
  } else {
    status = 'active';
  }

  const statusConfig: Record<ApplicationStatus, StatusBadgeConfig> = {
    active: { class: 'oj-badge oj-badge-success', text: 'active' },
    inactive: { class: 'oj-badge oj-badge-danger', text: 'inactive' }
  };

  return statusConfig[status];
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function validateApplicationForm(name: string, description: string): FormValidationResult {
  const errors: { name?: string; description?: string } = {};

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  const namePattern = /^[a-zA-Z0-9 _-]+$/;
  const descriptionPattern = /^[a-zA-Z0-9 _\-\.\,\:\;\(\)\[\]'""]+$/;

  if (trimmedName.length < 5 || trimmedName.length > 20) {
    errors.name = 'Name must be between 5 and 20 characters.';
  } else if (!namePattern.test(trimmedName)) {
    errors.name = 'Name can only contain letters, numbers, spaces, hyphens (-), and underscores (_).';
  }

  if (trimmedDescription.length < 10 || trimmedDescription.length > 100) {
    errors.description = 'Description must be between 10 and 100 characters.';
  } else if (!descriptionPattern.test(trimmedDescription)) {
    errors.description = 'Description contains invalid characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export const filterApplications = (applications: Application[], searchQuery: string): Application[] => {
  if (!searchQuery.trim()) {
    return applications;
  }
  
  const query = searchQuery.toLowerCase().trim();
  
  return applications.filter(app => 
    app.name.toLowerCase().includes(query) ||
    app.description.toLowerCase().includes(query)
  );
};

export const sortApplications = (
  applications: Application[], 
  sortBy: 'name' | 'lastUpdate' | 'errors' | 'logsToday' = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): Application[] => {
  return [...applications].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'lastUpdate':
        comparison = new Date(a.lastUpdate).getTime() - new Date(b.lastUpdate).getTime();
        break;
      case 'errors':
        comparison = a.errorsToday - b.errorsToday;
        break;
      case 'logsToday':
        comparison = a.logsToday - b.logsToday;
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
};

export const getApplicationsSummary = (
  applications: Application[],
  logCounts: Record<string, { logsToday: number; errors: number }>
): ApplicationsSummary => {
  const total = applications.length;
  const active = applications.filter(app => app.active).length;
  const inactive = total - active;
  
  const totalLogs = Object.values(logCounts).reduce((sum, counts) => sum + counts.logsToday, 0);
  const totalErrors = Object.values(logCounts).reduce((sum, counts) => sum + counts.errors, 0);
  
  const applicationsWithWarnings = applications.filter(app => {
    const appLogCounts = logCounts[app._id] || { logsToday: 0, errors: 0 };
    return app.active && appLogCounts.errors > 5;
  }).length;
  
  return {
    total,
    active,
    inactive,
    warnings: applicationsWithWarnings,
    totalLogs,
    totalErrors
  };
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