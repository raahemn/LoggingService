/**
 * @license
 * Copyright (c) 2014, 2025, Oracle and/or its affiliates.
 * Licensed under The Universal Permissive License (UPL), Version 1.0
 * as shown at https://oss.oracle.com/licenses/upl/
 * @ignore
 */
import { h } from "preact";

type Log = {
  _id: string;
  message: string;
  log_level: string;
  trace_id: string;
  time: string;
};

type Props = {
  logs: Log[];
};

export function Content({ logs }: Props) {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Logs</h1>
      <ul>
        {logs.map((log) => (
          <li key={log._id}>
            <strong>[{log.log_level}]</strong> {log.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
