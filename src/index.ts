import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { BrowserConfig } from "./browser/types.js";
import { createServer } from "./server.js";

function parseArgs(): BrowserConfig {
  const args = process.argv.slice(2);
  const config: BrowserConfig = {
    defaultWidth: 1280,
    defaultHeight: 720,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--width" && args[i + 1]) {
      config.defaultWidth = parseInt(args[++i], 10);
    } else if (arg === "--height" && args[i + 1]) {
      config.defaultHeight = parseInt(args[++i], 10);
    } else if (arg === "--backend" && args[i + 1]) {
      const backendArg = args[++i];
      if (backendArg === "chrome" || backendArg === "webkit") {
        config.backend = backendArg;
      }
    } else if (arg === "--datastore" && args[i + 1]) {
      config.dataStore = { directory: args[++i] };
    } else if (arg === "--url" && args[i + 1]) {
      config.initialUrl = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.error(`
@bunbrowser/mcp: Ultra-fast Playwright-equivalent MCP server powered by Bun.WebView

Repository:
  https://github.com/vintik100/bunbrowser

Usage:
  bun run src/index.ts [options]
  bunx @bunbrowser/mcp [options]
  bunbrowser [options]

Options:
  --width <pixels>      Default viewport width (default: 1280)
  --height <pixels>     Default viewport height (default: 720)
  --backend <engine>    Browser engine: 'chrome' or 'webkit' (auto-detected by default)
  --datastore <dir>     Persistent storage directory for cookies and localStorage
  --url <initialUrl>    Initial URL to navigate to on startup
  --help, -h            Show this help message
`);
      process.exit(0);
    }
  }

  return config;
}

export async function main() {
  const config = parseArgs();
  const { server } = createServer(config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[@bunbrowser/mcp] Server running on stdio (Bun ${Bun.version})`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[@bunbrowser/mcp] Fatal error:", err);
    process.exit(1);
  });
}
