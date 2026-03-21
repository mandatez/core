export interface OversightAlert {
  agent_id: string;
  action_type: string;
  resource: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  requires_approval: boolean;
}

/**
 * Alert channel interface — implement this to add new notification targets.
 */
export interface AlertChannel {
  send(alert: OversightAlert): Promise<void>;
}

/**
 * Sends alerts to a Slack webhook URL.
 */
export class SlackAlertChannel implements AlertChannel {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(alert: OversightAlert): Promise<void> {
    const emoji = alert.requires_approval ? ':rotating_light:' : ':warning:';
    const text = [
      `${emoji} *MandateZ Oversight Alert*`,
      `*Agent:* \`${alert.agent_id}\``,
      `*Action:* ${alert.action_type} on \`${alert.resource}\``,
      `*Requires Approval:* ${alert.requires_approval ? 'Yes' : 'No'}`,
      `*Time:* ${alert.timestamp}`,
    ].join('\n');

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Slack alert failed: ${response.status} ${response.statusText}`);
    }
  }
}

/**
 * Sends alerts to an arbitrary webhook URL as JSON POST.
 */
export class WebhookAlertChannel implements AlertChannel {
  private url: string;
  private headers: Record<string, string>;

  constructor(url: string, headers: Record<string, string> = {}) {
    this.url = url;
    this.headers = headers;
  }

  async send(alert: OversightAlert): Promise<void> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(alert),
    });

    if (!response.ok) {
      throw new Error(`Webhook alert failed: ${response.status} ${response.statusText}`);
    }
  }
}
