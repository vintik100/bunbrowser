import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";
import { registerMcpTool } from "./tool_helper.js";

export function registerTabTools(server: McpServer, manager: BrowserManager): void {
  registerMcpTool(
    server,
    "browser_tabs",
    {
      description: "List all open browser tabs with their IDs, URLs, titles, and active status",
    },
    async () => {
      try {
        const tabs = manager.listTabs();
        if (tabs.length === 0) {
          return {
            content: [{ type: "text", text: "No tabs currently open." }],
          };
        }

        const lines = tabs.map(
          (t) =>
            `- [${t.isActive ? "ACTIVE" : " "}] Tab ID: ${t.id} | URL: ${t.url || "(blank)"} | Title: "${t.title || ""}" | Viewport: ${t.viewport.width}x${t.viewport.height}`
        );

        return {
          content: [
            {
              type: "text",
              text: `Open Tabs (${tabs.length}):\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error listing tabs: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_tab_new",
    {
      description: "Open a new browser tab/view, optionally navigating to an initial URL",
      inputSchema: {
        url: z.string().optional().describe("Initial URL to open in the new tab"),
        width: z.number().optional().describe("Viewport width (default: 1280)"),
        height: z.number().optional().describe("Viewport height (default: 720)"),
        snapshot: z
          .boolean()
          .optional()
          .describe("Whether to return a snapshot of the new tab (default: true)"),
      },
    },
    async ({ url, width, height, snapshot = true }) => {
      try {
        const tab = await manager.createTab(url, { width, height });
        let responseText = `Opened new Tab: ${tab.id} (URL: ${tab.url || "about:blank"})`;

        if (snapshot && tab.url) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Page Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error creating tab: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_tab_switch",
    {
      description: "Switch the active browser context to a different tab by tabId",
      inputSchema: {
        tabId: z.string().describe("The ID of the tab to switch to (e.g. 'tab_1')"),
        snapshot: z
          .boolean()
          .optional()
          .describe("Whether to return a snapshot of the switched tab (default: true)"),
      },
    },
    async ({ tabId, snapshot = true }) => {
      try {
        const tab = manager.switchTab(tabId);
        let responseText = `Switched active tab to: ${tab.id} (URL: ${tab.url || "about:blank"})`;

        if (snapshot) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Page Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error switching tab: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_tab_close",
    {
      description: "Close a browser tab (closes the active tab if tabId is omitted)",
      inputSchema: {
        tabId: z
          .string()
          .optional()
          .describe("The ID of the tab to close (default: current active tab)"),
      },
    },
    async ({ tabId }) => {
      try {
        const closed = await manager.closeTab(tabId);
        if (!closed) {
          return {
            content: [{ type: "text", text: `No matching tab found to close.` }],
          };
        }

        const remaining = manager.listTabs().length;
        return {
          content: [
            {
              type: "text",
              text: `Tab closed successfully. (${remaining} remaining tabs)`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error closing tab: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_resize",
    {
      description: "Resize the viewport dimensions of the active browser tab",
      inputSchema: {
        width: z.number().min(100).max(16384).describe("Viewport width in CSS pixels (100-16384)"),
        height: z
          .number()
          .min(100)
          .max(16384)
          .describe("Viewport height in CSS pixels (100-16384)"),
      },
    },
    async ({ width, height }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.resize(width, height);

        return {
          content: [{ type: "text", text: `Resized viewport to ${width}x${height}px.` }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Resize error: ${message}` }],
        };
      }
    }
  );
}
