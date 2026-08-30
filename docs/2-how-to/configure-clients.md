# How-To Guide: Configuring `@bunbrowser/mcp` in AI Clients

This guide provides step-by-step instructions to configure **`@bunbrowser/mcp`** (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)) as your primary browser automation MCP server in popular AI development environments.

---

## 1. Claude Desktop

To use `@bunbrowser/mcp` within Anthropic's Claude Desktop application (macOS and Windows):

### Step 1: Open the Configuration File

* **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
* **Linux** (community builds/wrappers): `~/.config/Claude/claude_desktop_config.json`

### Step 2: Add the Server Definition

Add the `bunbrowser` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "bunbrowser": {
      "command": "bunx",
      "args": ["@bunbrowser/mcp"]
    }
  }
}
```

> [!TIP]
> If running from local source clone, use:
> `"command": "bun"`, `"args": ["run", "path/to/bunbrowser/src/index.ts"]`

### Step 3: Restart Claude Desktop

Restart the Claude Desktop app. You will see the tool hammer icon (🛠️) populated with all 30 browser tools.

---

## 2. Cursor IDE

To enable browser automation tools in Cursor Agent:

### Step 1: Open MCP Settings

1. Open Cursor.
2. Navigate to **Settings** -> **Features** -> **MCP Servers**.
3. Or create/edit `.cursor/mcp.json` in your workspace.

### Step 2: Add Configuration

```json
{
  "mcpServers": {
    "browser": {
      "command": "bunx",
      "args": ["@bunbrowser/mcp"]
    }
  }
}
```

---

## 3. Google Antigravity & Gemini CLI

To use `@bunbrowser/mcp` in Google Antigravity:

Add the server definition to your MCP configuration (`~/.gemini/antigravity/mcp_config.json` or workspace config):

```json
{
  "mcpServers": {
    "browser": {
      "command": "bunx",
      "args": ["@bunbrowser/mcp"]
    }
  }
}
```

---

## 4. VS Code Extensions (Cline / Roo Code / Continue)

If you use MCP extensions in VS Code:

Open your extension settings file (e.g. `cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "browser-automation": {
      "command": "bunx",
      "args": ["@bunbrowser/mcp"],
      "disabled": false,
      "autoApprove": [
        "browser_navigate",
        "browser_snapshot",
        "browser_click",
        "browser_type",
        "browser_fill_form"
      ]
    }
  }
}
```

---

## 5. Testing the Connection

Once configured, send a test prompt to your AI assistant:

> *"Navigate to https://news.ycombinator.com, take a snapshot of the top 5 stories, and summarize them."*

The agent will invoke `browser_navigate` and `browser_snapshot`, returning structured results with sub-50ms latency.
