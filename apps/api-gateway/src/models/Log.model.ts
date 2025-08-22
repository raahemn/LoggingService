import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILog extends Document {
  message: string;
  logLevel: string;
  traceId: string;
  sourceApp: mongoose.Types.ObjectId;
  time: Date;
}

const logSchema: Schema<ILog> = new Schema(
  {
    message: {
      type: String,
      required: true,
    },
    logLevel: {
      type: String,
      required: true,
      enum: ['INFO', 'WARNING', 'ERROR', 'DEBUG'],
    },
    traceId: {
      type: String,
      required: true,
    },
    sourceApp: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    time: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Optimized indexes based on actual query patterns in services
logSchema.index({ time: -1, sourceApp: 1 }); // Primary index for time-based queries with app filtering
logSchema.index({ sourceApp: 1, time: -1, logLevel: 1 }); // For app-specific queries with level filtering
logSchema.index({ message: 'text', logLevel: 'text' }); // Text search index for search functionality

export const Log: Model<ILog> = mongoose.model<ILog>('Log', logSchema);