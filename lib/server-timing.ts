type ServerTimingMetric = {
  name: string;
  durationMs: number;
};

const sanitizeMetricName = (name: string): string => name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "metric";

export const createServerTimer = () => {
  const metrics: ServerTimingMetric[] = [];

  const measure = async <T>(name: string, action: () => Promise<T>): Promise<T> => {
    const startedAt = performance.now();
    try {
      return await action();
    } finally {
      metrics.push({
        name: sanitizeMetricName(name),
        durationMs: performance.now() - startedAt
      });
    }
  };

  const headerValue = (): string =>
    metrics
      .map((metric) => `${metric.name};dur=${Math.max(0, metric.durationMs).toFixed(1)}`)
      .join(", ");

  return {
    measure,
    headerValue
  };
};

export const applyServerTiming = (response: Response, headerValue: string): Response => {
  if (headerValue) {
    response.headers.set("Server-Timing", headerValue);
  }

  return response;
};
