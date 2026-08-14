import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";

export function registerVideoTools(server: any, manager: BrowserManager) {
  server.tool(
    "browser_start_recording",
    "CONTINUOUS VIDEO RECORDER. Starts background video recording of user interactions and animations on the active tab into WebM or animated GIF. Use 'browser_stop_recording' when done to export.",
    {
      fps: z.number().min(1).max(60).optional().describe("Frames per second to capture (1-60, default: 20)"),
      format: z.enum(["webm", "gif"]).optional().describe("Output video format: 'webm' (smooth video) or 'gif' (animated image, default: 'webm')"),
      outputPath: z.string().optional().describe("Optional file path where the recording will be saved (e.g. './recordings/demo.webm')"),
      quality: z.number().min(1).max(100).optional().describe("Image compression quality 1-100 (default: 80)"),
    },
    async ({
      fps = 20,
      format = "webm",
      outputPath,
      quality = 80,
    }: {
      fps?: number;
      format?: "webm" | "gif";
      outputPath?: string;
      quality?: number;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.startRecording({ fps, format, outputPath, quality });

        return {
          content: [
            {
              type: "text",
              text: `Started video recording on tab '${tab.id}' (${format.toUpperCase()} @ ${fps} FPS${outputPath ? `, saving to '${outputPath}'` : ""}). Use 'browser_stop_recording' to stop and export.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Start recording error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_stop_recording",
    "Stops the active video recording, exports the resulting WebM or animated GIF file to disk, and returns duration and frame metrics.",
    {
      savePath: z.string().optional().describe("File path destination to save the recording (e.g. './output.webm' or './output.gif')"),
      returnBase64: z.boolean().optional().describe("Whether to return base64 payload in the MCP response (default: false)"),
    },
    async ({ savePath, returnBase64 = false }: { savePath?: string; returnBase64?: boolean }) => {
      try {
        const tab = await manager.getActiveTab();
        const result = await tab.stopRecording({ savePath, returnBase64 });

        const content: any[] = [];

        if (result.base64 && result.format === "gif") {
          content.push({
            type: "image",
            data: result.base64,
            mimeType: result.mimeType,
          });
        }

        const sizeKb = result.fileSizeBytes ? (result.fileSizeBytes / 1024).toFixed(1) : "0.0";
        const summary = [
          `🎬 Recording finished successfully!`,
          `* Duration: ${(result.durationMs / 1000).toFixed(2)}s`,
          `* Total Frames: ${result.framesCount} (~${result.fps} FPS)`,
          `* Format: ${result.format.toUpperCase()} (${result.mimeType})`,
          `* File Size: ${sizeKb} KB`,
          result.outputPath ? `* Saved to: ${result.outputPath}` : `* No disk file specified (in-memory)`,
        ].join("\n");

        content.push({
          type: "text",
          text: summary,
        });

        return { content };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Stop recording error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_record_animation",
    "ONE-SHOT ANIMATION & MOTION RECORDER. Records UI transitions, CSS keyframe animations, micro-interactions, or visual jank for an exact duration (durationMs) into WebM or animated GIF. Supports triggering actions via triggerScript or triggerSelector.",
    {
      durationMs: z.number().min(100).max(60000).describe("Recording duration in milliseconds (e.g. 2000 for 2 seconds)"),
      fps: z.number().min(1).max(60).optional().describe("Frames per second (1-60, default: 20)"),
      format: z.enum(["webm", "gif"]).optional().describe("Output format: 'webm' or 'gif' (default: 'webm')"),
      outputPath: z.string().optional().describe("File path to save the resulting recording (e.g. './animation.gif')"),
      triggerScript: z.string().optional().describe("JavaScript code to execute in the page right when recording begins"),
      triggerSelector: z.string().optional().describe("CSS selector of an element to click right when recording begins"),
      returnBase64: z.boolean().optional().describe("Whether to include base64 payload in response (default: false)"),
    },
    async ({
      durationMs,
      fps = 20,
      format = "webm",
      outputPath,
      triggerScript,
      triggerSelector,
      returnBase64 = false,
    }: {
      durationMs: number;
      fps?: number;
      format?: "webm" | "gif";
      outputPath?: string;
      triggerScript?: string;
      triggerSelector?: string;
      returnBase64?: boolean;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        const result = await tab.recordAnimation({
          durationMs,
          fps,
          format,
          outputPath,
          triggerScript,
          triggerSelector,
          returnBase64,
        });

        const content: any[] = [];

        if (result.base64 && result.format === "gif") {
          content.push({
            type: "image",
            data: result.base64,
            mimeType: result.mimeType,
          });
        }

        const sizeKb = result.fileSizeBytes ? (result.fileSizeBytes / 1024).toFixed(1) : "0.0";
        const summary = [
          `🎬 Animation recorded successfully!`,
          `* Duration: ${(result.durationMs / 1000).toFixed(2)}s`,
          `* Frames Captured: ${result.framesCount} (~${result.fps} FPS)`,
          `* Format: ${result.format.toUpperCase()} (${result.mimeType})`,
          `* File Size: ${sizeKb} KB`,
          result.outputPath ? `* Saved to: ${result.outputPath}` : `* No disk file specified`,
        ].join("\n");

        content.push({
          type: "text",
          text: summary,
        });

        return { content };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Record animation error: ${err.message || String(err)}` }],
        };
      }
    }
  );
}
