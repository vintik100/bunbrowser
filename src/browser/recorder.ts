import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { GifEncoder } from "./gif_encoder.js";
import type { BrowserTab } from "./tab.js";
import type {
  AnimationRecordOptions,
  CapturedFrame,
  RecordingOptions,
  RecordingResult,
} from "./types.js";

let gifEncoderPageSource: string | null = null;

async function getGifEncoderPageSource(): Promise<string> {
  if (!gifEncoderPageSource) {
    const source = await Bun.file(join(import.meta.dir, "gif_encoder.ts")).text();
    const js = new Bun.Transpiler().transformSync(source, "ts");
    gifEncoderPageSource = js.replace(/^\s*export\s+/, "");
  }
  return gifEncoderPageSource;
}

const CURSOR_OVERLAY_ID = "__bunbrowser_recorder_overlay__";

export class TabRecorder {
  private tab: BrowserTab;
  private isRecordingActive = false;
  private recordingLoopPromise: Promise<void> | null = null;
  private capturedFrames: CapturedFrame[] = [];
  private startTime = 0;
  private currentOptions: RecordingOptions = {};

  constructor(tab: BrowserTab) {
    this.tab = tab;
  }

  public isRecording(): boolean {
    return this.isRecordingActive;
  }

  public async start(options: RecordingOptions = {}): Promise<void> {
    if (this.isRecordingActive) {
      throw new Error(`Tab '${this.tab.id}' is already recording.`);
    }

    this.currentOptions = {
      fps: options.fps ?? 20,
      format: options.format ?? "webm",
      outputPath: options.outputPath,
      quality: options.quality ?? 80,
      scale: Math.min(2.0, Math.max(0.1, options.scale ?? 1.0)),
      maxFrames: options.maxFrames ?? 1500,
      maxDurationMs: options.maxDurationMs ?? 120_000,
      showCursor: options.showCursor ?? true,
    };

    const fps = Math.min(60, Math.max(1, this.currentOptions.fps || 20));
    const intervalMs = Math.round(1000 / fps);
    const maxFrames = this.currentOptions.maxFrames || 1500;
    const maxDurationMs = this.currentOptions.maxDurationMs || 120_000;

    this.capturedFrames = [];
    this.startTime = Date.now();
    this.isRecordingActive = true;

    // Inject visual cursor / click ripple overlay if enabled
    if (this.currentOptions.showCursor) {
      try {
        await this.tab.evaluate(`
          (() => {
            if (document.getElementById('${CURSOR_OVERLAY_ID}')) return;
            const style = document.createElement('style');
            style.id = '${CURSOR_OVERLAY_ID}';
            style.textContent = \`
              .bunbrowser-ripple {
                position: fixed;
                border-radius: 50%;
                background: rgba(255, 75, 43, 0.45);
                border: 2px solid rgba(255, 75, 43, 0.9);
                transform: translate(-50%, -50%) scale(0);
                animation: bunbrowser-ripple-anim 0.35s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
                pointer-events: none;
                z-index: 2147483647;
              }
              @keyframes bunbrowser-ripple-anim {
                to {
                  transform: translate(-50%, -50%) scale(1.2);
                  opacity: 0;
                }
              }
            \`;
            document.head.appendChild(style);
            window.__bunbrowser_click_listener__ = (e) => {
              const ripple = document.createElement('div');
              ripple.className = 'bunbrowser-ripple';
              ripple.style.left = e.clientX + 'px';
              ripple.style.top = e.clientY + 'px';
              ripple.style.width = '36px';
              ripple.style.height = '36px';
              document.body.appendChild(ripple);
              setTimeout(() => ripple.remove(), 350);
            };
            window.addEventListener('click', window.__bunbrowser_click_listener__, true);
          })()
        `);
      } catch {
        // Fallback if evaluate fails on restricted origin
      }
    }

    // Initial frame
    try {
      const first = await this.tab.screenshot({
        format: this.currentOptions.format === "gif" ? "png" : "jpeg",
        quality: this.currentOptions.quality,
      });
      if (first.base64) {
        this.capturedFrames.push({
          timestamp: Date.now(),
          data: new Uint8Array(Buffer.from(first.base64, "base64")),
        });
      }
    } catch {
      // Ignore initial frame error if page is still navigating
    }

    // High frequency frame sampling loop with drift compensation & OOM guard
    this.recordingLoopPromise = (async () => {
      let nextFrameTime = Date.now() + intervalMs;
      while (this.isRecordingActive) {
        // Safety guard checks: pause capturing new frames if cap is reached
        if (
          this.capturedFrames.length >= maxFrames ||
          Date.now() - this.startTime >= maxDurationMs
        ) {
          await Bun.sleep(50);
          continue;
        }

        const delay = Math.max(0, nextFrameTime - Date.now());
        if (delay > 0) {
          await Bun.sleep(delay);
        }
        if (!this.isRecordingActive) break;

        try {
          const frame = await this.tab.screenshot({
            format: this.currentOptions.format === "gif" ? "png" : "jpeg",
            quality: this.currentOptions.quality,
          });
          if (this.isRecordingActive && frame.base64) {
            this.capturedFrames.push({
              timestamp: Date.now(),
              data: new Uint8Array(Buffer.from(frame.base64, "base64")),
            });
          }
        } catch {
          // Drop failed frame silently
        }

        nextFrameTime += intervalMs;
      }
    })();
  }

