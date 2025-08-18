
import { Worker, Job } from "bullmq";
import mongoose from "mongoose";
import Log from "./logSchema";
import { parseLogLine } from "./logParser";

// Connect to MongoDB (use your connection string)
const mongoUrl = process.env.MONGODB_URL;
if (!mongoUrl) {
  throw new Error("MONGODB_URL environment variable is not set");
}
mongoose.connect(mongoUrl)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Redis connection options
const redisConnection = {
  host: "redis",
  port: 6379,
};

export const worker = new Worker(
  "log_queue",
  async (job: Job) => {
    let parsed: any;

    // If job.data is a string, try to parse as JSON, else parse as log line
    if (typeof job.data === "string") {
      try {
        const asJson = JSON.parse(job.data);
        parsed = asJson;
      } catch {
        parsed = parseLogLine(job.data);
      }
    } else if (typeof job.data === "object" && job.data !== null) {
      parsed = job.data;
    }

    if (parsed) {

      // Create log entry according to the schema
      const logEntry = {
        message: parsed.message || parsed.log_message || "",
        logLevel: parsed.logLevel || parsed.log_level || parsed.level || "INFO",
        traceId: parsed.traceId || parsed.trace_id || "",
        sourceApp: parsed.sourceApp || parsed.source_app || "unknown",
        date: parsed.timestamp || new Date(),
      };

      await Log.create(logEntry);
      
    } else {
      console.warn(`Could not parse log: ${JSON.stringify(job.data)}`);
    }
  },
  { connection: redisConnection }
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed.`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed: ${err.message}`);
});