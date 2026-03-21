# @mandatez/sdk — n8n Integration

```typescript
import { generateAgentIdentity, MandateZClient } from '@mandatez/sdk';
import { MandateZN8nHook } from '@mandatez/sdk/integrations/n8n';

const identity = await generateAgentIdentity();
const client = new MandateZClient({
  agentId: identity.agent_id,
  ownerId: 'your_org_id',
  privateKey: identity.private_key,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
});

const hook = new MandateZN8nHook(client);

// In your n8n custom node or webhook handler:
await hook.beforeExecution('wf_123', 'HTTP Request', { url: 'https://api.example.com' });
// ...node executes...
await hook.afterExecution('wf_123', 'HTTP Request', { status: 200 }, true);
```
