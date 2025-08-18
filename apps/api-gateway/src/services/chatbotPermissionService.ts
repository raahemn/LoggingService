import { Tool } from "./mcpClientService";
import Group from "../models/Group.model";
import Application from "../models/Application.model";
import logger from '../config/logger';

interface UserApplication {
  _id: string;
  name: string;
}

export class ChatbotPermissionService {
  private permissionLogger = logger.withTraceId('PERMISSION');
  
  private readonly ADMIN_RESTRICTED_TOOLS = [
    'mcp_mongodb_switch-connection',        'switch-connection',
    'mcp_mongodb_create-index',             'create-index', 
    'mcp_mongodb_rename-collection',        'rename-collection',
    'mcp_mongodb_drop-database',            'drop-database', 
    'mcp_mongodb_drop-collection',          'drop-collection'
  ];

  private readonly ADMIN_PROTECTED_COLLECTIONS = ['agendaJobs', 'jobstatuses'];

  private readonly NON_ADMIN_PROTECTED_COLLECTIONS = [
    'agendaJobs', 'applications', 'drp', 'groups', 'jobstatuses', 'users'
  ];

  private readonly NON_ADMIN_RESTRICTED_TOOLS = [
    'mcp_mongodb_switch-connection',        'switch-connection',
    'mcp_mongodb_list-collections',         'list-collections',
    'mcp_mongodb_collection-indexes',       'collection-indexes',
    'mcp_mongodb_create-index',             'create-index',
    'mcp_mongodb_insert-many',              'insert-many',
    'mcp_mongodb_delete-many',              'delete-many',
    'mcp_mongodb_update-many',              'update-many',
    'mcp_mongodb_rename-collection',        'rename-collection',
    'mcp_mongodb_drop-database',            'drop-database',
    'mcp_mongodb_drop-collection',          'drop-collection',
    'mcp_mongodb_create-collection',        'create-collection',
    'mcp_mongodb_mongodb-logs',             'mongodb-logs'
  ];

  async getUserApplications(userId: string): Promise<UserApplication[]> {
    try {
      const userGroups = await Group.find({
        memberIDs: userId,
        active: true,
        deleted: false
      }).select('applicationIDs');

      const applicationIds = new Set<string>();
      userGroups.forEach(group => {
        group.applicationIDs.forEach(appId => applicationIds.add(appId.toString()));
      });

      const applications = await Application.find({
        _id: { $in: Array.from(applicationIds) },
        active: true,
        deleted: false
      }).select('_id name');

      return applications.map(app => ({
        _id: app._id?.toString() || '',
        name: app.name
      }));
    } catch (error) {
      this.permissionLogger.error('Error fetching user applications', error);
      return [];
    }
  }

  filterToolsForUser(tools: Tool[], isUserAdmin: boolean): Tool[] {
    const restrictedTools = isUserAdmin ? this.ADMIN_RESTRICTED_TOOLS : this.NON_ADMIN_RESTRICTED_TOOLS;
    return tools.filter(tool => !restrictedTools.includes(tool.name));
  }

  async validateToolOperation(
    toolName: string,
    args: Record<string, unknown>,
    isUserAdmin: boolean,
    userId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const collection = args.collection as string;

    if (isUserAdmin) {
      if (this.ADMIN_RESTRICTED_TOOLS.includes(toolName)) {
        return { allowed: false, reason: `Access denied: The tool '${toolName}' is restricted for all users.` };
      }

      if (collection && this.ADMIN_PROTECTED_COLLECTIONS.includes(collection)) {
        return { allowed: false, reason: `Access denied: Operations on '${collection}' collection are restricted for all users.` };
      }

      if (collection === 'logs' && (toolName === 'mcp_mongodb_delete-many' || toolName === 'mcp_mongodb_update-many')) {
        return { allowed: false, reason: `Access denied: Delete and update operations on 'logs' collection are restricted for admin users.` };
      }
    } else {
      if (this.NON_ADMIN_RESTRICTED_TOOLS.includes(toolName)) {
        return { allowed: false, reason: `Access denied: The tool '${toolName}' is restricted for non-admin users. You have read-only access.` };
      }

      if (collection && this.NON_ADMIN_PROTECTED_COLLECTIONS.includes(collection)) {
        return { allowed: false, reason: `Access denied: You do not have permission to access the '${collection}' collection.` };
      }

      if (collection === 'logs' && userId) {
        return await this.validateLogAccess(args, userId);
      }
    }

    return { allowed: true };
  }

