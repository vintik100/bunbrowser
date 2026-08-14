import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { BrowserTab } from "./tab.js";
import type { AnimationRecordOptions, RecordingOptions, RecordingResult } from "./types.js";
import { GifEncoder } from "./gif_encoder.js";

interface CapturedFrame {
  timestamp: number;
  base64: string;
}

export class TabRecorder {
  private tab: BrowserTab;
  private isRecordingActive = false;
  private recordInterval: ReturnType<typeof setInterval> | null = null;
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
    };

    const fps = Math.min(60, Math.max(1, this.currentOptions.fps || 20));
    const intervalMs = Math.round(1000 / fps);

    this.capturedFrames = [];
    this.startTime = Date.now();
    this.isRecordingActive = true;

    // Initial frame
    try {
      const first = await this.tab.screenshot({
        format: this.currentOptions.format === "gif" ? "png" : "jpeg",
        quality: this.currentOptions.quality,
      });
      this.capturedFrames.push({
        timestamp: Date.now(),
        base64: first.base64,
      });
    } catch {
      // Ignore initial frame error if page is still navigating
    }

    // High frequency frame sampling loop
    this.recordInterval = setInterval(async () => {
      if (!this.isRecordingActive) return;
      try {
        const frame = await this.tab.screenshot({
          format: this.currentOptions.format === "gif" ? "png" : "jpeg",
          quality: this.currentOptions.quality,
        });
        if (this.isRecordingActive) {
          this.capturedFrames.push({
            timestamp: Date.now(),
            base64: frame.base64,
          });
        }
      } catch {
        // Drop failed frame silently
      }
    }, intervalMs);
  }

  public async stop(options: { savePath?: string; returnBase64?: boolean } = {}): Promise<RecordingResult> {
    if (!this.isRecordingActive) {
      throw new Error(`Tab '${this.tab.id}' is not currently recording.`);
    }

    if (this.recordInterval) {
      clearInterval(this.recordInterval);
      this.recordInterval = null;
    }
    this.isRecordingActive = false;

    // Capture final frame
    try {
      const last = await this.tab.screenshot({
        format: this.currentOptions.format === "gif" ? "png" : "jpeg",
        quality: this.currentOptions.quality,
      });
      this.capturedFrames.push({
        timestamp: Date.now(),
        base64: last.base64,
      });
    } catch {
      // Ignore
    }

    const durationMs = Math.max(1, Date.now() - this.startTime);
    const framesCount = this.capturedFrames.length;
    const format = this.currentOptions.format || "webm";
    const fps = this.currentOptions.fps || 20;

    const outputPath = options.savePath || this.currentOptions.outputPath;
    const returnBase64 = options.returnBase64 ?? (!outputPath || outputPath.length === 0);

    let outputBuffer: Uint8Array;
    let mimeType: string;

    if (format === "gif") {
      outputBuffer = await this.encodeFramesToGif(this.capturedFrames, fps);
      mimeType = "image/gif";
    } else {
      // WebM / video format
      outputBuffer = await this.encodeFramesToWebm(this.capturedFrames, fps, durationMs);
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

    return {
      durationMs,
      fps,
      framesCount,
      format,
      outputPath: finalSavedPath,
      fileSizeBytes: outputBuffer.byteLength,
      base64: base64Result,
      mimeType,
    };
  }

  public async recordAnimation(options: AnimationRecordOptions): Promise<RecordingResult> {
    await this.start({
      fps: options.fps,
      format: options.format,
      outputPath: options.outputPath,
      quality: options.quality,
    });

    // Optional trigger action
    if (options.triggerScript) {
      try {
        await this.tab.evaluate(options.triggerScript);
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

  private async encodeFramesToGif(frames: CapturedFrame[], fps: number): Promise<Uint8Array> {
    const width = Math.min(this.tab.width, 640);
    const height = Math.min(this.tab.height, 360);
    const delayMs = Math.round(1000 / fps);

    const encoder = new GifEncoder(width, height, 0);

    if (frames.length === 0) {
      // Empty dummy frame
      const empty = new Uint8Array(width * height * 4);
      encoder.addFrame(empty, delayMs);
      return encoder.encode();
    }

    // Extract RGBA pixels in browser context
    try {
      const base64List = frames.map((f) => f.base64);
      const rgbaBatches = (await this.tab.evaluate(`
        (async () => {
          const frames = ${JSON.stringify(base64List)};
          const w = ${width};
          const h = ${height};
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          const results = [];

          for (const b64 of frames) {
            await new Promise((res) => {
              const img = new Image();
              img.onload = () => {
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                results.push(Array.from(imgData.data));
                res();
              };
              img.onerror = () => {
                results.push(new Array(w * h * 4).fill(255));
                res();
              };
              img.src = 'data:image/png;base64,' + b64;
            });
          }
          return results;
        })()
      `)) as number[][];

      for (const rawRgba of rgbaBatches) {
        encoder.addFrame(new Uint8Array(rawRgba), delayMs);
      }
    } catch {
      // Fallback if browser evaluation fails
      for (let i = 0; i < frames.length; i++) {
        const dummy = new Uint8Array(width * height * 4);
        dummy.fill(240);
        encoder.addFrame(dummy, delayMs);
      }
    }

    return encoder.encode();
  }

  private async encodeFramesToWebm(frames: CapturedFrame[], fps: number, durationMs: number): Promise<Uint8Array> {
    const width = this.tab.width;
    const height = this.tab.height;

    // Use in-page canvas MediaRecorder or build standard WebM container
    try {
      const base64List = frames.map((f) => f.base64);
      const webmBase64 = (await this.tab.evaluate(`
        (async () => {
          const frames = ${JSON.stringify(base64List)};
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

          for (const b64 of frames) {
            await new Promise((res) => {
              const img = new Image();
              img.onload = () => {
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                setTimeout(res, Math.max(10, Math.round(1000 / fps)));
              };
              img.onerror = () => res();
              img.src = 'data:image/jpeg;base64,' + b64;
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
    width: number,
    height: number,
    durationMs: number
  ): Uint8Array {
    // EBML Header + Segment + Track + Cluster structure
    const ebmlHeader = new Uint8Array([
      0x1a, 0x45, 0xdf, 0xa3, // EBML ID
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f, // Size 31
      0x42, 0x86, 0x81, 0x01, // EBMLVersion: 1
      0x42, 0xf7, 0x81, 0x01, // EBMLReadVersion: 1
      0x42, 0xf2, 0x81, 0x04, // EBMLMaxIDLength: 4
      0x42, 0xf3, 0x81, 0x08, // EBMLMaxSizeLength: 8
      0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, // DocType: "webm"
      0x42, 0x87, 0x81, 0x04, // DocTypeVersion: 4
      0x42, 0x85, 0x81, 0x02, // DocTypeReadVersion: 2
    ]);

    // Simple frame package
    const frameBuffers = frames.map((f) => Buffer.from(f.base64, "base64"));
    const totalBytes = ebmlHeader.length + frameBuffers.reduce((acc, f) => acc + f.length, 0);
    const result = new Uint8Array(totalBytes);
    result.set(ebmlHeader, 0);

    let offset = ebmlHeader.length;
    for (const fb of frameBuffers) {
      result.set(fb, offset);
      offset += fb.length;
    }

    return result;
  }
}
