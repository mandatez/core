# MandateZ Agent Security Scan

GitHub Action that finds **ungoverned AI agents** in your repo before they ship.

> **TODO (manual):** publishing this to the GitHub Marketplace requires a dedicated public repo (`mandatez/agent-scan`). Push the contents of this directory there, tag `v1`, and enable Marketplace listing. Until that's done the `uses:` path stays `mandatez/core/packages/github-action@main`.

## Usage

Create `.github/workflows/mandatez-scan.yml`:

```yaml
name: MandateZ Agent Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mandatez/agent-scan@v1
        with:
          owner-id: ${{ secrets.MANDATEZ_OWNER_ID }}
          fail-on-critical: 'true'
```

On every push and PR, the action walks `.github/workflows/`, detects AI-agent footprint, cross-references against agents registered under your `owner-id`, and fails the build if any critical-risk agent is ungoverned.

## What it detects

- **LangChain, LangGraph, CrewAI, AutoGen, LlamaIndex** — framework imports in workflow YAML or inline scripts.
- **Raw OpenAI / Anthropic SDK** usage without a governance wrapper.
- **Exposed LLM API keys** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `COHERE_API_KEY`, `LANGCHAIN_API_KEY`, `REPLICATE_API_TOKEN`) in workflow `env:` blocks.
- **Overly broad permissions** (`permissions: write-all`, `read-all`, `*`).
- **Governed agents** — workflows that already import `@mandatez/sdk` / `MandateZClient` / `MandateZAgent` are flagged as covered.

## Inputs

| Input | Default | Description |
|---|---|---|
| `owner-id` | — | Your MandateZ owner ID. Agents registered under this ID are marked as governed after cross-reference. |
| `fail-on-critical` | `true` | Fail the workflow when at least one critical-risk ungoverned agent is found. |
| `dashboard-url` | `https://core-dashboard-black.vercel.app` | Target for the `/api/shadow-scan` POST and register links in the PR comment. |
| `github-token` | `${{ github.token }}` | Token used to post the PR comment. |
| `comment-on-pr` | `true` | Post a sticky summary comment on pull requests. |

## Outputs

| Output | Description |
|---|---|
| `risk_score` | 0–100 overall shadow-agent risk. |
| `total_discovered` | Total AI agents found. |
| `unregistered` | Count of agents not governed by MandateZ. |
| `critical_risk` | Count of ungoverned critical-risk agents. |

Example — gate a deploy on the score:

```yaml
- uses: mandatez/agent-scan@v1
  id: scan
- run: echo "Risk score is ${{ steps.scan.outputs.risk_score }}"
- if: ${{ steps.scan.outputs.risk_score > 50 }}
  run: exit 1
```

## PR comment

On pull requests the action posts a sticky comment with the risk score, a table of every detected agent, and a direct link to register the ungoverned ones. Subsequent runs update the same comment — no pile-up.

## Fallback behaviour

If the MandateZ dashboard is unreachable, the action still scans locally and computes the risk score client-side (same formula as the server). The PR comment and outputs still publish; only the "cross-reference against registered agents" step is skipped.

## Development

```bash
pnpm install
pnpm run build          # ncc bundles src/index.ts → dist/index.js
pnpm run build:check    # tsc --noEmit
```

The bundled `dist/` must be committed — GitHub runs the action directly from the committed bundle, there is no runtime install step.
