import type { AgentEvent } from '../events/schema.js';
import type { EventExporter } from './index.js';

export interface WebhookExporterConfig {
  /** Destination URL. Must be HTTPS in production. */
  url: string;
  /**
   * Optional shared-secret header. Sent as `Authorization: Bearer <secret>`.
   * Use this to authenticate the webhook on the receiver side.
   */
  secret?: string;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number;
}

/**
 * Generic POST-an-AgentEvent-to-a-URL exporter. Handy for wiring
 * MandateZ into any SIEM, log pipeline, or internal webhook queue
 * that can accept JSON over HTTPS.
 *
 * Payload shape is the full AgentEvent — never modify or rename
 * fields, this is the canonical cross-vendor envelope.
 */
export class WebhookExporter implements EventExporter {
  readonly name = 'webhook';
  private readonly url: string;
  private readonly secret?: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(config: WebhookExporterConfig) {
    if (!config.url) {
      throw new Error('WebhookExporter: url is required');
    }
    this.url = config.url;
    this.secret = config.secret;
    this.headers = config.headers ?? {};
    this.timeoutMs = config.timeoutMs ?? 5000;
  }

  async export(event: AgentEvent): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'mandatez-sdk/webhook-exporter',
      ...this.headers,
    };
    if (this.secret) {
      headers.Authorization = `Bearer ${this.secret}`;
    }

    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`WebhookExporter: HTTP ${res.status} ${body.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
