# @mandatez/cli

Command-line tool for MandateZ — the cross-vendor trust infrastructure for AI agents.

## Install

```bash
npm install -g @mandatez/cli
# or invoke without installing:
npx @mandatez/cli <command>
```

## Commands

```bash
mandatez scan     --owner-id <id> [--github-token <token>] [--out shadow-report.json]
mandatez report   --owner-id <id> [--type owasp|eu-ai-act|hipaa] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out mandatez-report.pdf]
mandatez verify   <agent-id> [--requesting-agent <id>] [--min-score 60]
mandatez status
```

### `mandatez scan`

Discover shadow agents (ungoverned AI workloads) across your stack. Without `--github-token`, runs in demo mode.

```bash
mandatez scan --owner-id your_owner --github-token ghp_... --out shadow-report.json
```

### `mandatez report`

Generate a compliance report PDF for OWASP Agentic Top 10, the EU AI Act, or HIPAA.

```bash
mandatez report --owner-id your_owner --type owasp --out owasp-report.pdf
```

### `mandatez verify`

Verify another agent through the MandateZ directory before transacting with it.

```bash
mandatez verify ag_partner_agent --requesting-agent ag_my_agent --min-score 70
```

Exits with code `2` if verification fails.

### `mandatez status`

Show SDK / MCP / CLI versions and check whether the dashboard and directory are reachable.

## Configuration

```bash
MANDATEZ_DASHBOARD_URL   # default: https://core-dashboard-black.vercel.app
MANDATEZ_DIRECTORY_URL   # default: https://core-directory.vercel.app
MANDATEZ_OWNER_ID        # default --owner-id for scan/report
MANDATEZ_AGENT_ID        # default --requesting-agent for verify
```

## License

MIT
