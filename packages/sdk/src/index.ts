// @mandatez/sdk — MandateZ SDK entry point
// Every agent needs a mandate.

export { generateAgentIdentity } from './identity/index.js';
export type { AgentIdentity } from './identity/index.js';

export { AgentEventSchema, AgentEventInputSchema } from './events/index.js';
export type { AgentEvent, AgentEventInput } from './events/index.js';
export { createSignedEvent, verifyEvent } from './events/index.js';

export { SupabaseTransport } from './transport/index.js';
export type { SupabaseTransportConfig } from './transport/index.js';

export { MandateZClient } from './client.js';
export type { MandateZClientConfig, TrackInput } from './client.js';

export { MandateZN8nHook } from './integrations/n8n/index.js';
