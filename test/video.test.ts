import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { GifEncoder } from "../src/browser/gif_encoder.js";
import type { BrowserManager } from "../src/browser/manager.js";
import { createServer } from "../src/server.js";

describe("Video & Animation Recording Module", () => {
  let client: Client;
  let manager: BrowserManager;

  const tmpDir = resolve(import.meta.dir, ".tmp");
  const testGifPath = resolve(tmpDir, "test_animation.gif");
  const testContinuousGifPath = resolve(tmpDir, "test_continuous.gif");
  const testWebmPath = resolve(tmpDir, "test_animation.webm");
  const testWebmScriptPath = resolve(tmpDir, "test_script_animation.webm");
  const testStopOverridePath = resolve(tmpDir, "test_override_save.webm");

  beforeAll(async () => {
    mkdirSync(tmpDir, { recursive: true });

    const serverInstance = createServer();
    manager = serverInstance.manager;

    client = new Client({ name: "video-test-client", version: "1.0.0" }, { capabilities: {} });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      serverInstance.server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterAll(async () => {
    if (manager) {
      manager.closeAll();
    }
    // Cleanup generated test directory and files
    if (existsSync(tmpDir)) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  describe("GifEncoder (Pure TypeScript)", () => {
    it("should encode RGBA frames into a valid GIF89a binary", () => {
      const width = 10;
      const height = 10;
      const encoder = new GifEncoder(width, height, 0);

      // Create red frame
      const redFrame = new Uint8Array(width * height * 4);
      for (let i = 0; i < redFrame.length; i += 4) {
        redFrame[i] = 255; // R
        redFrame[i + 1] = 0; // G
        redFrame[i + 2] = 0; // B
        redFrame[i + 3] = 255;
      }
      encoder.addFrame(redFrame, 50);

      // Create blue frame
      const blueFrame = new Uint8Array(width * height * 4);
      for (let i = 0; i < blueFrame.length; i += 4) {
        blueFrame[i] = 0;
        blueFrame[i + 1] = 0;
        blueFrame[i + 2] = 255;
        blueFrame[i + 3] = 255;
      }
      encoder.addFrame(blueFrame, 50);

      const gifBytes = encoder.encode();
      expect(gifBytes).toBeInstanceOf(Uint8Array);
      expect(gifBytes.byteLength).toBeGreaterThan(50);

      // Verify GIF89a header
      const headerStr = String.fromCharCode(...gifBytes.slice(0, 6));
      expect(headerStr).toBe("GIF89a");

      // Verify width and height
      const w = gifBytes[6] | (gifBytes[7] << 8);
      const h = gifBytes[8] | (gifBytes[9] << 8);
      expect(w).toBe(width);
      expect(h).toBe(height);

      // Verify trailer ';' (0x3b)
      expect(gifBytes[gifBytes.length - 1]).toBe(0x3b);
    });

    it("should support single frame with custom loop count and delay", () => {
      const width = 8;
      const height = 8;
      const loopCount = 3;
      const encoder = new GifEncoder(width, height, loopCount);

      const frame = new Uint8Array(width * height * 4);
      frame.fill(128);
      encoder.addFrame(frame, 250); // 250ms = 25 in 1/100s

      const gifBytes = encoder.encode();
      expect(gifBytes).toBeInstanceOf(Uint8Array);
      expect(gifBytes.length).toBeGreaterThan(30);

      const headerStr = String.fromCharCode(...gifBytes.slice(0, 6));
      expect(headerStr).toBe("GIF89a");
      expect(gifBytes[gifBytes.length - 1]).toBe(0x3b);
    });

    it("should handle empty or blank frames without throwing", () => {
      const width = 4;
      const height = 4;
      const encoder = new GifEncoder(width, height, 0);

      const blankFrame = new Uint8ClampedArray(width * height * 4);
      encoder.addFrame(blankFrame, 100);

      const gifBytes = encoder.encode();
      expect(gifBytes.byteLength).toBeGreaterThan(0);
      expect(gifBytes[gifBytes.length - 1]).toBe(0x3b);
    });
  });

  describe("MCP Video Recording Tools", () => {
    it("should list video recording tools in tool catalog", async () => {
      const response = await client.listTools();
      const toolNames = response.tools.map((t) => t.name);

      expect(toolNames).toContain("browser_start_recording");
      expect(toolNames).toContain("browser_stop_recording");
      expect(toolNames).toContain("browser_record_animation");
    });

    it("should start and stop continuous video recording (WebM)", async () => {
      const animationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .spinner {
              width: 50px;
              height: 50px;
              background: red;
              animation: spin 0.5s infinite linear;
            }
          </style>
        </head>
        <body>
          <div class="spinner" id="spinner"></div>
          <button id="toggle-btn" onclick="document.body.style.backgroundColor='blue'">Change Color</button>
        </body>
        </html>
      `;

      await client.callTool({
        name: "browser_navigate",
        arguments: {
          url: `data:text/html,${encodeURIComponent(animationHtml)}`,
          snapshot: false,
        },
      });

      // 1. Start recording
      const startRes = (await client.callTool({
        name: "browser_start_recording",
        arguments: {
          fps: 15,
          format: "webm",
          outputPath: testWebmPath,
        },
      })) as any;

      expect(startRes.content).toBeDefined();
      expect(startRes.content[0].text).toContain("Started video recording");

      // Verify active tab status
      const activeTab = await manager.getActiveTab();
      expect(activeTab.isRecording()).toBe(true);

      // 2. Interact during recording
      await new Promise((resolve) => setTimeout(resolve, 150));
      await client.callTool({
        name: "browser_click",
        arguments: { selector: "#toggle-btn" },
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 3. Stop recording
      const stopRes = (await client.callTool({
        name: "browser_stop_recording",
        arguments: {},
      })) as any;

      expect(stopRes.content).toBeDefined();
      const summaryText = stopRes.content[0].text;
      expect(summaryText).toContain("Recording finished successfully");
      expect(summaryText).toContain("WEBM");
      expect(existsSync(testWebmPath)).toBe(true);
      expect(activeTab.isRecording()).toBe(false);
    });

    it("should start and stop continuous recording with format: gif and returnBase64", async () => {
      const colorHtml = `
        <!DOCTYPE html>
        <html>
        <body style="background: green;">
          <h1 id="title">Green Page</h1>
          <button id="btn" onclick="document.body.style.background='purple'">Purple</button>
        </body>
        </html>
      `;

      await client.callTool({
        name: "browser_navigate",
        arguments: {
          url: `data:text/html,${encodeURIComponent(colorHtml)}`,
          snapshot: false,
        },
      });

      // 1. Start GIF recording
      const startRes = (await client.callTool({
        name: "browser_start_recording",
        arguments: {
          fps: 10,
          format: "gif",
          outputPath: testContinuousGifPath,
        },
      })) as any;

      expect(startRes.content[0].text).toContain("GIF");

      // 2. Click button during recording
      await new Promise((resolve) => setTimeout(resolve, 150));
      await client.callTool({
        name: "browser_click",
        arguments: { selector: "#btn" },
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 3. Stop GIF recording with returnBase64
      const stopRes = (await client.callTool({
        name: "browser_stop_recording",
        arguments: { returnBase64: true },
      })) as any;

      expect(stopRes.content).toBeDefined();
      expect(existsSync(testContinuousGifPath)).toBe(true);

      const hasGifImage = stopRes.content.some(
        (c: any) => c.type === "image" && c.mimeType === "image/gif"
      );
      expect(hasGifImage).toBe(true);

      const textItem = stopRes.content.find((c: any) => c.type === "text");
      expect(textItem.text).toContain("GIF");
      expect(textItem.text).toContain("Recording finished successfully");
    });

    it("should record a one-shot animation with durationMs and triggerSelector", async () => {
      const animHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .box {
              width: 60px;
              height: 60px;
              background: green;
              transition: transform 0.3s ease;
            }
            .active {
              transform: translateX(100px) scale(1.2);
            }
          </style>
        </head>
        <body>
          <div id="anim-box" class="box"></div>
          <button id="start-anim" onclick="document.getElementById('anim-box').classList.toggle('active')">Animate</button>
        </body>
        </html>
      `;

      await client.callTool({
        name: "browser_navigate",
        arguments: {
          url: `data:text/html,${encodeURIComponent(animHtml)}`,
          snapshot: false,
        },
      });

      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 300,
          fps: 15,
          format: "gif",
          outputPath: testGifPath,
          triggerSelector: "#start-anim",
          returnBase64: true,
        },
      })) as any;

      expect(res.content).toBeDefined();
      expect(existsSync(testGifPath)).toBe(true);

      const hasImage = res.content.some(
        (c: any) => c.type === "image" && c.mimeType === "image/gif"
      );
      expect(hasImage).toBe(true);

      const textItem = res.content.find((c: any) => c.type === "text");
      expect(textItem.text).toContain("Animation recorded successfully");
      expect(textItem.text).toContain("GIF");
    });

    it("should record animation in WebM format with triggerScript", async () => {
      const scriptHtml = `
        <!DOCTYPE html>
        <html>
        <body style="background: yellow;">
          <h2 id="msg">Initial</h2>
        </body>
        </html>
      `;

      await client.callTool({
        name: "browser_navigate",
        arguments: {
          url: `data:text/html,${encodeURIComponent(scriptHtml)}`,
          snapshot: false,
        },
      });

      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 250,
          fps: 10,
          format: "webm",
          outputPath: testWebmScriptPath,
          triggerScript:
            "document.getElementById('msg').innerText = 'Script Triggered'; document.body.style.background = 'orange';",
        },
      })) as any;

      expect(res.content).toBeDefined();
      expect(existsSync(testWebmScriptPath)).toBe(true);

      const textItem = res.content.find((c: any) => c.type === "text");
      expect(textItem.text).toContain("Animation recorded successfully");
      expect(textItem.text).toContain("WEBM");
    });

    it("should prevent starting a second recording when one is already active", async () => {
      await client.callTool({
        name: "browser_start_recording",
        arguments: { fps: 10, format: "webm" },
      });

      const duplicateStart = (await client.callTool({
        name: "browser_start_recording",
        arguments: { fps: 10, format: "webm" },
      })) as any;

      expect(duplicateStart.isError).toBe(true);
      expect(duplicateStart.content[0].text).toContain("already recording");

      // Stop the first recording cleanly
      await client.callTool({
        name: "browser_stop_recording",
        arguments: {},
      });
    });

    it("should allow specifying savePath dynamically upon stop_recording", async () => {
      await client.callTool({
        name: "browser_start_recording",
        arguments: { fps: 10, format: "webm" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stopRes = (await client.callTool({
        name: "browser_stop_recording",
        arguments: { savePath: testStopOverridePath },
      })) as any;

      expect(stopRes.content).toBeDefined();
      expect(existsSync(testStopOverridePath)).toBe(true);
      expect(stopRes.content[0].text).toContain(testStopOverridePath);
    });

    it("should handle stop_recording error when no active recording exists", async () => {
      const res = (await client.callTool({
        name: "browser_stop_recording",
        arguments: {},
      })) as any;

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("not currently recording");
    });

    it("should cleanly dispose active recording when a tab is closed (RAII)", async () => {
      const tab = await manager.createTab("about:blank");
      await tab.startRecording({ fps: 10, format: "webm" });
      expect(tab.isRecording()).toBe(true);

      // Close tab while recording
      await manager.closeTab(tab.id);
      expect(tab.isRecording()).toBe(false);
    });
  });
});
