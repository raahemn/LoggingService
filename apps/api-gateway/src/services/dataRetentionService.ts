import mongoose from 'mongoose';
import DRP from '../models/DRP.model';
import logger from '../config/logger';

// Data retention debug logger
const retentionDebugger = logger.withTraceId('RETENTION');

class LogRetentionService {
  private readonly COLLECTION_NAME = 'logs';
  private readonly DATE_FIELD = 'time';

  /**
   * Initialize TTL index for logs collection
   */
  async initializeLogRetention(): Promise<void> {
    try {
      const drp = await DRP.findOne();
      const retentionDays = drp?.dataRetentionPeriod || 30;
      
      await this.setLogTTL(retentionDays);
      retentionDebugger.info(`✅ Log retention initialized: ${retentionDays} days`);
    } catch (error) {
      retentionDebugger.error('❌ Error initializing log retention:', error);
    }
  }

  /**
   * Update TTL index when DRP changes
   */
  async updateLogRetention(retentionDays: number): Promise<void> {
    try {
      await this.setLogTTL(retentionDays);
      retentionDebugger.info(`✅ Log retention updated: ${retentionDays} days`);
    } catch (error) {
      retentionDebugger.error('❌ Error updating log retention:', error);
      throw error;
    }
  }

  /**
   * Set TTL index on logs collection
   */
  private async setLogTTL(retentionDays: number): Promise<void> {
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }

    const collection = mongoose.connection.db.collection(this.COLLECTION_NAME);
    const expireAfterSeconds = retentionDays * 24 * 60 * 60;

    try {
      await mongoose.connection.db.command({
        collMod: this.COLLECTION_NAME,
        index: {
          keyPattern: { [this.DATE_FIELD]: 1 },
          expireAfterSeconds: expireAfterSeconds
        }
      });
    } catch (error) {
      try {
        await collection.createIndex(
          { [this.DATE_FIELD]: 1 },
          { 
            expireAfterSeconds,
            name: 'log_ttl_index',
            background: true 
          }
        );
      } catch (createError) {
        console.error('Failed to create TTL index:', createError);
        throw createError;
      }
    }
  }
}

export const logRetentionService = new LogRetentionService();