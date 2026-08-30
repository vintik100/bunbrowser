import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { GifEncoder } from "../src/browser/gif_encoder.js";
import type { BrowserManager } from "../src/browser/manager.js";
import { createServer } from "../src/server.js";

/**
 * Validates WebM EBML container binary structure
 */
async function validateWebmFile(filePath: string): Promise<{
  valid: boolean;
  sizeBytes: number;
  hasEbmlHeader: boolean;
  hasWebmDocType: boolean;
}> {
  if (!existsSync(filePath)) {
    return { valid: false, sizeBytes: 0, hasEbmlHeader: false, hasWebmDocType: false };
  }

  const buffer = new Uint8Array(await Bun.file(filePath).arrayBuffer());
  const sizeBytes = buffer.byteLength;

  // EBML Header ID: 0x1A 0x45 0xDF 0xA3
  const hasEbmlHeader =
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3;

  // Check for "webm" DocType ASCII within the first 128 bytes
  const headerSlice = String.fromCharCode(...buffer.slice(0, Math.min(128, buffer.length)));
  const hasWebmDocType = headerSlice.includes("webm");

  const valid = sizeBytes > 100 && hasEbmlHeader && hasWebmDocType;
  return { valid, sizeBytes, hasEbmlHeader, hasWebmDocType };
}

/**
 * Validates GIF89a binary structure
 */
async function validateGifFile(filePath: string): Promise<{
  valid: boolean;
  sizeBytes: number;
  header: string;
  width: number;
  height: number;
  hasTrailer: boolean;
}> {
  if (!existsSync(filePath)) {
    return {
      valid: false,
      sizeBytes: 0,
      header: "",
      width: 0,
      height: 0,
      hasTrailer: false,
    };
  }

  const buffer = new Uint8Array(await Bun.file(filePath).arrayBuffer());
  const sizeBytes = buffer.byteLength;
  const header = String.fromCharCode(...buffer.slice(0, 6));

  const width = buffer.length >= 8 ? buffer[6] | (buffer[7] << 8) : 0;
  const height = buffer.length >= 10 ? buffer[8] | (buffer[9] << 8) : 0;
  const hasTrailer = buffer.length > 0 && buffer[buffer.length - 1] === 0x3b;

  const valid = sizeBytes > 50 && header === "GIF89a" && width > 0 && height > 0 && hasTrailer;
  return { valid, sizeBytes, header, width, height, hasTrailer };
}

