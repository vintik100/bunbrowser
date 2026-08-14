import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";

export function registerInspectionTools(server: any, manager: BrowserManager) {
  server.tool(
    "browser_snapshot",
    "PRIMARY INSPECTION TOOL. Captures the complete semantic accessibility tree of the active page with deterministic element references ([ref=eN]). ALWAYS prefer this over screenshots for discovering interactive elements, reading page text, and finding buttons/inputs.",
    {},
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
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Snapshot error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_take_screenshot",
    "VISUAL ONLY. Captures an image screenshot of the current page viewport in Base64 encoding. Use ONLY for visual design validation, canvas/image inspection, or when explicitly requested. For element discovery and reading content, use browser_snapshot instead.",
    {
      format: z.enum(["png", "jpeg", "webp"]).optional().describe("Image format: 'png', 'jpeg', or 'webp' (default: 'png')"),
      quality: z.number().min(0).max(100).optional().describe("Image compression quality 0-100 for jpeg/webp (default: 80)"),
    },
    async ({ format = "png", quality = 80 }: { format?: "png" | "jpeg" | "webp"; quality?: number }) => {
      try {
        const tab = await manager.getActiveTab();
        const { base64, mimeType } = await tab.screenshot({ format, quality });

        return {
          content: [
            {
              type: "image",
              data: base64,
              mimeType,
            },
            {
              type: "text",
              text: `Screenshot captured successfully (${format.toUpperCase()}, ${mimeType})`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Screenshot error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_evaluate",
    "Execute an arbitrary JavaScript expression in the context of the active page and serialize its return value.",
    {
      script: z.string().describe("The JavaScript expression to evaluate (e.g. 'document.title', 'window.innerWidth', or '(() => { ... })()')"),
    },
    async ({ script }: { script: string }) => {
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
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Evaluation error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_get_content",
    "Retrieve raw HTML DOM source code or plain visible text of the active page.",
    {
      format: z.enum(["html", "text"]).optional().describe("Format to return: 'html' for complete outerHTML DOM markup or 'text' for visible body innerText (default: 'html')"),
    },
    async ({ format = "html" }: { format?: "html" | "text" }) => {
      try {
        const tab = await manager.getActiveTab();
        const content = await tab.getContent(format);

        return {
          content: [{ type: "text", text: content }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error getting content: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_console_logs",
    "Retrieve captured console logs (log, warn, error, info) emitted by the page JavaScript context.",
    {
      clear: z.boolean().optional().describe("Whether to clear the log buffer after retrieval (default: false)"),
    },
    async ({ clear = false }: { clear?: boolean }) => {
      try {
        const tab = await manager.getActiveTab();
        const logs = tab.getLogs(clear);

        if (logs.length === 0) {
          return {
            content: [{ type: "text", text: "No console logs recorded." }],
          };
        }

        const formatted = logs
          .map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.type.toUpperCase()}] ${l.text}`)
          .join("\n");

        return {
          content: [{ type: "text", text: formatted }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error retrieving logs: ${err.message || String(err)}` }],
        };
      }
    }
  );
}

