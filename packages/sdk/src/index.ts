// @mandatez/sdk — MandateZ SDK entry point
// Every agent needs a mandate.

export { generateAgentIdentity } from './identity/index.js';
export type { AgentIdentity } from './identity/index.js';

export { AgentEventSchema, AgentEventInputSchema } from './events/index.js';
export type { AgentEvent, AgentEventInput } from './events/index.js';
export { createSignedEvent, verifyEvent } from './events/index.js';

export { SupabaseTransport } from './transport/index.js';
export type { SupabaseTransportConfig } from './transport/index.js';

export { PolicyEngine } from './policy/index.js';
export { PolicyRuleSchema, PolicySchema } from './policy/index.js';
export type { PolicyRule, Policy, PolicyOutcome, PolicyEvaluation } from './policy/index.js';

export { POLICY_TEMPLATES, POLICY_TEMPLATE_LIST, findTemplate } from './policies/templates.js';
export type { PolicyTemplate, PolicyTemplateKey } from './policies/templates.js';

export { OversightGate, SlackAlertChannel, WebhookAlertChannel } from './oversight/index.js';
export type { OversightConfig, OversightResult, AlertChannel, OversightAlert, TimeoutAction, ApprovalDecision } from './oversight/index.js';

export { MandateZClient } from './client.js';
export type {
  MandateZClientConfig,
  TrackInput,
  TrackBatchInput,
  TrackBatchResult,
  BatchConfig,
  CheckIdentityInput,
  CheckIdentityOutput,
  VerifyAgentInput,
  VerifyAgentOutput,
  VerifyAgentRawResponse,
  AgentTrustGrade,
} from './client.js';

export { checkIdentity, scoreBreaches } from './identity/hibp.js';
export type { IdentityCheckResult, IdentityStatus, HibpBreach } from './identity/hibp.js';

export { computeTrustScore } from './trust/posture.js';
export type { AgentTrustProfile } from './trust/posture.js';

export { MandateZN8nHook } from './integrations/n8n/index.js';
export { MandateZLangChainCallback } from './integrations/langchain/index.js';

export { MandateZAgent } from './wrapper/index.js';
export type { MandateZAgentConfig } from './wrapper/index.js';

export { withMandateZ } from './integrations/langchain/decorator.js';

export {
  DatadogExporter,
  SplunkExporter,
  WebhookExporter,
  OpenTelemetryExporter,
} from './exporters/index.js';
export type {
  EventExporter,
  DatadogExporterConfig,
  SplunkExporterConfig,
  WebhookExporterConfig,
  OpenTelemetryExporterConfig,
} from './exporters/index.js';
