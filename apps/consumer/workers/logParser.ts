export function parseLogLine(line: string) {
  // New format: [timestamp] [log_level] [trace_id] message
  // Example: [2025-06-24T10:13:19.975Z] [ERROR] [mcadatpj8molqcfa6zb] This is a ERROR log message
  const regex = /^\[(.*?)\] \[(.*?)\] \[(.*?)\] (.*)$/;
  const match = line.match(regex);
  if (!match) return null;
  return {
    time: new Date(match[1]),
    log_level: match[2],
    trace_id: match[3],
    message: match[4],
  };
}