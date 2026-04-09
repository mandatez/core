# @mandatez/mcp

MCP (Model Context Protocol) server for [MandateZ](https://mandatez.com) — the neutral trust infrastructure layer for AI agents.

Gives any MCP-compatible AI client (Claude Desktop, Cursor, Windsurf) direct access to MandateZ agent registration, event tracking, trust scoring, policy enforcement, and audit trails.

## Tools

| Tool | Description |
|------|-------------|
| `register_agent` | Generate an Ed25519 keypair and register a new agent |
| `track_event` | Log a cryptographically signed event to the audit trail |
| `get_trust_profile` | Compute trust score (0–100) and grade for an agent |
| `check_policy` | Evaluate an action against policy rules (allowed/blocked/flagged) |
| `get_audit_trail` | Retrieve the last N events for an agent |

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mandatez": {
      "command": "npx",
      "args": ["@mandatez/mcp"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_ANON_KEY": "your-supabase-anon-key",
        "MANDATEZ_OWNER_ID": "your-owner-id"
      }
    }
  }
}
```

### Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mandatez": {
      "command": "npx",
      "args": ["@mandatez/mcp"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_ANON_KEY": "your-supabase-anon-key",
        "MANDATEZ_OWNER_ID": "your-owner-id"
      }
    }
  }
}
```

### Windsurf

Add to your Windsurf MCP config:

```json
{
  "mcpServers": {
    "mandatez": {
      "command": "npx",
      "args": ["@mandatez/mcp"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_ANON_KEY": "your-supabase-anon-key",
        "MANDATEZ_OWNER_ID": "your-owner-id"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous key |
| `MANDATEZ_OWNER_ID` | No | Owner ID for agents (defaults to `"default-owner"`) |

## Usage Examples

Once configured, ask your AI assistant:

- *"Register a new agent called data-processor"*
- *"Track a read event on emails for agent ag_abc123"*
- *"What's the trust score for agent ag_abc123?"*
- *"Check if agent ag_abc123 is allowed to export from api/stripe"*
- *"Show me the last 20 events for agent ag_abc123"*

## How It Works

This MCP server wraps [`@mandatez/sdk`](https://www.npmjs.com/package/@mandatez/sdk) and exposes its capabilities over the Model Context Protocol via stdio transport. Every event is cryptographically signed with Ed25519, stored in Supabase, and contributes to the agent's trust score.

## License

MIT
