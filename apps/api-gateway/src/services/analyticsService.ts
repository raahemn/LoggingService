import { Log } from '../models/Log.model';
import Group from '../models/Group.model';
import mongoose from 'mongoose';
import logger from '../config/logger';
import config from '../config/config';

// Analytics debug logger
const analyticsDebugger = logger.withTraceId('ANALYTICS');

export interface LogLevelDistribution {
  _id: string;
  count: number;
  percentage: number;
}

export interface ApplicationCount {
  _id: string;
  applicationName: string;
  count: number;
}

export interface VolumeDataPoint {
  _id: string;
  count: number;
  timestamp: Date;
}

export interface AnalyticsFilters {
  applicationIDs?: string[];
  logLevels?: string[];
  from?: Date;
  to?: Date;
}

export interface AnalyticsResponse {
  logLevelDistribution: LogLevelDistribution[];
  applicationCounts: ApplicationCount[];
  volumeTrend: VolumeDataPoint[];
  totalLogs: number;
  period: {
    from: Date;
    to: Date;
    granularity: string;
  };
}

interface MongoQuery {
  time: { $gte: Date; $lte: Date };
  sourceApp?: { $in: mongoose.Types.ObjectId[] };
  logLevel?: { $in: string[] };
}

export class AnalyticsService {
  static async getAnalytics(userId: string, filters: AnalyticsFilters = {}): Promise<AnalyticsResponse> {
    const userApps = await this.getUserApps(userId);

    if (userApps.length === 0) {
      return this.emptyResponse(filters);
    }

    // Process filters with defaults
    const appIds = filters.applicationIDs?.length ?
      filters.applicationIDs.filter(id => userApps.includes(id)) : userApps;

    const from = filters.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = filters.to || new Date();
    const granularity = this.getGranularity(from, to);

    // Build MongoDB query
    const query: MongoQuery = {
      time: { $gte: from, $lte: to }
    };

    if (appIds.length) {
      query.sourceApp = { $in: appIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    if (filters.logLevels?.length) {
      query.logLevel = { $in: filters.logLevels };
    }

    // Get all data in parallel - combine total count with log levels
    const [logLevelResults, applicationCounts, volumeTrend] = await Promise.all([
      this.getLogLevelsWithTotal(query),
      this.getAppCounts(query, appIds),
      this.getVolumeTrend(query, granularity, from, to)
    ]);

    const { logLevelDistribution, totalLogs } = logLevelResults;

    if (config.nodeEnv === 'development') {
      analyticsDebugger.debug(`Total Logs: ${totalLogs}`);
    }

    return {
      logLevelDistribution,
      applicationCounts,
      volumeTrend,
      totalLogs,
      period: { from, to, granularity }
    };
  }

  private static async getUserApps(userId: string): Promise<string[]> {
    try {
      const result = await Group.aggregate([
        {
          $match: {
            memberIDs: new mongoose.Types.ObjectId(userId),
            active: true,
            deleted: false
          }
        },
        { 
          $project: { 
            applicationIDs: 1 
          } 
        },
        { $unwind: "$applicationIDs" },
        { 
          $group: { 
            _id: null, 
            apps: { $addToSet: "$applicationIDs" } 
          } 
        }
      ]);

      return result[0]?.apps?.map((id: mongoose.Types.ObjectId) => id.toString()) || [];
    } catch (error) {
      console.error('Error getting user apps:', error);
      return [];
    }
  }

  private static emptyResponse(filters: AnalyticsFilters): AnalyticsResponse {
    const from = filters.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = filters.to || new Date();

    return {
      logLevelDistribution: [],
      applicationCounts: [],
      volumeTrend: [],
      totalLogs: 0,
      period: { from, to, granularity: this.getGranularity(from, to) }
    };
  }

  private static getGranularity(from: Date, to: Date): string {
    const minutes = (to.getTime() - from.getTime()) / (1000 * 60);

    if (minutes <= 120) return 'minute';
    if (minutes <= 2880) return 'hour';
    return 'day';
  }

  private static async getLogLevelsWithTotal(query: MongoQuery): Promise<{ logLevelDistribution: LogLevelDistribution[], totalLogs: number }> {
    const results = await Log.aggregate([
      { $match: query },
      { 
        $group: { 
          _id: '$logLevel', 
          count: { $sum: 1 } 
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$count' },
          levels: { $push: { _id: '$_id', count: '$count' } }
        }
      },
      { $unwind: '$levels' },
      {
        $project: {
          _id: '$levels._id',
          count: '$levels.count',
          total: '$total',
          percentage: {
            $round: {
              $multiply: [
                { $divide: ['$levels.count', '$total'] },
                100
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totalLogs = results.length > 0 ? results[0].total : 0;
    const logLevelDistribution = results.map(({ _id, count, percentage }) => ({ _id, count, percentage }));

    return { logLevelDistribution, totalLogs };
  }

  private static async getAppCounts(query: MongoQuery, userAppIds: string[]): Promise<ApplicationCount[]> {
    // Import Application model
    const Application = (await import('../models/Application.model')).default;

    const userAppObjectIds = userAppIds.map(id => new mongoose.Types.ObjectId(id));

    // Single aggregation that joins applications with log counts
    const results = await Application.aggregate([
      {
        $match: {
          _id: { $in: userAppObjectIds },
          active: true,
          deleted: false
        }
      },
      {
        $lookup: {
          from: 'logs',
          let: { appId: '$_id' },
          pipeline: [
            {
              $match: {
                ...query,
                $expr: { $eq: ['$sourceApp', '$$appId'] }
              }
            },
            { $count: 'count' }
          ],
          as: 'logData'
        }
      },
      {
        $project: {
          _id: { $toString: '$_id' },
          applicationName: '$name',
          count: { $ifNull: [{ $arrayElemAt: ['$logData.count', 0] }, 0] }
        }
      },
      { $sort: { applicationName: 1 } }
    ]);

    return results;
  }

  private static async getVolumeTrend(
    query: MongoQuery,
    granularity: string,
    from: Date,
    to: Date
  ): Promise<VolumeDataPoint[]> {
    const groupFields = this.getGroupFields(granularity);

    const results = await Log.aggregate([
      { $match: query },
      { $group: { _id: groupFields, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.minute': 1 } }
    ]);

    // Map results by formatted ID
    const dataMap = new Map<string, number>();
    results.forEach(item => {
      const id = this.formatId(item._id, granularity);
      dataMap.set(id, item.count);
    });

    // Generate all time intervals
    return this.generateIntervals(from, to, granularity)
      .map(({ id, timestamp }) => ({
        _id: id,
        count: dataMap.get(id) || 0,
        timestamp
      }));
  }

  private static getGroupFields(granularity: string): Record<string, Record<string, Record<string, string>>> {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const base = { date: '$time', timezone };

    const fields: Record<string, Record<string, Record<string, string>>> = {
      year: { $year: base },
      month: { $month: base },
      day: { $dayOfMonth: base }
    };

    if (granularity === 'hour' || granularity === 'minute') {
      fields.hour = { $hour: base };
    }

    if (granularity === 'minute') {
      fields.minute = { $minute: base };
    }

    return fields;
  }

  private static formatId(groupId: Record<string, number>, granularity: string): string {
    const parts = [groupId.year.toString()];

    if (granularity !== 'year') {
      parts.push(groupId.month.toString().padStart(2, '0'));
      parts.push(groupId.day.toString().padStart(2, '0'));
    }

    if (granularity === 'hour' || granularity === 'minute') {
      parts.push(groupId.hour.toString().padStart(2, '0'));
    }

    if (granularity === 'minute') {
      parts.push(groupId.minute.toString().padStart(2, '0'));
    }

    return parts.join('-');
  }

  private static generateIntervals(from: Date, to: Date, granularity: string): Array<{ id: string; timestamp: Date }> {
    const intervals: Array<{ id: string; timestamp: Date }> = [];
    const current = new Date(from.getTime());

    // Normalize to granularity boundary
    if (granularity === 'minute') current.setSeconds(0, 0);
    if (granularity === 'hour') current.setMinutes(0, 0, 0);
    if (granularity === 'day') current.setHours(0, 0, 0, 0);

    while (current <= to) {
      // Create timestamp in local timezone
      const timestamp = new Date(current);
      const id = this.createId(timestamp, granularity);

      intervals.push({ id, timestamp });

      // Increment by granularity
      if (granularity === 'minute') current.setMinutes(current.getMinutes() + 1);
      else if (granularity === 'hour') current.setHours(current.getHours() + 1);
      else current.setDate(current.getDate() + 1);
    }

    return intervals;
  }

  private static createId(date: Date, granularity: string): string {
    const parts = [date.getFullYear().toString()];

    if (granularity !== 'year') {
      parts.push((date.getMonth() + 1).toString().padStart(2, '0'));
      parts.push(date.getDate().toString().padStart(2, '0'));
    }

    if (granularity === 'hour' || granularity === 'minute') {
      parts.push(date.getHours().toString().padStart(2, '0'));
    }

    if (granularity === 'minute') {
      parts.push(date.getMinutes().toString().padStart(2, '0'));
    }

    return parts.join('-');
  }
}

export default AnalyticsService;