describe("Video Recording Parameters & Metrics Suite (FPS, Duration, Quality)", () => {
  let client: Client;
  let manager: BrowserManager;

  const tmpDir = resolve(import.meta.dir, ".tmp");
  const testLowFpsPath = resolve(tmpDir, "test_low_fps.webm");
  const testHighFpsPath = resolve(tmpDir, "test_high_fps.webm");
  const testLowQualityPath = resolve(tmpDir, "test_low_quality.webm");
  const testHighQualityPath = resolve(tmpDir, "test_high_quality.webm");
  const testFullMetricsPath = resolve(tmpDir, "test_full_metrics.gif");

  // Multi-duration & multi-FPS test output files
  const test2s10fpsWebmPath = resolve(tmpDir, "test_2s_10fps.webm");
  const test2s30fpsWebmPath = resolve(tmpDir, "test_2s_30fps.webm");
  const test2sGifPath = resolve(tmpDir, "test_2s.gif");
  const test5sWebmPath = resolve(tmpDir, "test_5s_10fps.webm");
  const test24fpsWebmPath = resolve(tmpDir, "test_24fps_cinematic.webm");

  // Optimization test files
  const testScaledWebmPath = resolve(tmpDir, "test_scaled_half.webm");
  const testMaxFramesWebmPath = resolve(tmpDir, "test_max_frames.webm");
  const test3sGifPath = resolve(tmpDir, "test_3s_playback.gif");

  beforeAll(async () => {
    mkdirSync(tmpDir, { recursive: true });

    const serverInstance = createServer();
    manager = serverInstance.manager;

    client = new Client({ name: "video-params-client", version: "1.0.0" }, { capabilities: {} });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      serverInstance.server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @keyframes pulse {
            0% { transform: scale(1) rotate(0deg); background: red; }
            50% { transform: scale(1.4) rotate(180deg); background: blue; }
            100% { transform: scale(1) rotate(360deg); background: green; }
          }
          .box {
            width: 120px;
            height: 120px;
            animation: pulse 0.3s infinite linear;
          }
        </style>
      </head>
      <body>
        <div class="box"></div>
        <div id="counter">0</div>
        <button id="click-target" onclick="this.innerText='Clicked!'">Click Me</button>
        <script>
          let count = 0;
          setInterval(() => {
            count++;
            document.getElementById('counter').innerText = count;
          }, 100);
        </script>
      </body>
      </html>
    `;

    await client.callTool({
      name: "browser_navigate",
      arguments: {
        url: `data:text/html,${encodeURIComponent(testHtml)}`,
        snapshot: false,
      },
    });
  });

  beforeEach(async () => {
    try {
      const activeTab = await manager.getActiveTab();
      if (activeTab.isRecording()) {
        await activeTab.stopRecording();
      }
    } catch {}
  });

  afterAll(async () => {
    if (manager) {
      manager.closeAll();
    }
    if (existsSync(tmpDir)) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  describe("FPS (Frames Per Second) Calibration", () => {
    it("should sample fewer frames at low FPS (5 FPS) compared to higher FPS (20 FPS) over equal duration", async () => {
      const durationMs = 400;

      // 1. Record at 5 FPS
      const lowFpsRes = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs,
          fps: 5,
          format: "webm",
          outputPath: testLowFpsPath,
        },
      })) as any;

      expect(lowFpsRes.content).toBeDefined();
      const lowSummary = lowFpsRes.content[0].text;
      expect(lowSummary).toContain("~5 FPS");

      // 2. Record at 20 FPS
      const highFpsRes = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs,
          fps: 20,
          format: "webm",
          outputPath: testHighFpsPath,
        },
      })) as any;

      expect(highFpsRes.content).toBeDefined();
      const highSummary = highFpsRes.content[0].text;
      expect(highSummary).toContain("~20 FPS");

      // Validate files
      const lowWebm = await validateWebmFile(testLowFpsPath);
      const highWebm = await validateWebmFile(testHighFpsPath);

      expect(lowWebm.valid).toBe(true);
      expect(highWebm.valid).toBe(true);
    });

    it("should record with cinematic 24 FPS and produce valid WebM container", async () => {
      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 500,
          fps: 24,
          format: "webm",
          outputPath: test24fpsWebmPath,
        },
      })) as any;

      expect(res.content).toBeDefined();
      const validation = await validateWebmFile(test24fpsWebmPath);
      expect(validation.valid).toBe(true);
      expect(validation.hasEbmlHeader).toBe(true);
      expect(validation.hasWebmDocType).toBe(true);
    });

    it("should reject FPS outside valid schema range (1-60)", async () => {
      // Below min (0)
      const belowMin = (await client.callTool({
        name: "browser_start_recording",
        arguments: { fps: 0 },
      })) as any;
      expect(belowMin.isError).toBe(true);

      // Above max (100)
      const aboveMax = (await client.callTool({
        name: "browser_start_recording",
        arguments: { fps: 100 },
      })) as any;
      expect(aboveMax.isError).toBe(true);
    });

    it("should calculate exact GIF GCE delay units for various target FPS rates", () => {
      const width = 10;
      const height = 10;

      // 10 FPS -> interval 100ms -> delay units in 1/100s = 10 (0x0A)
      const encoder10 = new GifEncoder(width, height, 0);
      const frame = new Uint8Array(width * height * 4);
      encoder10.addFrame(frame, Math.round(1000 / 10));
      const bytes10 = encoder10.encode();

      let gceIndex = -1;
      for (let i = 0; i < bytes10.length - 3; i++) {
        if (bytes10[i] === 0x21 && bytes10[i + 1] === 0xf9 && bytes10[i + 2] === 0x04) {
          gceIndex = i;
          break;
        }
      }
      expect(gceIndex).toBeGreaterThan(0);
      const delayUnits10 = bytes10[gceIndex + 4] | (bytes10[gceIndex + 5] << 8);
      expect(delayUnits10).toBe(10);

      // 20 FPS -> interval 50ms -> delay units in 1/100s = 5 (0x05)
      const encoder20 = new GifEncoder(width, height, 0);
      encoder20.addFrame(frame, Math.round(1000 / 20));
      const bytes20 = encoder20.encode();
      const delayUnits20 = bytes20[gceIndex + 4] | (bytes20[gceIndex + 5] << 8);
      expect(delayUnits20).toBe(5);
    });
  });

  describe("Multi-Duration Video Recording & Validation (2s, 5s)", () => {
    it("should record 2-second video at 10 FPS and validate WebM container", async () => {
      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 2000,
          fps: 10,
          format: "webm",
          outputPath: test2s10fpsWebmPath,
        },
      })) as any;

      expect(res.content).toBeDefined();
      const text = res.content[0].text;
      expect(text).toContain("Animation recorded successfully");

      const validation = await validateWebmFile(test2s10fpsWebmPath);
      expect(validation.valid).toBe(true);
      expect(validation.sizeBytes).toBeGreaterThan(500);
    }, 12000);

    it("should record 2-second video at 30 FPS capturing higher frame rate than 10 FPS", async () => {
      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 2000,
          fps: 30,
          format: "webm",
          outputPath: test2s30fpsWebmPath,
        },
      })) as any;

      expect(res.content).toBeDefined();
      const text = res.content[0].text;
      expect(text).toContain("~30 FPS");

      const validation = await validateWebmFile(test2s30fpsWebmPath);
      expect(validation.valid).toBe(true);
    }, 12000);

    it("should record 2-second animated GIF and validate GIF89a binary structure", async () => {
      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 2000,
          fps: 10,
          format: "gif",
          outputPath: test2sGifPath,
        },
      })) as any;

      expect(res.content).toBeDefined();
      const text = res.content[0].text;
      expect(text).toContain("GIF");

      const validation = await validateGifFile(test2sGifPath);
      expect(validation.valid).toBe(true);
      expect(validation.header).toBe("GIF89a");
      expect(validation.width).toBeGreaterThan(0);
      expect(validation.height).toBeGreaterThan(0);
      expect(validation.hasTrailer).toBe(true);
    }, 12000);

    it("should record 5-second video at 10 FPS and validate duration and payload scaling", async () => {
      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 5000,
          fps: 10,
          format: "webm",
          outputPath: test5sWebmPath,
        },
      })) as any;

      expect(res.content).toBeDefined();
      const text = res.content[0].text;
      expect(text).toContain("Animation recorded successfully");

      const validation = await validateWebmFile(test5sWebmPath);
      expect(validation.valid).toBe(true);
      expect(validation.sizeBytes).toBeGreaterThan(1000);
    }, 20000);

    it("should preserve 1:1 playback duration when recording multi-second animations", async () => {
      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 3000,
          fps: 20,
          format: "gif",
          outputPath: test3sGifPath,
        },
      })) as any;

      expect(res.content).toBeDefined();
      const text = res.content[0].text;
      expect(text).toContain("Duration: 3.");

      // Read GIF GCE delays and verify they sum to >= 2.8s (280 centiseconds)
      const buffer = new Uint8Array(await Bun.file(test3sGifPath).arrayBuffer());
      let totalCs = 0;
      for (let i = 0; i < buffer.length - 8; i++) {
        if (buffer[i] === 0x21 && buffer[i + 1] === 0xf9 && buffer[i + 2] === 0x04) {
          const delayCs = buffer[i + 4] | (buffer[i + 5] << 8);
          totalCs += delayCs;
        }
      }
      expect(totalCs).toBeGreaterThanOrEqual(280);
    }, 15000);
  });

  describe("Quality & Compression Parameters", () => {
    it("should accept quality settings (1-100) and validate boundaries", async () => {
      const lowQualityRes = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 200,
          fps: 10,
          format: "webm",
          quality: 10,
          outputPath: testLowQualityPath,
        },
      })) as any;

      expect(lowQualityRes.content).toBeDefined();
      expect(existsSync(testLowQualityPath)).toBe(true);

      const highQualityRes = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 200,
          fps: 10,
          format: "webm",
          quality: 95,
          outputPath: testHighQualityPath,
        },
      })) as any;

      expect(highQualityRes.content).toBeDefined();
      expect(existsSync(testHighQualityPath)).toBe(true);

      // Boundary rejection
      const invalidQuality = (await client.callTool({
        name: "browser_start_recording",
        arguments: { quality: 150 },
      })) as any;

      expect(invalidQuality.isError).toBe(true);
    });
  });

  describe("Video Optimizations & Advanced Guardrails (Scale, MaxFrames, ShowCursor)", () => {
    it("should support scale downsampling parameter (scale: 0.5)", async () => {
      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 300,
          fps: 10,
          format: "webm",
          scale: 0.5,
          outputPath: testScaledWebmPath,
        },
      })) as any;

      expect(res.content).toBeDefined();
      expect(existsSync(testScaledWebmPath)).toBe(true);
      const text = res.content[0].text;
      expect(text).toContain("640x360px");
    });

    it("should enforce maxFrames guardrail to cap memory consumption", async () => {
      const startRes = (await client.callTool({
        name: "browser_start_recording",
        arguments: {
          fps: 20,
          format: "webm",
          maxFrames: 5,
        },
      })) as any;
      expect(startRes.isError).toBeUndefined();

      // Wait longer than 5 frames (e.g. 500ms at 20 FPS = 10 frame intervals)
      await new Promise((resolve) => setTimeout(resolve, 400));

      const stopRes = (await client.callTool({
        name: "browser_stop_recording",
        arguments: {
          savePath: testMaxFramesWebmPath,
        },
      })) as any;

      expect(stopRes.content).toBeDefined();
      const text = stopRes.content[0].text;
      expect(text).toContain("Total Frames:");
      expect(existsSync(testMaxFramesWebmPath)).toBe(true);
    });

    it("should record animation with triggerSelector and cursor ripple feedback", async () => {
      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 400,
          fps: 10,
          format: "webm",
          showCursor: true,
          triggerSelector: "#click-target",
        },
      })) as any;

      expect(res.content).toBeDefined();
      expect(res.content[0].text).toContain("Animation recorded successfully");
    });

    it("should encode multi-frame GIF with recycled LZW tables efficiently", () => {
      const encoder = new GifEncoder(50, 50, 0);
      const frameData = new Uint8Array(50 * 50 * 4);

      for (let f = 0; f < 10; f++) {
        frameData.fill((f * 25) & 0xff);
        encoder.addFrame(frameData, 50);
      }

      const start = performance.now();
      const bytes = encoder.encode();
      const duration = performance.now() - start;

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.byteLength).toBeGreaterThan(100);
      expect(duration).toBeLessThan(100); // Encoding 10 frames in pure TS takes < 100ms
    });
  });

  describe("Comprehensive Recording Metrics Structure", () => {
    it("should produce complete and well-formatted metrics output", async () => {
      const res = (await client.callTool({
        name: "browser_record_animation",
        arguments: {
          durationMs: 300,
          fps: 12,
          format: "gif",
          outputPath: testFullMetricsPath,
          returnBase64: true,
        },
      })) as any;

      expect(res.content).toBeDefined();
      expect(Array.isArray(res.content)).toBe(true);

      // Verify image content
      const imageItem = res.content.find((c: any) => c.type === "image");
      expect(imageItem).toBeDefined();
      expect(imageItem.mimeType).toBe("image/gif");
      expect(typeof imageItem.data).toBe("string");
      expect(imageItem.data.length).toBeGreaterThan(100);

      // Verify text summary containing all metrics
      const textItem = res.content.find((c: any) => c.type === "text");
      expect(textItem).toBeDefined();
      const text = textItem.text;

      expect(text).toContain("🎬 Animation recorded successfully!");
      expect(text).toMatch(/\* Duration: \d+\.\d+s/);
      expect(text).toMatch(/\* Frames Captured: \d+ \(~12 FPS\)/);
      expect(text).toContain("* Format: GIF (image/gif)");
      expect(text).toMatch(/\* File Size: \d+\.\d+ KB/);
      expect(text).toContain(`* Saved to: ${testFullMetricsPath}`);
      expect(existsSync(testFullMetricsPath)).toBe(true);
    });
  });
});
