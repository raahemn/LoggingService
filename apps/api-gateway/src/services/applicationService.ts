import mongoose from 'mongoose';
import Application, { IApplication } from '../models/Application.model';
import Group from '../models/Group.model';

export const getAllApplications = async (
  userId: string,
  page: number = 1,
  limit: number = 25,
  active?: boolean,
  search?: string,
  sortBy: string = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): Promise<{
  applications: any[];
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
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const skip = (page - 1) * limit;

    const sortObj: any = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    sortObj[sortBy] = sortDirection;

    // Single optimized aggregation pipeline that combines everything
    const pipeline: any[] = [
      // Stage 1: Get user's accessible applications through groups
      {
        $lookup: {
          from: 'groups',
          let: { userId: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$$userId', '$memberIDs'] },
                    { $eq: ['$active', true] },
                    { $eq: ['$deleted', false] }
                  ]
                }
              }
            },
            { $unwind: '$applicationIDs' },
            { $group: { _id: null, appIds: { $addToSet: '$applicationIDs' } } }
          ],
          as: 'userAccess'
        }
      },
      
      // Stage 2: Filter applications based on user access and other criteria
      {
        $match: {
          deleted: false,
          $expr: {
            $cond: {
              if: { $gt: [{ $size: '$userAccess' }, 0] },
              then: { $in: ['$_id', { $arrayElemAt: ['$userAccess.appIds', 0] }] },
              else: false
            }
          },
          ...(active !== undefined && { active }),
          ...(search && {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { description: { $regex: search, $options: 'i' } }
            ]
          })
        }
      },

      // Stage 3: Add log statistics using lookup
      {
        $lookup: {
          from: 'logs',
          let: { appId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$sourceApp', '$$appId'] },
                    { $gte: ['$time', twentyFourHoursAgo] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                totalLogs: { $sum: 1 },
                errorLogs: {
                  $sum: {
                    $cond: [{ $eq: ['$logLevel', 'ERROR'] }, 1, 0]
                  }
                }
              }
            }
          ],
          as: 'logStats'
        }
      },

      // Stage 4: Add computed fields
      {
        $addFields: {
          logsToday: { $ifNull: [{ $arrayElemAt: ['$logStats.totalLogs', 0] }, 0] },
          errorsToday: { $ifNull: [{ $arrayElemAt: ['$logStats.errorLogs', 0] }, 0] }
        }
      },

      // Stage 5: Remove unnecessary fields
      {
        $project: {
          userAccess: 0,
          logStats: 0
        }
      },

      // Stage 6: Sort results
      { $sort: sortObj },

      // Stage 7: Facet for pagination
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ];

    const [result] = await Application.aggregate(pipeline);
    
    const applications = result.data || [];
    const totalCount = result.totalCount[0]?.count || 0;
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
      applications,
      pagination
    };
  } catch (error) {
    console.error('Error in getAllApplications:', error);
    throw new Error('Failed to fetch applications with log stats.');
  }
};

export const getApplicationNames = async (
  userId: string,
  active?: boolean,
  sortBy: string = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): Promise<{ value: string; label: string }[]> => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const sortObj: any = {};
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    sortObj[sortBy] = sortDirection;

    // Single aggregation pipeline that combines user access check and application fetch
    const pipeline: any[] = [
      // Stage 1: Get user's accessible applications through groups
      {
        $lookup: {
          from: 'groups',
          let: { userId: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$$userId', '$memberIDs'] },
                    { $eq: ['$active', true] },
                    { $eq: ['$deleted', false] }
                  ]
                }
              }
            },
            { $unwind: '$applicationIDs' },
            { $group: { _id: null, appIds: { $addToSet: '$applicationIDs' } } }
          ],
          as: 'userAccess'
        }
      },
      
      // Stage 2: Filter applications based on user access and criteria
      {
        $match: {
          deleted: false,
          $expr: {
            $cond: {
              if: { $gt: [{ $size: '$userAccess' }, 0] },
              then: { $in: ['$_id', { $arrayElemAt: ['$userAccess.appIds', 0] }] },
              else: false
            }
          },
          ...(active !== undefined && { active })
        }
      },

      // Stage 3: Project only needed fields
      {
        $project: {
          _id: 1,
          name: 1
        }
      },

      // Stage 4: Sort results
      { $sort: sortObj },

      // Stage 5: Transform to desired format
      {
        $project: {
          value: { $toString: '$_id' },
          label: '$name'
        }
      }
    ];

    const applications = await Application.aggregate(pipeline);
    return applications;
  } catch (error) {
    console.error('Error in getApplicationNames:', error);
    throw new Error('Failed to fetch application names.');
  }
};

export const getApplications = async (): Promise<IApplication[]> => {
  try {
    return await Application.find({ deleted: false }).sort({ name: 1 });
  } catch (error) {
    console.error('Error in getApplications:', error);
    throw new Error('Failed to fetch applications.');
  }
};

export const createApplication = async (data: Partial<IApplication>): Promise<IApplication> => {
  try {
    const existingApp = await Application.findOne({ name: data.name, deleted: false });
    if (existingApp) {
      throw new Error(`Application with name "${data.name}" already exists.`);
    }

    const application = new Application(data);
    await application.save();

    // Add applicationID to Administrators group
    await Group.findOneAndUpdate(
      { name: 'Administrators', deleted: false },
      { $push: { applicationIDs: application._id } },
      { new: true }
    );
    return application;

  } catch (error: any) {
    console.error('Error in createApplication:', error);
    throw error;
  }
};

export const updateApplication = async (
  id: string,
  updates: { name?: string; description?: string, active?: boolean }
) => {
  try {
    if (updates.name) {
      const existingApp = await Application.findOne({ 
        name: updates.name, 
        deleted: false,
        _id: { $ne: id }
      });
      if (existingApp) {
        throw new Error(`Application with name "${updates.name}" already exists.`);
      }
    }

    const updatedApp = await Application.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedApp) {
      throw new Error('Application not found');
    }

    return updatedApp;
  } catch (error: any) {
    if (error.code === 11000 && error.keyPattern?.name) {
      throw new Error(`Application with this name already exists.`);
    }

    console.error('Error in updateApplication:', error);
    throw error;
  }
};

export const deleteApplication = async (id: string) => {
  try {
    const application = await Application.findByIdAndUpdate(
      id,
      { deleted: true, active: false },
      { new: true }
    );

    if (!application) {
      throw new Error('Application not found');
    }

    return application;
  } catch (error) {
    console.error('Error in deleteApplication:', error);
    throw new Error('Failed to delete application: ' + error);
  }
};

export const updateThresholdAndTimePeriod = async (
  id: string,
  data: { threshold: number; time_period: number }
) => {
  try {
    const updatedApp = await Application.findByIdAndUpdate(
      id,
      {
        threshold: data.threshold,
        time_period: data.time_period,
      },
      { new: true }
    );

    if (!updatedApp) {
      throw new Error('Application not found');
    }

    return updatedApp;
  } catch (error) {
    console.error('Error in updateThresholdAndTimePeriod:', error);
    throw new Error('Failed to update threshold and time period.');
  }
};