  private async validateLogAccess(args: Record<string, unknown>, userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const userApplications = await this.getUserApplications(userId);
    const userAppIds = userApplications.map(app => app._id?.toString() || app._id);

    this.permissionLogger.debug(`User ${userId} has access to applications: ${userAppIds.join(', ')}`);

    const filter = args.filter as Record<string, unknown>;
    this.permissionLogger.debug(`Filter applied: ${JSON.stringify(filter)}`);

    if (!filter) {
      return {
        allowed: false,
        reason: `Access denied: You must specify a 'sourceApp' filter to access logs. Your accessible applications: ${userAppIds.join(', ')}`
      };
    }

    const sourceAppIds = this.extractSourceAppsFromFilter(filter);
    this.permissionLogger.debug(`Extracted sourceApp IDs: ${sourceAppIds.join(', ')}`);

    if (sourceAppIds.length === 0) {
      return {
        allowed: false,
        reason: `Access denied: You must specify a 'sourceApp' filter to access logs. Your accessible applications: ${userAppIds.join(', ')}`
      };
    }

    const unauthorizedApps = sourceAppIds.filter(appId => !userAppIds.includes(appId));
    if (unauthorizedApps.length > 0) {
      return {
        allowed: false,
        reason: `Access denied: You don't have permission to access logs for application(s): ${unauthorizedApps.join(', ')}. Your accessible applications: ${userAppIds.join(', ')}`
      };
    }

    this.permissionLogger.info(`Access granted for sourceApp(s): ${sourceAppIds.join(', ')}`);
    return { allowed: true };
  }

  private extractSourceAppsFromFilter(filter: Record<string, unknown>): string[] {
    const apps: string[] = [];

    const normalizeAppId = (sourceApp: unknown): string | null => {
      if (!sourceApp) return null;
      if (typeof sourceApp === 'string') return sourceApp;
      
      if (typeof sourceApp === 'object' && sourceApp !== null) {
        const obj = sourceApp as Record<string, unknown>;
        if (obj.$oid && typeof obj.$oid === 'string') return obj.$oid;
        if ('toString' in obj && typeof obj.toString === 'function') return obj.toString();
      }
      return null;
    };

    // Direct sourceApp filter
    if (filter.sourceApp) {
      const appId = normalizeAppId(filter.sourceApp);
      if (appId) apps.push(appId);
    }

    // $or queries
    if (filter.$or && Array.isArray(filter.$or)) {
      filter.$or.forEach((condition: unknown) => {
        if (condition && typeof condition === 'object') {
          const conditionObj = condition as Record<string, unknown>;
          if (conditionObj.sourceApp) {
            const appId = normalizeAppId(conditionObj.sourceApp);
            if (appId && !apps.includes(appId)) apps.push(appId);
          }
        }
      });
    }

    // $in queries
    if (filter.sourceApp && typeof filter.sourceApp === 'object') {
      const sourceAppObj = filter.sourceApp as Record<string, unknown>;
      if (sourceAppObj.$in && Array.isArray(sourceAppObj.$in)) {
        sourceAppObj.$in.forEach((appId: unknown) => {
          const normalizedId = normalizeAppId(appId);
          if (normalizedId && !apps.includes(normalizedId)) apps.push(normalizedId);
        });
      }
    }

    return apps;
  }
}
