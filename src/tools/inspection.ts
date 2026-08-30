import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";
import { registerMcpTool } from "./tool_helper.js";

export function registerInspectionTools(server: McpServer, manager: BrowserManager): void {
  registerMcpTool(
    server,
    "browser_snapshot",
    {
      description:
        "PRIMARY INSPECTION TOOL. Captures the complete semantic accessibility tree of the active page with deterministic element references ([ref=eN]). ALWAYS prefer this over screenshots for discovering interactive elements, reading page text, and finding buttons/inputs.",
    },
    async () => {
      try {
        const tab = await manager.getActiveTab();
        const snap = await tab.snapshot();

        return {
          content: [
            {
              type: "text",
              text: `Page Title: ${snap.title || "(no title)"}\nURL: ${snap.url}\nInteractive Elements: ${snap.elementsCount}\n\n${snap.treeText}`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Snapshot error: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_take_screenshot",
    {
      description:
        "VISUAL ONLY. Captures an image screenshot of the current page viewport in Base64 encoding. Use ONLY for visual design validation, canvas/image inspection, or when explicitly requested. For element discovery and reading content, use browser_snapshot instead.",
      inputSchema: {
        format: z
          .enum(["png", "jpeg", "webp"])
          .optional()
          .describe("Image format: 'png', 'jpeg', or 'webp' (default: 'png')"),
        quality: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Image compression quality 0-100 for jpeg/webp (default: 80)"),
        outputPath: z
          .string()
          .optional()
          .describe(
            "Optional file path to save the image to disk directly (e.g. './screenshots/page.png'). When provided, the image is written to disk via Bun.write and a text confirmation with the path and file size is returned instead of the Base64 payload."
          ),
      },
    },
    async ({ format = "png", quality = 80, outputPath }) => {
      try {
        const tab = await manager.getActiveTab();
        const result = await tab.screenshot({ format, quality, outputPath });

        if (result.outputPath) {
          return {
            content: [
              {
                type: "text",
                text: `Screenshot saved to disk (${format.toUpperCase()}, ${result.mimeType}, ${result.fileSizeBytes} bytes):\n${result.outputPath}`,
              },
            ],
          };
        }

        if (!result.base64) {
          return {
            isError: true,
            content: [{ type: "text", text: "Screenshot error: no image data returned" }],
          };
        }

        return {
          content: [
            {
              type: "image",
              data: result.base64,
              mimeType: result.mimeType,
            },
            {
              type: "text",
              text: `Screenshot captured successfully (${format.toUpperCase()}, ${result.mimeType})`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Screenshot error: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_evaluate",
    {
      description:
        "Execute an arbitrary JavaScript expression in the context of the active page and serialize its return value.",
      inputSchema: {
        script: z
          .string()
          .describe(
            "The JavaScript expression to evaluate (e.g. 'document.title', 'window.innerWidth', or '(() => { ... })()')"
          ),
      },
    },
    async ({ script }) => {
      try {
        const tab = await manager.getActiveTab();
        const result = await tab.evaluate(script);

        const formatted =
          result === undefined
            ? "undefined"
            : typeof result === "object"
              ? JSON.stringify(result, null, 2)
              : String(result);

        return {
          content: [{ type: "text", text: formatted }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Evaluation error: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_get_content",
    {
      description: "Retrieve raw HTML DOM source code or plain visible text of the active page.",
      inputSchema: {
        format: z
          .enum(["html", "text"])
          .optional()
          .describe(
            "Format to return: 'html' for complete outerHTML DOM markup or 'text' for visible body innerText (default: 'html')"
          ),
      },
    },
    async ({ format = "html" }) => {
      try {
        const tab = await manager.getActiveTab();
        const content = await tab.getContent(format);

        return {
          content: [{ type: "text", text: content }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error getting content: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_console_logs",
    {
      description:
        "Retrieve captured console logs (log, warn, error, info) emitted by the page JavaScript context.",
      inputSchema: {
        clear: z
          .boolean()
          .optional()
          .describe("Whether to clear the log buffer after retrieval (default: false)"),
      },
    },
    async ({ clear = false }) => {
      try {
        const tab = await manager.getActiveTab();
        const logs = tab.getLogs(clear);

        if (logs.length === 0) {
          return {
            content: [{ type: "text", text: "No console logs recorded." }],
          };
        }

        const formatted = logs
          .map(
            (l) => `[${new Date(l.timestamp).toISOString()}] [${l.type.toUpperCase()}] ${l.text}`
          )
          .join("\n");

        return {
          content: [{ type: "text", text: formatted }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error retrieving logs: ${message}` }],
        };
      }
    }
  );
}
