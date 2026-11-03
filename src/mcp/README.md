# Json MCP server (read-only)

Exposes the Json backend to Claude Code over stdio. Tools: `list_companies`, `get_readiness`, `analyze`, `summary_lookup`.

Start (from the repo root):

```
node src/mcp/server.mjs
```

Env var: `JSON_BACKEND_URL` (default `http://localhost:8000`). Start the backend first.

Example Claude Code config (illustrative, adjust paths to your setup):

```json
{
  "mcpServers": {
    "json": {
      "command": "node",
      "args": ["src/mcp/server.mjs"]
    }
  }
}
```
