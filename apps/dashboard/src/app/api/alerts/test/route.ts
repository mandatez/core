import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TestAlertRequest {
  channel: 'slack' | 'webhook';
  url?: string;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const TEST_PAYLOAD = {
  event: 'test_alert',
  agent_id: 'ag_test_0000',
  action_type: 'export',
  resource: 'customer_data',
  policy_id: 'pol_test_rule',
  outcome: 'blocked',
  timestamp: new Date().toISOString(),
  message:
    'MandateZ test alert — delivery confirmed. Your agents are now wired for real-time notifications.',
};

export async function POST(request: NextRequest) {
  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;

  let body: TestAlertRequest;
  try {
    body = (await request.json()) as TestAlertRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url || !isHttpsUrl(url)) {
    return NextResponse.json({ error: 'Valid HTTPS URL required' }, { status: 400 });
  }

  const payload =
    body.channel === 'slack'
      ? {
          text: ':rotating_light: *MandateZ test alert*',
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: 'MandateZ · Test Alert' },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'If you see this message, your Slack webhook is correctly wired. Real alerts will fire when your agents are *flagged*, *blocked*, or change trust grade.',
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `\`${TEST_PAYLOAD.event}\` · \`${TEST_PAYLOAD.agent_id}\` · ${TEST_PAYLOAD.timestamp}`,
                },
              ],
            },
          ],
        }
      : { ...TEST_PAYLOAD, timestamp: new Date().toISOString() };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        {
          error: `Delivery failed (${res.status})`,
          detail: text.slice(0, 300),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ delivered: true, status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Network error' },
      { status: 502 },
    );
  }
}