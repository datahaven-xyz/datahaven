import { Counter, Gauge, Histogram, Registry } from "prom-client";

const PREFIX = "validator_set_submitter_";

export const registry = new Registry();

// --- Counters ---

export const submissionsTotal = new Counter({
  name: `${PREFIX}submissions_total`,
  help: "Total submission attempts and results",
  labelNames: ["outcome"] as const,
  registers: [registry]
});

export const ticksTotal = new Counter({
  name: `${PREFIX}ticks_total`,
  help: "Total tick evaluations",
  labelNames: ["result"] as const,
  registers: [registry]
});

export const errorsTotal = new Counter({
  name: `${PREFIX}errors_total`,
  help: "Non-submission errors",
  labelNames: ["type"] as const,
  registers: [registry]
});

export const missedErasTotal = new Counter({
  name: `${PREFIX}missed_eras_total`,
  help: "Total eras where a submission attempt failed",
  registers: [registry]
});

// --- Gauges ---

export const activeEra = new Gauge({
  name: `${PREFIX}active_era`,
  help: "Current active era on DataHaven",
  registers: [registry]
});

export const targetEra = new Gauge({
  name: `${PREFIX}target_era`,
  help: "Target era for next submission",
  registers: [registry]
});

export const externalIndex = new Gauge({
  name: `${PREFIX}external_index`,
  help: "Latest confirmed era on-chain",
  registers: [registry]
});

export const currentSession = new Gauge({
  name: `${PREFIX}current_session`,
  help: "Current session number",
  registers: [registry]
});

export const lastSubmittedEra = new Gauge({
  name: `${PREFIX}last_submitted_era`,
  help: "Last era successfully submitted",
  registers: [registry]
});

export const consecutiveMissedEras = new Gauge({
  name: `${PREFIX}consecutive_missed_eras`,
  help: "Consecutive eras missed (resets to 0 on success)",
  registers: [registry]
});

export const up = new Gauge({
  name: `${PREFIX}up`,
  help: "1 if watcher is running, 0 if stopped",
  registers: [registry]
});

export const ready = new Gauge({
  name: `${PREFIX}ready`,
  help: "1 if startup checks passed and watcher running, 0 otherwise",
  registers: [registry]
});

// --- Histograms ---

export const submissionDuration = new Histogram({
  name: `${PREFIX}submission_duration_seconds`,
  help: "Time from tx send to receipt",
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [registry]
});

export const tickDuration = new Histogram({
  name: `${PREFIX}tick_duration_seconds`,
  help: "Time to process one tick",
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [registry]
});

// --- HTTP Server ---

export function createMetricsServer(port: number) {
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/metrics") {
        const metrics = await registry.metrics();
        return new Response(metrics, {
          headers: { "Content-Type": registry.contentType }
        });
      }

      if (url.pathname === "/healthz") {
        return new Response("ok\n", { status: 200 });
      }

      if (url.pathname === "/readyz") {
        const isReady = (await ready.get()).values[0]?.value === 1;
        if (isReady) {
          return new Response("ready\n", { status: 200 });
        }
        return new Response("not ready\n", { status: 503 });
      }

      return new Response("Not Found\n", { status: 404 });
    }
  });

  return server;
}
