# wealth-copilot-mcp

An MCP (Model Context Protocol) server that wraps the Wealth Copilot API's
per-customer endpoints as tools, so any MCP-compatible client (Claude
Desktop, Claude Code, an agent framework, etc.) can look up a fictional
customer's data and ask the Copilot questions directly.

It does not read `/data` itself - it proxies HTTP calls to a running
instance of `api/`, so it always reflects the same calculations as the
frontend.

## Tools

| Tool | Wraps |
| --- | --- |
| `list_customers` | `GET /customers` |
| `get_customer` | `GET /customers/:id` |
| `get_accounts` | `GET /customers/:id/accounts` |
| `get_transactions` | `GET /customers/:id/transactions` |
| `get_investments` | `GET /customers/:id/investments` |
| `get_portfolio` | `GET /customers/:id/portfolio` |
| `get_performance` | `GET /customers/:id/performance` |
| `get_performance_explanation` | `GET /customers/:id/performance/explanation` |
| `get_risk` | `GET /customers/:id/risk` |
| `get_insights` | `GET /customers/:id/insights` |
| `ask_copilot` | `POST /customers/:id/copilot` |

## Run it

From the repo root (installs all workspaces):

```bash
npm install
npm run generate-data
npm run dev:api        # terminal 1 - the API must be running
npm run dev:mcp        # terminal 2 - the MCP server (stdio)
```

Or from this folder directly: `npm run dev`.

By default it talks to the API at `http://localhost:3000`. Point it
elsewhere with `WEALTH_API_URL`:

```bash
WEALTH_API_URL=https://wealth-copilot-api-8493.onrender.com npm run dev
```

## Connect it to an MCP client

The server speaks MCP over stdio. Example config for Claude Desktop /
Claude Code (`claude_mcp_config.json` or equivalent):

```json
{
  "mcpServers": {
    "wealth-copilot": {
      "command": "node",
      "args": ["<repo-path>/mcp-server/dist/index.js"],
      "env": { "WEALTH_API_URL": "http://localhost:3000" }
    }
  }
}
```

Run `npm run build` first so `dist/index.js` exists, or point `command`/`args`
at `npx tsx <repo-path>/mcp-server/src/index.ts` to run from source.
