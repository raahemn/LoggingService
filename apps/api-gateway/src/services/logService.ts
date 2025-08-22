import mongoose from "mongoose";
import { ILog, Log } from "../models/Log.model";
import Group from '../models/Group.model';

interface LogFilters {
  applications?: string[];
  logLevels?: string[];
  fromDate?: Date;
  toDate?: Date;
  search?: string;
}

export const getNewLogs = async (since: Date): Promise<ILog[]> => {
  return await Log.find({ time: { $gt: since } }).sort({ time: 1 });
};

export const getLogs = async (
  userId: string, 
  since: Date,
  page: number = 1,
  limit: number = 25,
  filters?: LogFilters,
  sortBy: string = 'time',
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<{
  logs: ILog[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
}> => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const skip = (page - 1) * limit;
    
    const sortObj: any = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    
    const fieldMapping: { [key: string]: string } = {
      'timestamp': 'time',
      'logLevel': 'logLevel',
      'sourceApp': 'sourceAppName',
      'traceId': 'traceId',
      'message': 'message',
      'time': 'time'
    };

    const backendField = fieldMapping[sortBy] || 'time';
    sortObj[backendField] = sortDirection;

    const logMatchConditions: any = {
      $expr: {
        $and: [
          { $in: ["$sourceApp", "$$appIds"] },
          { $gt: ["$time", since] }
        ]
      }
    };

    if (filters?.fromDate) {
      logMatchConditions.$expr.$and.push({ $gte: ["$time", filters.fromDate] });
    }
    if (filters?.toDate) {
      logMatchConditions.$expr.$and.push({ $lte: ["$time", filters.toDate] });
    }

    if (filters?.applications && filters.applications.length > 0) {
      const appObjectIds = filters.applications.map(id => new mongoose.Types.ObjectId(id));
      logMatchConditions.sourceApp = { $in: appObjectIds };
    }

    if (filters?.logLevels && filters.logLevels.length > 0) {
      logMatchConditions.logLevel = { $in: filters.logLevels };
    }

    if (filters?.search) {
      if (filters.search.split(' ').length > 1) {
        logMatchConditions.$text = { $search: filters.search };
      } else {
        logMatchConditions.$or = [
          { message: { $regex: filters.search, $options: 'i' } },
          { traceId: { $regex: filters.search, $options: 'i' } }
        ];
      }
    }

    const pipeline: any[] = [
      // Stage 1: Get user's accessible applications
      {
        $match: {
          memberIDs: userObjectId,
          active: true,
          deleted: false
        }
      },
      { $unwind: "$applicationIDs" },
      { $group: { _id: null, applicationIds: { $addToSet: "$applicationIDs" } } },
      
      // Stage 2: Lookup logs with all filters applied
      {
        $lookup: {
          from: "logs",
          let: { appIds: "$applicationIds" },
          pipeline: [
            { $match: logMatchConditions },
            
            // Lookup application details
            {
              $lookup: {
                from: "applications",
                localField: "sourceApp",
                foreignField: "_id",
                as: "applicationDetails",
                pipeline: [{ $project: { name: 1 } }] // Only get name field
              }
            },
            
            // Add application name
            {
              $addFields: {
                sourceAppName: {
                  $ifNull: [
                    { $arrayElemAt: ["$applicationDetails.name", 0] },
                    "Unknown Application"
                  ]
                }
              }
            },
            
            // Sort logs
            { $sort: sortObj },
            
            // Clean up fields
            {
              $project: {
                applicationDetails: 0
              }
            }
          ],
          as: "logs"
        }
      },
      
      // Stage 3: Facet for pagination
      {
        $facet: {
          data: [
            { $unwind: "$logs" },
            { $replaceRoot: { newRoot: "$logs" } },
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [
            { $unwind: "$logs" },
            { $count: "count" }
          ]
        }
      }
    ];

    const [result] = await Group.aggregate(pipeline);
    
    const logs = result?.data || [];
    const totalCount = result?.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);
    
    const pagination = {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      limit
    };
    
    return {
      logs: logs as ILog[],
      pagination
    };
    
  } catch (error) {
    console.error('Error fetching logs for user with aggregation:', error);
    throw error;
  }
};

