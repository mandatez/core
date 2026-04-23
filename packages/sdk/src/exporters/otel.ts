import type { AgentEvent } from '../events/schema.js';
import type { EventExporter } from './index.js';
import { randomBytes } from 'node:crypto';

export interface OpenTelemetryExporterConfig {
  /**
   * OTLP/HTTP endpoint. The /v1/traces path is appended automatically
   * if missing. Example: http://otel-collector:4318
   */
  endpoint: string;
  /** OTel service.name resource attribute. Defaults to 'mandatez'. */
  serviceName?: string;
  /** Extra resource attributes merged into every export. */
  resourceAttributes?: Record<string, string>;
  /** Optional headers (Authorization, x-honeycomb-team, etc.). */
  headers?: Record<string, string>;
}

type AnyValue =
  | { stringValue: string }
  | { intValue: number }
  | { boolValue: boolean }
  | { doubleValue: number };

interface KeyValue {
  key: string;
  value: AnyValue;
}

function anyValue(v: unknown): AnyValue {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { boolValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { intValue: v } : { doubleValue: v };
  }
  return { stringValue: JSON.stringify(v) };
}

function toAttrs(obj: Record<string, unknown>): KeyValue[] {
  return Object.entries(obj).map(([key, value]) => ({ key, value: anyValue(value) }));
}

/**
 * Formats MandateZ AgentEvents as OTLP/HTTP spans and ships them to any
 * OpenTelemetry Collector. This keeps the SDK dependency-free — we emit
 * the wire-level JSON shape directly rather than pulling in the heavy
 * @opentelemetry/sdk-node tree.
 *
 * Each event becomes a single zero-duration span whose name is
 * `mandatez.<action_type>` with the full event serialized as span
 * attributes. Status is mapped: blocked → ERROR, flagged → ERROR,
 * everything else → OK.
 *
 * @see https://opentelemetry.io/docs/specs/otlp/#otlphttp
 */
export class OpenTelemetryExporter implements EventExporter {
  readonly name = 'opentelemetry';
  private readonly endpoint: string;
  private readonly serviceName: string;
  private readonly resourceAttributes: Record<string, string>;
  private readonly headers: Record<string, string>;

  constructor(config: OpenTelemetryExporterConfig) {
    if (!config.endpoint) {
      throw new Error('OpenTelemetryExporter: endpoint is required');
    }
    const base = config.endpoint.replace(/\/+$/, '');
    this.endpoint = /\/v1\/traces$/.test(base) ? base : `${base}/v1/traces`;
    this.serviceName = config.serviceName ?? 'mandatez';
    this.resourceAttributes = config.resourceAttributes ?? {};
    this.headers = config.headers ?? {};
  }

  async export(event: AgentEvent): Promise<void> {
    const timestampNanos = BigInt(new Date(event.timestamp).getTime()) * 1_000_000n;
    const ns = timestampNanos.toString();

    // OTLP trace/span IDs: 16 and 8 random bytes, lowercase hex.
    const traceId = randomBytes(16).toString('hex');
    const spanId = randomBytes(8).toString('hex');

    const blocked = event.outcome === 'blocked';
    const flagged = event.outcome === 'flagged';
    const statusCode = blocked || flagged ? 2 : 1; // 2 = ERROR, 1 = OK

    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: toAttrs({
              'service.name': this.serviceName,
              'service.namespace': 'mandatez',
              ...this.resourceAttributes,
            }),
          },
          scopeSpans: [
            {
              scope: { name: '@mandatez/sdk', version: '0.1.6' },
              spans: [
                {
                  traceId,
                  spanId,
                  name: `mandatez.${event.action_type}`,
                  kind: 1, // SPAN_KIND_INTERNAL
                  startTimeUnixNano: ns,
                  endTimeUnixNano: ns,
                  attributes: toAttrs({
                    'mandatez.event_id': event.event_id,
                    'mandatez.agent_id': event.agent_id,
                    'mandatez.owner_id': event.owner_id,
                    'mandatez.action_type': event.action_type,
                    'mandatez.resource': event.resource,
                    'mandatez.outcome': event.outcome,
                    'mandatez.policy_id': event.policy_id ?? '',
                    'mandatez.public_key': event.public_key,
                    'mandatez.signature': event.signature,
                    'mandatez.metadata': JSON.stringify(event.metadata),
                  }),
                  status: {
                    code: statusCode,
                    message: blocked
                      ? 'Action blocked by MandateZ policy'
                      : flagged
                        ? 'Action flagged for review'
                        : '',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenTelemetryExporter: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
  }
}
