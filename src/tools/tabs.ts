import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";

export function registerTabTools(server: any, manager: BrowserManager) {
  server.tool(
    "browser_tabs",
    "List all open browser tabs with their IDs, URLs, titles, and active status",
    {},
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
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error listing tabs: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_tab_new",
    "Open a new browser tab/view, optionally navigating to an initial URL",
    {
      url: z.string().optional().describe("Initial URL to open in the new tab"),
      width: z.number().optional().describe("Viewport width (default: 1280)"),
      height: z.number().optional().describe("Viewport height (default: 720)"),
      snapshot: z.boolean().optional().describe("Whether to return a snapshot of the new tab (default: true)"),
    },
    async ({
      url,
      width,
      height,
      snapshot = true,
    }: {
      url?: string;
      width?: number;
      height?: number;
      snapshot?: boolean;
    }) => {
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
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error creating tab: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_tab_switch",
    "Switch the active browser context to a different tab by tabId",
    {
      tabId: z.string().describe("The ID of the tab to switch to (e.g. 'tab_1')"),
      snapshot: z.boolean().optional().describe("Whether to return a snapshot of the switched tab (default: true)"),
    },
    async ({ tabId, snapshot = true }: { tabId: string; snapshot?: boolean }) => {
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
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error switching tab: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_tab_close",
    "Close a browser tab (closes the active tab if tabId is omitted)",
    {
      tabId: z.string().optional().describe("The ID of the tab to close (default: current active tab)"),
    },
    async ({ tabId }: { tabId?: string }) => {
      try {
        const closed = await manager.closeTab(tabId);
        if (!closed) {
          return {
            content: [{ type: "text", text: `No matching tab found to close.` }],
          };
        }

        const remaining = manager.listTabs().length;
        return {
          content: [{ type: "text", text: `Tab closed successfully. (${remaining} remaining tabs)` }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error closing tab: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_resize",
    "Resize the viewport dimensions of the active browser tab",
    {
      width: z.number().min(100).max(16384).describe("Viewport width in CSS pixels (100-16384)"),
      height: z.number().min(100).max(16384).describe("Viewport height in CSS pixels (100-16384)"),
    },
    async ({ width, height }: { width: number; height: number }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.resize(width, height);

        return {
          content: [{ type: "text", text: `Resized viewport to ${width}x${height}px.` }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Resize error: ${err.message || String(err)}` }],
        };
      }
    }
  );
}
