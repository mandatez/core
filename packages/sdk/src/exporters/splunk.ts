import type { AgentEvent } from '../events/schema.js';
import type { EventExporter } from './index.js';

export interface SplunkExporterConfig {
  /**
   * Base URL of your Splunk HTTP Event Collector, without the
   * /services/collector path. Example: https://splunk.acme.com:8088
   */
  hecUrl: string;
  /** HEC token, sent as `Authorization: Splunk <token>`. */
  token: string;
  /** Splunk source field — defaults to 'mandatez'. */
  source?: string;
  /** Splunk sourcetype — defaults to 'mandatez:event'. */
  sourcetype?: string;
  /** Splunk index — defaults to 'main'. */
  index?: string;
}

/**
 * Ships MandateZ AgentEvents to Splunk via HTTP Event Collector.
 *
 * @see https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector
 */
export class SplunkExporter implements EventExporter {
  readonly name = 'splunk';
  private readonly endpoint: string;
  private readonly token: string;
  private readonly source: string;
  private readonly sourcetype: string;
  private readonly index: string;

  constructor(config: SplunkExporterConfig) {
    if (!config.hecUrl) {
      throw new Error('SplunkExporter: hecUrl is required');
    }
    if (!config.token) {
      throw new Error('SplunkExporter: token is required');
    }
    const base = config.hecUrl.replace(/\/+$/, '');
    this.endpoint = `${base}/services/collector/event`;
    this.token = config.token;
    this.source = config.source ?? 'mandatez';
    this.sourcetype = config.sourcetype ?? 'mandatez:event';
    this.index = config.index ?? 'main';
  }

  async export(event: AgentEvent): Promise<void> {
    const payload = {
      time: Math.floor(new Date(event.timestamp).getTime() / 1000),
      host: 'mandatez-sdk',
      source: this.source,
      sourcetype: this.sourcetype,
      index: this.index,
      event: {
        event_id: event.event_id,
        agent_id: event.agent_id,
        owner_id: event.owner_id,
        timestamp: event.timestamp,
        action_type: event.action_type,
        resource: event.resource,
        outcome: event.outcome,
        policy_id: event.policy_id,
        signature: event.signature,
        public_key: event.public_key,
        metadata: event.metadata,
      },
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Splunk ${this.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`SplunkExporter: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
  }
}
