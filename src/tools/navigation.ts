import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";
import { registerMcpTool } from "./tool_helper.js";

export function registerNavigationTools(server: McpServer, manager: BrowserManager): void {
  registerMcpTool(
    server,
    "browser_navigate",
    {
      description: "Navigate the active browser tab to a specified URL and wait for load",
      inputSchema: {
        url: z
          .string()
          .describe("The URL to navigate to (e.g. 'https://example.com' or 'data:text/html,...')"),
        timeout: z
          .number()
          .optional()
          .describe("Navigation timeout in milliseconds (default: 30000)"),
        snapshot: z
          .boolean()
          .optional()
          .describe(
            "Whether to automatically take and return an accessibility snapshot after navigating (default: true)"
          ),
      },
    },
    async ({ url, timeout, snapshot = true }) => {
      try {
        const tab = await manager.getActiveTab();
        const navResult = await tab.navigate(url, timeout);

        let responseText = `Successfully navigated to: ${navResult.url}\nPage Title: ${navResult.title || "(no title)"}`;

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
          content: [{ type: "text", text: `Navigation error: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_navigate_back",
    {
      description: "Navigate back in the browser history",
      inputSchema: {
        snapshot: z
          .boolean()
          .optional()
          .describe("Whether to automatically return a snapshot after navigating back"),
      },
    },
    async ({ snapshot = true }) => {
      try {
        const tab = await manager.getActiveTab();
        const res = await tab.goBack();
        let responseText = `Navigated back to: ${res.url}\nTitle: ${res.title}`;

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
          content: [{ type: "text", text: `Error navigating back: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_navigate_forward",
    {
      description: "Navigate forward in the browser history",
      inputSchema: {
        snapshot: z
          .boolean()
          .optional()
          .describe("Whether to automatically return a snapshot after navigating forward"),
      },
    },
    async ({ snapshot = true }) => {
      try {
        const tab = await manager.getActiveTab();
        const res = await tab.goForward();
        let responseText = `Navigated forward to: ${res.url}\nTitle: ${res.title}`;

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
          content: [{ type: "text", text: `Error navigating forward: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_reload",
    {
      description: "Reload the current page in the active tab",
      inputSchema: {
        snapshot: z
          .boolean()
          .optional()
          .describe("Whether to automatically return a snapshot after reload"),
      },
    },
    async ({ snapshot = true }) => {
      try {
        const tab = await manager.getActiveTab();
        const res = await tab.reload();
        let responseText = `Reloaded page: ${res.url}\nTitle: ${res.title}`;

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
          content: [{ type: "text", text: `Error reloading page: ${message}` }],
        };
      }
    }
  );
}
