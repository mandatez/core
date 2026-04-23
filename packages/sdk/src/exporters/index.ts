import type { AgentEvent } from '../events/schema.js';

/**
 * Pluggable destination for signed AgentEvents beyond the MandateZ
 * event stream itself. Implementations fan events out to SIEMs,
 * observability platforms, or custom webhooks.
 *
 * Implementations must treat export() as fire-and-forget — the
 * MandateZClient never awaits the result on the hot path, and any
 * thrown error is swallowed and logged. Do not rely on exporters for
 * ordering or delivery guarantees; they are best-effort fan-out.
 */
export interface EventExporter {
  /** Human-readable name used for error logging. */
  name: string;
  /** Ship a single signed event to the underlying destination. */
  export(event: AgentEvent): Promise<void>;
}

export { DatadogExporter } from './datadog.js';
export type { DatadogExporterConfig } from './datadog.js';

export { SplunkExporter } from './splunk.js';
export type { SplunkExporterConfig } from './splunk.js';

export { WebhookExporter } from './webhook.js';
export type { WebhookExporterConfig } from './webhook.js';

export { OpenTelemetryExporter } from './otel.js';
export type { OpenTelemetryExporterConfig } from './otel.js';
