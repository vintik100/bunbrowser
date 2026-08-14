import { describe, expect, it, afterAll, beforeAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "../src/server.js";
import { GifEncoder } from "../src/browser/gif_encoder.js";

describe("Video & Animation Recording Module", () => {
  let client: Client;
  let manager: any;

  const testGifPath = resolve(process.cwd(), "test_animation.gif");
  const testWebmPath = resolve(process.cwd(), "test_animation.webm");

  beforeAll(async () => {
    const { server, manager: mgr } = createServer();
    manager = mgr;

    client = new Client(
      { name: "video-test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterAll(async () => {
    if (manager) {
      manager.closeAll();
    }
    // Cleanup generated test files
    if (existsSync(testGifPath)) {
      try { unlinkSync(testGifPath); } catch {}
    }
    if (existsSync(testWebmPath)) {
      try { unlinkSync(testWebmPath); } catch {}
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
        redFrame[i] = 255;   // R
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
  });

  describe("MCP Video Recording Tools", () => {
    it("should list video recording tools in tool catalog", async () => {
      const response = await client.listTools();
      const toolNames = response.tools.map((t) => t.name);

      expect(toolNames).toContain("browser_start_recording");
      expect(toolNames).toContain("browser_stop_recording");
      expect(toolNames).toContain("browser_record_animation");
    });

    it("should start and stop continuous video recording", async () => {
      // 1. Navigate to an animated page
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

      // 2. Start recording
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

      // 3. Interact during recording
      await new Promise((resolve) => setTimeout(resolve, 200));
      await client.callTool({
        name: "browser_click",
        arguments: { selector: "#toggle-btn" },
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 4. Stop recording
      const stopRes = (await client.callTool({
        name: "browser_stop_recording",
        arguments: {},
      })) as any;

      expect(stopRes.content).toBeDefined();
      const summaryText = stopRes.content[0].text;
      expect(summaryText).toContain("Recording finished successfully");
      expect(summaryText).toContain("WEBM");
      expect(existsSync(testWebmPath)).toBe(true);
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
          durationMs: 400,
          fps: 15,
          format: "gif",
          outputPath: testGifPath,
          triggerSelector: "#start-anim",
          returnBase64: true,
        },
      })) as any;

      expect(res.content).toBeDefined();
      expect(existsSync(testGifPath)).toBe(true);

      const hasImage = res.content.some((c: any) => c.type === "image" && c.mimeType === "image/gif");
      expect(hasImage).toBe(true);

      const textItem = res.content.find((c: any) => c.type === "text");
      expect(textItem.text).toContain("Animation recorded successfully");
      expect(textItem.text).toContain("GIF");
    });

    it("should handle stop_recording error when no active recording exists", async () => {
      const res = (await client.callTool({
        name: "browser_stop_recording",
        arguments: {},
      })) as any;

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("not currently recording");
    });
  });
});
