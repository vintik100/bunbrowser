import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";

export function registerStorageCdpTools(server: any, manager: BrowserManager) {
  server.tool(
    "browser_cdp",
    "Execute a raw Chrome DevTools Protocol (CDP) command on the active tab (Chrome/Chromium backend)",
    {
      method: z.string().describe("CDP method name (e.g. 'Network.getCookies', 'Emulation.setUserAgentOverride', 'DOM.getDocument')"),
      params: z.record(z.any()).optional().describe("JSON parameters object for the CDP command"),
    },
    async ({ method, params }: { method: string; params?: Record<string, any> }) => {
      try {
        const tab = await manager.getActiveTab();
        const result = await tab.cdp(method, params);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result ?? { success: true }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `CDP error (${method}): ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_cookies",
    "Get, set, or clear cookies for the active browser session",
    {
      action: z.enum(["get", "set", "clear"]).describe("Cookie action to perform"),
      name: z.string().optional().describe("Cookie name (required for set)"),
      value: z.string().optional().describe("Cookie value (required for set)"),
      domain: z.string().optional().describe("Cookie domain (optional for set)"),
      path: z.string().optional().describe("Cookie path (default: '/')"),
    },
    async ({ action, name, value, domain, path }: { action: "get" | "set" | "clear"; name?: string; value?: string; domain?: string; path?: string }) => {
      try {
        const tab = await manager.getActiveTab();

        if (action === "get") {
          const cookies = await tab.getCookies();
          return {
            content: [{ type: "text", text: JSON.stringify(cookies, null, 2) }],
          };
        }

        if (action === "set") {
          if (!name || value === undefined) {
            throw new Error("Setting cookie requires 'name' and 'value'");
          }
          await tab.setCookie({ name, value, domain, path });
          return {
            content: [{ type: "text", text: `Cookie '${name}' set successfully.` }],
          };
        }

        if (action === "clear") {
          await tab.clearCookies();
          return {
            content: [{ type: "text", text: "Browser cookies cleared successfully." }],
          };
        }

        throw new Error(`Unknown action: ${action}`);
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Cookie error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_localstorage",
    "Inspect, set, or clear localStorage keys in the active page origin",
    {
      action: z.enum(["get", "set", "clear"]).describe("Action to perform on localStorage"),
      key: z.string().optional().describe("Storage key name (required for set, optional for get)"),
      value: z.string().optional().describe("Storage value to set (required for set)"),
    },
    async ({ action, key, value }: { action: "get" | "set" | "clear"; key?: string; value?: string }) => {
      try {
        const tab = await manager.getActiveTab();

        if (action === "get") {
          const data = await tab.getLocalStorage();
          if (key) {
            return {
              content: [{ type: "text", text: data[key] !== undefined ? data[key] : `(key '${key}' not found)` }],
            };
          }
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          };
        }

        if (action === "set") {
          if (!key || value === undefined) {
            throw new Error("Setting localStorage requires 'key' and 'value'");
          }
          await tab.setLocalStorage(key, value);
          return {
            content: [{ type: "text", text: `localStorage key '${key}' set successfully.` }],
          };
        }

        if (action === "clear") {
          await tab.evaluate("localStorage.clear()");
          return {
            content: [{ type: "text", text: "localStorage cleared successfully." }],
          };
        }

        throw new Error(`Unknown action: ${action}`);
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `localStorage error: ${err.message || String(err)}` }],
        };
      }
    }
  );
}
