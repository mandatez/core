import type { AgentEvent } from '../events/schema.js';
import type { EventExporter } from './index.js';

export interface DatadogExporterConfig {
  /** Datadog API key (DD-API-KEY). Required. */
  apiKey: string;
  /**
   * Datadog site. Defaults to 'datadoghq.com'. Use 'datadoghq.eu' for EU,
   * 'us3.datadoghq.com' / 'us5.datadoghq.com' / 'ap1.datadoghq.com' for
   * other regions, or 'ddog-gov.com' for government.
   */
  site?: string;
  /** Log service field — defaults to 'mandatez'. */
  service?: string;
  /** Log source field — defaults to 'mandatez-sdk'. */
  source?: string;
  /** Additional Datadog tags merged into every event. */
  tags?: string[];
}

/**
 * Ships MandateZ AgentEvents to Datadog Logs via the v2 HTTP intake.
 *
 * @see https://docs.datadoghq.com/api/latest/logs/#send-logs
 */
export class DatadogExporter implements EventExporter {
  readonly name = 'datadog';
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly service: string;
  private readonly source: string;
  private readonly tags: string[];

  constructor(config: DatadogExporterConfig) {
    if (!config.apiKey) {
      throw new Error('DatadogExporter: apiKey is required');
    }
    const site = (config.site ?? 'datadoghq.com').replace(/^https?:\/\//, '').replace(/\/+$/, '');
    this.endpoint = `https://http-intake.logs.${site}/api/v2/logs`;
    this.apiKey = config.apiKey;
    this.service = config.service ?? 'mandatez';
    this.source = config.source ?? 'mandatez-sdk';
    this.tags = config.tags ?? [];
  }

  async export(event: AgentEvent): Promise<void> {
    const tags = [
      `agent_id:${event.agent_id}`,
      `owner_id:${event.owner_id}`,
      `outcome:${event.outcome}`,
      `action_type:${event.action_type}`,
      ...this.tags,
    ].join(',');

    const payload = [
      {
        ddsource: this.source,
        ddtags: tags,
        hostname: 'mandatez-sdk',
        service: this.service,
        status: event.outcome === 'blocked' ? 'error' : event.outcome === 'flagged' ? 'warn' : 'info',
        message: `[MandateZ] ${event.action_type} ${event.resource} → ${event.outcome}`,
        timestamp: event.timestamp,
        mandatez: {
          event_id: event.event_id,
          agent_id: event.agent_id,
          owner_id: event.owner_id,
          action_type: event.action_type,
          resource: event.resource,
          outcome: event.outcome,
          policy_id: event.policy_id,
          signature: event.signature,
          public_key: event.public_key,
          metadata: event.metadata,
        },
      },
    ];

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`DatadogExporter: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
  }
}