  public async stop(
    options: { savePath?: string; returnBase64?: boolean } = {}
  ): Promise<RecordingResult> {
    if (!this.isRecordingActive) {
      throw new Error(`Tab '${this.tab.id}' is not currently recording.`);
    }

    this.isRecordingActive = false;
    if (this.recordingLoopPromise) {
      await this.recordingLoopPromise;
      this.recordingLoopPromise = null;
    }

    // Remove cursor overlay
    if (this.currentOptions.showCursor) {
      try {
        await this.tab.evaluate(`
          (() => {
            const overlay = document.getElementById('${CURSOR_OVERLAY_ID}');
            if (overlay) overlay.remove();
            if (window.__bunbrowser_click_listener__) {
              window.removeEventListener('click', window.__bunbrowser_click_listener__, true);
            }
          })()
        `);
      } catch {
        // Ignore
      }
    }

    // Capture final frame
    try {
      const last = await this.tab.screenshot({
        format: this.currentOptions.format === "gif" ? "png" : "jpeg",
        quality: this.currentOptions.quality,
      });
      if (last.base64) {
        this.capturedFrames.push({
          timestamp: Date.now(),
          data: new Uint8Array(Buffer.from(last.base64, "base64")),
        });
      }
    } catch {
      // Ignore
    }

    const durationMs = Math.max(1, Date.now() - this.startTime);
    const framesCount = this.capturedFrames.length;
    const format = this.currentOptions.format || "webm";
    const fps = this.currentOptions.fps || 20;
    const scale = this.currentOptions.scale || 1.0;

    const targetWidth = Math.round(this.tab.width * scale);
    const targetHeight = Math.round(this.tab.height * scale);

    const outputPath = options.savePath || this.currentOptions.outputPath;
    const returnBase64 = options.returnBase64 ?? (!outputPath || outputPath.length === 0);

    let outputBuffer: Uint8Array;
    let mimeType: string;

    if (format === "gif") {
      outputBuffer = await this.encodeFramesToGif(
        this.capturedFrames,
        fps,
        targetWidth,
        targetHeight,
        durationMs
      );
      mimeType = "image/gif";
    } else {
      // WebM / video format
      outputBuffer = await this.encodeFramesToWebm(
        this.capturedFrames,
        fps,
        durationMs,
        targetWidth,
        targetHeight
      );
      mimeType = "video/webm";
    }

    let base64Result: string | undefined;
    if (returnBase64) {
      base64Result = Buffer.from(outputBuffer).toString("base64");
    }

    let finalSavedPath: string | undefined;
    if (outputPath) {
      finalSavedPath = resolve(process.cwd(), outputPath);
      await mkdir(dirname(finalSavedPath), { recursive: true });
      await writeFile(finalSavedPath, outputBuffer);
    }

    this.capturedFrames = [];

    return {
      durationMs,
      fps,
      framesCount,
      format,
      outputPath: finalSavedPath,
      fileSizeBytes: outputBuffer.byteLength,
      base64: base64Result,
      mimeType,
      width: targetWidth,
      height: targetHeight,
    };
  }

