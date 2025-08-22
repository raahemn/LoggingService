import { ILog } from "../models/Log.model";
import { sendEmail } from "../services/emailService";
import logger from '../config/logger';

// Export utils debug logger
const exportDebugger = logger.withTraceId('EXPORT');

interface LogFilters {
  applications?: string[];
  logLevels?: string[];
  fromDate?: Date;
  toDate?: Date;
}

export const convertLogsToCSV = (logs: ILog[]): string => {
  if (!logs || logs.length === 0) {
    return 'No logs found for the specified criteria\n';
  }
  
  const headers = [
    'Date',
    'Log Level',
    'Source Application',
    'Trace ID',
    'Message',
  ];
  
  const csvRows = [headers.join(',')];
  
  logs.forEach(log => {
    const row = [
      `"${log.time ? new Date(log.time).toISOString() : ''}"`,
      `"${log.logLevel || ''}"`,
      `"${log.sourceApp || ''}"`,
      `"${log.traceId || ''}"`,
      `"${(log.message || '').replace(/"/g, '""')}"`, 
    ];
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
};

export const convertLogsToJSON = (logs: ILog[]): string => {
  if (!logs || logs.length === 0) {
    return JSON.stringify({
      message: 'No logs found for the specified criteria',
      logs: [],
      count: 0
    }, null, 2);
  }
  
  const formattedLogs = logs.map(log => ({
    time: log.time ? new Date(log.time).toISOString() : null,
    logLevel: log.logLevel || null,
    sourceApplication: log.sourceApp || null,
    traceId: log.traceId || null,
    message: log.message || null
  }));
  
  const jsonData = {
    exportInfo: {
      exportDate: new Date().toISOString(),
      totalRecords: logs.length,
      format: 'JSON'
    },
    logs: formattedLogs
  };
  
  return JSON.stringify(jsonData, null, 2);
};

export const createFilterSummary = (filters?: LogFilters): string => {
  if (!filters) return '';
  
  const summaryParts: string[] = [];
  
  if (filters.fromDate) {
    summaryParts.push(`From: ${filters.fromDate.toISOString().split('T')[0]}`);
  }
  
  if (filters.toDate) {
    summaryParts.push(`To: ${filters.toDate.toISOString().split('T')[0]}`);
  }
  
  if (filters.applications && filters.applications.length > 0) {
    summaryParts.push(`Applications: ${filters.applications.join(', ')}`);
  }
  
  if (filters.logLevels && filters.logLevels.length > 0) {
    summaryParts.push(`Log Levels: ${filters.logLevels.join(', ')}`);
  }
  
  return summaryParts.join('; ');
};

export const sendLogExportEmail = async (
  userEmail: string,
  fileData: string,
  filters?: LogFilters,
  format: 'csv' | 'json' = 'csv'
): Promise<void> => {
  const subject = `Log Export Complete - ${format.toUpperCase()} Format`;
  const filterSummary = createFilterSummary(filters);
  
  let recordCount: number;
  if (format === 'json') {
    try {
      const jsonData = JSON.parse(fileData);
      recordCount = jsonData.logs?.length || 0;
    } catch {
      recordCount = 0;
    }
  } else {
    recordCount = Math.max(0, fileData.split('\n').length - 1);
  }
  
  const htmlContent = `
    <h2>Your log export is ready!</h2>
    <p>Your requested log export has been completed successfully in <strong>${format.toUpperCase()}</strong> format.</p>
    
    <h3>Export Details:</h3>
    <ul>
      <li><strong>Export Date:</strong> ${new Date().toISOString()}</li>
      <li><strong>Format:</strong> ${format.toUpperCase()}</li>
      <li><strong>Total Records:</strong> ${recordCount}</li>
      ${filterSummary ? `<li><strong>Applied Filters:</strong> ${filterSummary}</li>` : ''}
    </ul>
    
    <p>Please find your logs attached as a ${format.toUpperCase()} file.</p>
    
    <p>Best regards,<br>Your Logging Team</p>
  `;
  
  const fileExtension = format === 'json' ? 'json' : 'csv';
  const contentType = format === 'json' ? 'application/json' : 'text/csv';
  
  const attachments = [
    {
      filename: `logs-export-${new Date().toISOString().split('T')[0]}.${fileExtension}`,
      content: fileData,
      contentType
    }
  ];

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      exportDebugger.debug(`Attempting to send email to ${userEmail} (attempt ${attempt}/${maxRetries})`);
      
      await sendEmail({
        to: userEmail,
        subject,
        html: htmlContent,
        attachments
      });
      
      exportDebugger.info(`Email sent successfully to ${userEmail}`);
      return;
      
    } catch (error: any) {
      lastError = error;
      exportDebugger.error(`Email attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; 
        exportDebugger.debug(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we get here, all retries failed
  throw new Error(`Failed to send email after ${maxRetries} attempts. Last error: ${lastError.message}`);
};

export const sendExportErrorEmail = async (
  userEmail: string,
  errorMessage: string
): Promise<void> => {
  const subject = 'Log Export Failed';
  
  const htmlContent = `
    <h2>Log Export Failed</h2>
    <p>We encountered an error while processing your log export request.</p>
    
    <h3>Error Details:</h3>
    <p><code>${errorMessage}</code></p>
    
    <p>Please try again on the dashboard or contact support if the issue persists.</p>
    
    <p>Best regards,<br>Your Logging Team</p>
  `;
  
  await sendEmail({
    to: userEmail,
    subject,
    html: htmlContent
  });
};