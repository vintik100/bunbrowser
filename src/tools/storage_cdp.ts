import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";
import { registerMcpTool } from "./tool_helper.js";

export function registerStorageCdpTools(server: McpServer, manager: BrowserManager): void {
  registerMcpTool(
    server,
    "browser_cdp",
    {
      description:
        "Execute a raw Chrome DevTools Protocol (CDP) command on the active tab (Chrome/Chromium backend)",
      inputSchema: {
        method: z
          .string()
          .describe(
            "CDP method name (e.g. 'Network.getCookies', 'Emulation.setUserAgentOverride', 'DOM.getDocument')"
          ),
        params: z.record(z.any()).optional().describe("JSON parameters object for the CDP command"),
      },
    },
    async ({ method, params }) => {
      try {
        const tab = await manager.getActiveTab();
        const result = await tab.cdp(method, params as Record<string, any>);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result ?? { success: true }, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `CDP error (${method}): ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_cookies",
    {
      description: "Get, set, or clear cookies for the active browser session",
      inputSchema: {
        action: z.enum(["get", "set", "clear"]).describe("Cookie action to perform"),
        name: z.string().optional().describe("Cookie name (required for set)"),
        value: z.string().optional().describe("Cookie value (required for set)"),
        domain: z.string().optional().describe("Cookie domain (optional for set)"),
        path: z.string().optional().describe("Cookie path (default: '/')"),
      },
    },
    async ({ action, name, value, domain, path }) => {
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
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Cookie error: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_localstorage",
    {
      description: "Inspect, set, or clear localStorage keys in the active page origin",
      inputSchema: {
        action: z.enum(["get", "set", "clear"]).describe("Action to perform on localStorage"),
        key: z
          .string()
          .optional()
          .describe("Storage key name (required for set, optional for get)"),
        value: z.string().optional().describe("Storage value to set (required for set)"),
      },
    },
    async ({ action, key, value }) => {
      try {
        const tab = await manager.getActiveTab();

        if (action === "get") {
          const data = await tab.getLocalStorage();
          if (key) {
            return {
              content: [
                {
                  type: "text",
                  text: data[key] !== undefined ? data[key] : `(key '${key}' not found)`,
                },
              ],
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
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `localStorage error: ${message}` }],
        };
      }
    }
  );
}