export const getLogStats = async (
  userId: string,
  filters?: {
    fromDate?: Date;
    toDate?: Date;
    applications?: string[];
  }
): Promise<{
  totalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
}> => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // Build match conditions
    const logMatchConditions: any = {
      $expr: {
        $and: [{ $in: ["$sourceApp", "$$appIds"] }]
      }
    };

    // Add time filters
    if (filters?.fromDate) {
      logMatchConditions.$expr.$and.push({ $gte: ["$time", filters.fromDate] });
    }
    if (filters?.toDate) {
      logMatchConditions.$expr.$and.push({ $lte: ["$time", filters.toDate] });
    }

    // Add application filter
    if (filters?.applications && filters.applications.length > 0) {
      const appObjectIds = filters.applications.map(id => new mongoose.Types.ObjectId(id));
      logMatchConditions.sourceApp = { $in: appObjectIds };
    }

    const pipeline = [
      // Stage 1: Get user's accessible applications
      {
        $match: {
          memberIDs: userObjectId,
          active: true,
          deleted: false
        }
      },
      { $unwind: "$applicationIDs" },
      { $group: { _id: null, applicationIds: { $addToSet: "$applicationIDs" } } },
      
      // Stage 2: Get log statistics
      {
        $lookup: {
          from: "logs",
          let: { appIds: "$applicationIds" },
          pipeline: [
            { $match: logMatchConditions },
            {
              $group: {
                _id: null,
                totalCount: { $sum: 1 },
                errorCount: {
                  $sum: { $cond: [{ $eq: ["$logLevel", "ERROR"] }, 1, 0] }
                },
                warningCount: {
                  $sum: { $cond: [{ $eq: ["$logLevel", "WARNING"] }, 1, 0] }
                },
                infoCount: {
                  $sum: { $cond: [{ $eq: ["$logLevel", "INFO"] }, 1, 0] }
                },
                debugCount: {
                  $sum: { $cond: [{ $eq: ["$logLevel", "DEBUG"] }, 1, 0] }
                }
              }
            }
          ],
          as: "stats"
        }
      },
      
      // Stage 3: Project final result
      {
        $project: {
          totalCount: { $ifNull: [{ $arrayElemAt: ["$stats.totalCount", 0] }, 0] },
          errorCount: { $ifNull: [{ $arrayElemAt: ["$stats.errorCount", 0] }, 0] },
          warningCount: { $ifNull: [{ $arrayElemAt: ["$stats.warningCount", 0] }, 0] },
          infoCount: { $ifNull: [{ $arrayElemAt: ["$stats.infoCount", 0] }, 0] },
          debugCount: { $ifNull: [{ $arrayElemAt: ["$stats.debugCount", 0] }, 0] }
        }
      }
    ];

    const [result] = await Group.aggregate(pipeline);
    
    return {
      totalCount: result?.totalCount || 0,
      errorCount: result?.errorCount || 0,
      warningCount: result?.warningCount || 0,
      infoCount: result?.infoCount || 0,
      debugCount: result?.debugCount || 0
    };
    
  } catch (error) {
    console.error('Error fetching log stats for user:', error);
    throw error;
  }
};

export const getAllLogs = async (
  userId: string, 
  since: Date,
  filters?: LogFilters
): Promise<ILog[]> => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    const logMatchConditions: any = {
      $expr: {
        $and: [
          { $in: ["$sourceApp", "$appIds"] },
          { $gt: ["$time", since] }
        ]
      }
    };

    if (filters?.fromDate) {
      logMatchConditions.$expr.$and.push({ $gte: ["$time", filters.fromDate] });
    }
    if (filters?.toDate) {
      logMatchConditions.$expr.$and.push({ $lte: ["$time", filters.toDate] });
    }

    if (filters?.applications && filters.applications.length > 0) {
      const appObjectIds = filters.applications.map(id => new mongoose.Types.ObjectId(id));
      logMatchConditions.sourceApp = { $in: appObjectIds };
    }

    if (filters?.logLevels && filters.logLevels.length > 0) {
      logMatchConditions.logLevel = { $in: filters.logLevels };
    }

    const lookupPipeline: any[] = [
      { $match: logMatchConditions },
      { $sort: { time: -1 } },
      
      // Lookup application details
      {
        $lookup: {
          from: "applications",
          localField: "sourceApp",
          foreignField: "_id",
          as: "applicationDetails",
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      
      // Add application name
      {
        $addFields: {
          sourceAppName: {
            $ifNull: [
              { $arrayElemAt: ["$applicationDetails.name", 0] },
              "Unknown Application"
            ]
          }
        }
      },
      
      // Clean up fields
      {
        $project: {
          applicationDetails: 0
        }
      }
    ];

    const pipeline: mongoose.PipelineStage[] = [
      // Stage 1: Get user's accessible applications
      {
        $match: {
          memberIDs: userObjectId,
          active: true,
          deleted: false
        }
      },
      { $unwind: "$applicationIDs" },
      { $group: { _id: null, applicationIds: { $addToSet: "$applicationIDs" } } },
      
      // Stage 2: Get all matching logs
      {
        $lookup: {
          from: "logs",
          let: { appIds: "$applicationIds" },
          pipeline: lookupPipeline,
          as: "logs"
        }
      },
      
      // Stage 3: Flatten results
      { $unwind: "$logs" },
      { $replaceRoot: { newRoot: "$logs" } }
    ];

    const result = await Group.aggregate(pipeline);
    return result as ILog[];
    
  } catch (error) {
    console.error('Error fetching all logs for user:', error);
    throw error;
  }
};