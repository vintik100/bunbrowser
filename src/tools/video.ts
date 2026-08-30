import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";
import { registerMcpTool } from "./tool_helper.js";

export function registerVideoTools(server: McpServer, manager: BrowserManager): void {
  registerMcpTool(
    server,
    "browser_start_recording",
    {
      description:
        "CONTINUOUS VIDEO RECORDER. Starts background video recording of user interactions and animations on the active tab into WebM or animated GIF. Use 'browser_stop_recording' when done to export.",
      inputSchema: {
        fps: z
          .number()
          .min(1)
          .max(60)
          .optional()
          .describe("Frames per second to capture (1-60, default: 20)"),
        format: z
          .enum(["webm", "gif"])
          .optional()
          .describe(
            "Output video format: 'webm' (smooth video) or 'gif' (animated image, default: 'webm')"
          ),
        outputPath: z
          .string()
          .optional()
          .describe(
            "Optional file path where the recording will be saved (e.g. './recordings/demo.webm')"
          ),
        quality: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe("Image compression quality 1-100 (default: 80)"),
        scale: z
          .number()
          .min(0.1)
          .max(2.0)
          .optional()
          .describe(
            "Downscaling factor for video frame dimensions 0.1-2.0 (e.g. 0.5 for 50% width/height, default: 1.0)"
          ),
        maxFrames: z
          .number()
          .min(5)
          .max(10000)
          .optional()
          .describe("Maximum frame count safety cap to prevent OOM (default: 1500)"),
        showCursor: z
          .boolean()
          .optional()
          .describe(
            "Whether to render animated click ripples on interactions during recording (default: true)"
          ),
      },
    },
    async ({
      fps = 20,
      format = "webm",
      outputPath,
      quality = 80,
      scale = 1.0,
      maxFrames = 1500,
      showCursor = true,
    }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.startRecording({
          fps,
          format,
          outputPath,
          quality,
          scale,
          maxFrames,
          showCursor,
        });

        return {
          content: [
            {
              type: "text",
              text: `Started video recording on tab '${tab.id}' (${format.toUpperCase()} @ ${fps} FPS, scale=${scale}x${outputPath ? `, saving to '${outputPath}'` : ""}). Use 'browser_stop_recording' to stop and export.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Start recording error: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_stop_recording",
    {
      description:
        "Stops the active video recording, exports the resulting WebM or animated GIF file to disk, and returns duration and frame metrics.",
      inputSchema: {
        savePath: z
          .string()
          .optional()
          .describe(
            "File path destination to save the recording (e.g. './output.webm' or './output.gif')"
          ),
        returnBase64: z
          .boolean()
          .optional()
          .describe("Whether to return base64 payload in the MCP response (default: false)"),
      },
    },
    async ({ savePath, returnBase64 = false }) => {
      try {
        const tab = await manager.getActiveTab();
        const result = await tab.stopRecording({ savePath, returnBase64 });

        const content: Array<
          { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
        > = [];

        if (result.base64 && result.format === "gif") {
          content.push({
            type: "image",
            data: result.base64,
            mimeType: result.mimeType,
          });
        }

        const sizeKb = result.fileSizeBytes ? (result.fileSizeBytes / 1024).toFixed(1) : "0.0";
        const dimStr = result.width && result.height ? ` (${result.width}x${result.height}px)` : "";
        const summary = [
          `🎬 Recording finished successfully!`,
          `* Duration: ${(result.durationMs / 1000).toFixed(2)}s`,
          `* Total Frames: ${result.framesCount} (~${result.fps} FPS)`,
          `* Format: ${result.format.toUpperCase()} (${result.mimeType})${dimStr}`,
          `* File Size: ${sizeKb} KB`,
          result.outputPath
            ? `* Saved to: ${result.outputPath}`
            : `* No disk file specified (in-memory)`,
        ].join("\n");

        content.push({
          type: "text",
          text: summary,
        });

        return { content };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Stop recording error: ${message}` }],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_record_animation",
    {
      description:
        "ONE-SHOT ANIMATION & MOTION RECORDER. Records UI transitions, CSS keyframe animations, micro-interactions, or visual jank for an exact duration (durationMs) into WebM or animated GIF. Supports triggering actions via triggerScript or triggerSelector.",
      inputSchema: {
        durationMs: z
          .number()
          .min(100)
          .max(60000)
          .describe("Recording duration in milliseconds (e.g. 2000 for 2 seconds)"),
        fps: z.number().min(1).max(60).optional().describe("Frames per second (1-60, default: 20)"),
        format: z
          .enum(["webm", "gif"])
          .optional()
          .describe("Output format: 'webm' or 'gif' (default: 'webm')"),
        outputPath: z
          .string()
          .optional()
          .describe("File path to save the resulting recording (e.g. './animation.gif')"),
        scale: z
          .number()
          .min(0.1)
          .max(2.0)
          .optional()
          .describe("Downscaling factor for video frame dimensions 0.1-2.0 (default: 1.0)"),
        quality: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe("Image compression quality 1-100 (default: 80)"),
        showCursor: z
          .boolean()
          .optional()
          .describe(
            "Whether to render animated click ripples on interactions during recording (default: true)"
          ),
        triggerScript: z
          .string()
          .optional()
          .describe("JavaScript code to execute in the page right when recording begins"),
        triggerSelector: z
          .string()
          .optional()
          .describe("CSS selector of an element to click right when recording begins"),
        returnBase64: z
          .boolean()
          .optional()
          .describe("Whether to include base64 payload in response (default: false)"),
      },
    },
    async ({
      durationMs,
      fps = 20,
      format = "webm",
      outputPath,
      scale = 1.0,
      quality = 80,
      showCursor = true,
      triggerScript,
      triggerSelector,
      returnBase64 = false,
    }) => {
      try {
        const tab = await manager.getActiveTab();
        const result = await tab.recordAnimation({
          durationMs,
          fps,
          format,
          outputPath,
          scale,
          quality,
          showCursor,
          triggerScript,
          triggerSelector,
          returnBase64,
        });

        const content: Array<
          { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
        > = [];

        if (result.base64 && result.format === "gif") {
          content.push({
            type: "image",
            data: result.base64,
            mimeType: result.mimeType,
          });
        }

        const sizeKb = result.fileSizeBytes ? (result.fileSizeBytes / 1024).toFixed(1) : "0.0";
        const dimStr = result.width && result.height ? ` (${result.width}x${result.height}px)` : "";
        const summary = [
          `🎬 Animation recorded successfully!`,
          `* Duration: ${(result.durationMs / 1000).toFixed(2)}s`,
          `* Frames Captured: ${result.framesCount} (~${result.fps} FPS)`,
          `* Format: ${result.format.toUpperCase()} (${result.mimeType})${dimStr}`,
          `* File Size: ${sizeKb} KB`,
          result.outputPath ? `* Saved to: ${result.outputPath}` : `* No disk file specified`,
        ].join("\n");

        content.push({
          type: "text",
          text: summary,
        });

        return { content };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Record animation error: ${message}` }],
        };
      }
    }
  );
}
