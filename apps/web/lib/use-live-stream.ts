"use client";

import { useEffect, useState, useCallback } from "react";

export interface LiveMetrics {
  activeRuns: number;
  pendingApprovals: number;
  browserTasks: number;
  connectedAgents: number;
}

export interface LiveSnapshot {
  ts: number;
  metrics: LiveMetrics;
  runs: unknown[];
  approvals: unknown[];
  browserTasks: unknown[];
  agents: unknown[];
}

export function useLiveStream() {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    const eventSource = new EventSource("/api/stream");

    eventSource.addEventListener("connected", () => {
      setConnected(true);
      setError(null);
    });

    eventSource.addEventListener("snapshot", (event) => {
      try {
        const data = JSON.parse(event.data) as LiveSnapshot;
        setSnapshot(data);
      } catch {
        // ignore parse errors
      }
    });

    eventSource.addEventListener("error", () => {
      setConnected(false);
      setError("Connection lost");
    });

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    return eventSource;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);

  return { connected, snapshot, error };
}