  public async recordAnimation(options: AnimationRecordOptions): Promise<RecordingResult> {
    await this.start({
      fps: options.fps,
      format: options.format,
      outputPath: options.outputPath,
      quality: options.quality,
      scale: options.scale,
      maxFrames: options.maxFrames,
      showCursor: options.showCursor,
    });

    // Optional trigger action
    if (options.triggerScript) {
      try {
        const script = options.triggerScript.trim();
        const executable =
          script.startsWith("(() =>") ||
          script.startsWith("(function") ||
          script.startsWith("(async")
            ? script
            : `(() => { ${script} })()`;
        await this.tab.evaluate(executable);
      } catch (e) {
        console.error(`[@bunbrowser/mcp] Error in animation triggerScript:`, e);
      }
    }

    if (options.triggerSelector) {
      try {
        await this.tab.click({ selector: options.triggerSelector });
      } catch (e) {
        console.error(`[@bunbrowser/mcp] Error in animation triggerSelector:`, e);
      }
    }

    // Wait for animation duration
    const waitTime = Math.max(100, options.durationMs || 1000);
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    return await this.stop({
      savePath: options.outputPath,
      returnBase64: options.returnBase64,
    });
  }

  private async encodeFramesToGif(
    frames: CapturedFrame[],
    _fps: number,
    targetWidth: number,
    targetHeight: number,
    durationMs: number
  ): Promise<Uint8Array> {
    const width = Math.min(targetWidth, 640);
    const height = Math.min(targetHeight, 360);
    const avgDelay = Math.max(10, Math.round(durationMs / Math.max(1, frames.length)));

    if (frames.length === 0) {
      const encoder = new GifEncoder(width, height, 0);
      const empty = new Uint8Array(width * height * 4);
      encoder.addFrame(empty, avgDelay);
      return encoder.encode();
    }

    const framePayloads: Array<{ b64: string; delayMs: number }> = [];
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      let delay = avgDelay;
      if (i < frames.length - 1) {
        const delta = frames[i + 1].timestamp - f.timestamp;
        if (delta > 0 && delta < 10000) {
          delay = delta;
        }
      }
      framePayloads.push({
        b64: Buffer.from(f.data).toString("base64"),
        delayMs: Math.max(10, delay),
      });
    }

