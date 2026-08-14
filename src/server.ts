import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BrowserManager } from "./browser/manager.js";
import type { BrowserConfig } from "./browser/types.js";
import { registerInspectionTools } from "./tools/inspection.js";
import { registerInteractionTools } from "./tools/interaction.js";
import { registerMetricsTools } from "./tools/metrics.js";
import { registerNavigationTools } from "./tools/navigation.js";
import { registerStorageCdpTools } from "./tools/storage_cdp.js";
import { registerTabTools } from "./tools/tabs.js";
import { registerVideoTools } from "./tools/video.js";

export function createServer(config: BrowserConfig = {}) {
  const server = new McpServer({
    name: "@bunbrowser/mcp",
    version: "1.0.0",
  });

  const manager = new BrowserManager(config);

  // Register all tool groups
  registerNavigationTools(server, manager);
  registerInspectionTools(server, manager);
  registerInteractionTools(server, manager);
  registerTabTools(server, manager);
  registerStorageCdpTools(server, manager);
  registerMetricsTools(server, manager);
  registerVideoTools(server, manager);

  return { server, manager };
}
