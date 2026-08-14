import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";

export function registerNavigationTools(server: any, manager: BrowserManager) {
  server.tool(
    "browser_navigate",
    "Navigate the active browser tab to a specified URL and wait for load",
    {
      url: z.string().describe("The URL to navigate to (e.g. 'https://example.com' or 'data:text/html,...')"),
      timeout: z.number().optional().describe("Navigation timeout in milliseconds (default: 30000)"),
      snapshot: z.boolean().optional().describe("Whether to automatically take and return an accessibility snapshot after navigating (default: true)"),
    },
    async ({ url, timeout, snapshot = true }: { url: string; timeout?: number; snapshot?: boolean }) => {
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
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Navigation error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_navigate_back",
    "Navigate back in the browser history",
    {
      snapshot: z.boolean().optional().describe("Whether to automatically return a snapshot after navigating back"),
    },
    async ({ snapshot = true }: { snapshot?: boolean }) => {
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
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error navigating back: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_navigate_forward",
    "Navigate forward in the browser history",
    {
      snapshot: z.boolean().optional().describe("Whether to automatically return a snapshot after navigating forward"),
    },
    async ({ snapshot = true }: { snapshot?: boolean }) => {
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
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error navigating forward: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_reload",
    "Reload the current page in the active tab",
    {
      snapshot: z.boolean().optional().describe("Whether to automatically return a snapshot after reload"),
    },
    async ({ snapshot = true }: { snapshot?: boolean }) => {
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
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error reloading page: ${err.message || String(err)}` }],
        };
      }
    }
  );
}