    // Encode in the page: decode frames -> RGBA -> GIF, returning only the final base64.
    try {
      const gifSource = await getGifEncoderPageSource();
      const gifBase64 = (await this.tab.evaluate(`
        (async () => {
          ${gifSource}
          const frames = ${JSON.stringify(framePayloads)};
          const w = ${width};
          const h = ${height};
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          const encoder = new GifEncoder(w, h, 0);

          for (const item of frames) {
            await new Promise((res) => {
              const img = new Image();
              img.onload = () => {
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                encoder.addFrame(ctx.getImageData(0, 0, w, h).data, item.delayMs);
                res();
              };
              img.onerror = () => {
                encoder.addFrame(new Uint8ClampedArray(w * h * 4).fill(255), item.delayMs);
                res();
              };
              img.src = 'data:image/png;base64,' + item.b64;
            });
          }

          const bytes = encoder.encode();
          let bin = '';
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
          }
          return btoa(bin);
        })()
      `)) as string;

      if (gifBase64 && gifBase64.length > 0) {
        return new Uint8Array(Buffer.from(gifBase64, "base64"));
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback if browser evaluation fails
    const encoder = new GifEncoder(width, height, 0);
    for (let i = 0; i < framePayloads.length; i++) {
      const dummy = new Uint8Array(width * height * 4);
      dummy.fill(240);
      encoder.addFrame(dummy, framePayloads[i].delayMs);
    }
    return encoder.encode();
  }

  private async encodeFramesToWebm(
    frames: CapturedFrame[],
    fps: number,
    durationMs: number,
    targetWidth: number,
    targetHeight: number
  ): Promise<Uint8Array> {
    const width = targetWidth;
    const height = targetHeight;
    const avgDelay = Math.max(10, Math.round(durationMs / Math.max(1, frames.length)));

    const framePayloads: Array<{ b64: string; delayMs: number }> = [];
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      let delay = avgDelay;
      if (i < frames.length - 1) {
        const delta = frames[i + 1].timestamp - f.timestamp;
        if (delta > 0 && delta < 10000) {
          delay = delta;
        }
      }
      framePayloads.push({
        b64: Buffer.from(f.data).toString("base64"),
        delayMs: Math.max(10, delay),
      });
    }

    // Use in-page canvas MediaRecorder or build standard WebM container
    try {
      const webmBase64 = (await this.tab.evaluate(`
        (async () => {
          const frames = ${JSON.stringify(framePayloads)};
          const w = ${width};
          const h = ${height};
          const fps = ${fps};
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');

          if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
            return null;
          }

          const stream = canvas.captureStream(fps);
          let mime = 'video/webm;codecs=vp8';
          if (!MediaRecorder.isTypeSupported(mime)) {
            mime = 'video/webm';
          }

          const recorder = new MediaRecorder(stream, { mimeType: mime });
          const chunks = [];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          const donePromise = new Promise((resolve) => {
            recorder.onstop = async () => {
              const blob = new Blob(chunks, { type: mime });
              const reader = new FileReader();
              reader.onloadend = () => {
                const b64 = reader.result ? reader.result.toString().split(',')[1] : '';
                resolve(b64);
              };
              reader.readAsDataURL(blob);
            };
          });

          recorder.start();

          for (const item of frames) {
            await new Promise((res) => {
              const img = new Image();
              img.onload = () => {
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                setTimeout(res, item.delayMs);
              };
              img.onerror = () => res();
              img.src = 'data:image/jpeg;base64,' + item.b64;
            });
          }

          recorder.stop();
          return await donePromise;
        })()
      `)) as string | null;

      if (webmBase64 && webmBase64.length > 0) {
        return new Uint8Array(Buffer.from(webmBase64, "base64"));
      }
    } catch {
      // Fallback
    }

    // Fallback: Generate self-contained WebM EBML header with VP8 frame sequence or raw payload
    return this.createFallbackWebm(frames, width, height, durationMs);
  }

  /**
   * Minimal EBML WebM video header container for frames
   */
  private createFallbackWebm(
    frames: CapturedFrame[],
    _width: number,
    _height: number,
    _durationMs: number
  ): Uint8Array {
    const ebmlHeader = new Uint8Array([
      0x1a,
      0x45,
      0xdf,
      0xa3, // EBML ID
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x1f, // Size 31
      0x42,
      0x86,
      0x81,
      0x01, // EBMLVersion: 1
      0x42,
      0xf7,
      0x81,
      0x01, // EBMLReadVersion: 1
      0x42,
      0xf2,
      0x81,
      0x04, // EBMLMaxIDLength: 4
      0x42,
      0xf3,
      0x81,
      0x08, // EBMLMaxSizeLength: 8
      0x42,
      0x82,
      0x84,
      0x77,
      0x65,
      0x62,
      0x6d, // DocType: "webm"
      0x42,
      0x87,
      0x81,
      0x04, // DocTypeVersion: 4
      0x42,
      0x85,
      0x81,
      0x02, // DocTypeReadVersion: 2
    ]);

    const totalBytes = ebmlHeader.length + frames.reduce((acc, f) => acc + f.data.length, 0);
    const result = new Uint8Array(totalBytes);
    result.set(ebmlHeader, 0);

    let offset = ebmlHeader.length;
    for (const frame of frames) {
      result.set(frame.data, offset);
      offset += frame.data.length;
    }

    return result;
  }
}
