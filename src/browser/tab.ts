import { TabRecorder } from "./recorder.js";
import { resolveTarget, SNAPSHOT_SCRIPT } from "./snapshot.js";
import type {
  AnimationRecordOptions,
  ClickOptions,
  ConsoleLogEntry,
  ElementTarget,
  KeyModifier,
  RecordingOptions,
  RecordingResult,
  ScreenshotOptions,
  ScreenshotResult,
  ScrollOptions,
  SnapshotResult,
  TabInfo,
  TypeOptions,
} from "./types.js";

export interface CreateTabOptions {
  id?: string;
  width?: number;
  height?: number;
  url?: string;
  backend?: "chrome" | "webkit" | Record<string, any>;
  dataStore?: "ephemeral" | { directory: string };
}

export class BrowserTab {
  public readonly id: string;
  public width: number;
  public height: number;
  public readonly view: InstanceType<typeof Bun.WebView>;
  private consoleLogs: ConsoleLogEntry[] = [];
  private maxLogs = 500;
  private isClosed = false;
  private recorder: TabRecorder;

  constructor(options: CreateTabOptions = {}) {
    this.id = options.id || `tab_${Math.random().toString(36).substring(2, 9)}`;
    this.width = options.width || 1280;
    this.height = options.height || 720;

    const webviewOptions: any = {
      width: this.width,
      height: this.height,
      console: (type: string, ...args: any[]) => {
        this.addLog(type, args);
      },
    };

    if (options.backend) {
      webviewOptions.backend = options.backend;
    }

    if (options.dataStore) {
      webviewOptions.dataStore = options.dataStore;
    }

    this.view = new Bun.WebView(webviewOptions);
    this.recorder = new TabRecorder(this);
  }

  private addLog(type: string, args: any[]) {
    const text = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
      .join(" ");

    this.consoleLogs.push({
      timestamp: Date.now(),
      type,
      text,
    });

    if (this.consoleLogs.length > this.maxLogs) {
      this.consoleLogs.shift();
    }
  }

  public get url(): string {
    return this.view.url || "";
  }

  public get title(): string {
    return this.view.title || "";
  }

  public get loading(): boolean {
    return this.view.loading;
  }

  public getInfo(isActive = false): TabInfo {
    return {
      id: this.id,
      url: this.url,
      title: this.title,
      loading: this.loading,
      viewport: {
        width: this.width,
        height: this.height,
      },
      isActive,
    };
  }

  public async navigate(url: string, timeoutMs?: number): Promise<{ url: string; title: string }> {
    this.ensureActive();

    let targetUrl = url.trim();
    if (
      !targetUrl.startsWith("http://") &&
      !targetUrl.startsWith("https://") &&
      !targetUrl.startsWith("data:") &&
      !targetUrl.startsWith("file://") &&
      !targetUrl.startsWith("about:")
    ) {
      targetUrl = `https://${targetUrl}`;
    }

    if (timeoutMs && timeoutMs > 0) {
      await Promise.race([
        this.view.navigate(targetUrl),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Navigation timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
    } else {
      await this.view.navigate(targetUrl);
    }

    return {
      url: this.url,
      title: this.title,
    };
  }

  public async goBack(): Promise<{ url: string; title: string }> {
    this.ensureActive();
    if (typeof (this.view as any).back === "function") {
      await (this.view as any).back();
    } else if (typeof (this.view as any).goBack === "function") {
      await (this.view as any).goBack();
    }
    return { url: this.url, title: this.title };
  }

  public async goForward(): Promise<{ url: string; title: string }> {
    this.ensureActive();
    if (typeof (this.view as any).forward === "function") {
      await (this.view as any).forward();
    } else if (typeof (this.view as any).goForward === "function") {
      await (this.view as any).goForward();
    }
    return { url: this.url, title: this.title };
  }

  public async reload(): Promise<{ url: string; title: string }> {
    this.ensureActive();
    await this.view.reload();
    return { url: this.url, title: this.title };
  }

  public async snapshot(): Promise<SnapshotResult> {
    this.ensureActive();
    const result = (await this.view.evaluate(SNAPSHOT_SCRIPT)) as SnapshotResult;
    return result;
  }

  public async screenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    this.ensureActive();
    const format = options.format || "png";
    const quality = options.quality ?? 80;

    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    const mimeType = mimeMap[format] || "image/png";

    if (options.outputPath) {
      const blob = (await this.view.screenshot({
        format,
        quality,
        encoding: "blob",
      })) as Blob;
      await Bun.write(options.outputPath, blob);
      return {
        mimeType,
        outputPath: options.outputPath,
        fileSizeBytes: blob.size,
      };
    }

    const base64 = (await this.view.screenshot({
      format,
      quality,
      encoding: "base64",
    })) as string;

    return {
      base64,
      mimeType,
    };
  }

  public async click(target: ElementTarget, options: ClickOptions = {}): Promise<void> {
    this.ensureActive();
    const resolved = resolveTarget(target);

    const clickOpts: any = {};
    if (options.button) clickOpts.button = options.button;
    if (options.clickCount) clickOpts.clickCount = options.clickCount;
    if (options.modifiers) clickOpts.modifiers = options.modifiers;
    if (options.timeout) clickOpts.timeout = options.timeout;

    if (resolved.selector) {
      await this.view.click(resolved.selector, clickOpts);
    } else if (typeof resolved.x === "number" && typeof resolved.y === "number") {
      await this.view.click(resolved.x, resolved.y, clickOpts);
    }
  }

  public async type(target: ElementTarget, text: string, options: TypeOptions = {}): Promise<void> {
    this.ensureActive();
    const resolved = resolveTarget(target);

    if (resolved.selector) {
      await this.view.click(resolved.selector);
      if (options.clear) {
        await this.view.evaluate(`
          (() => {
            const el = document.querySelector(${JSON.stringify(resolved.selector)});
            if (el) {
              if (el.value !== undefined) el.value = '';
              else el.innerText = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          })()
        `);
      }
    } else if (typeof resolved.x === "number" && typeof resolved.y === "number") {
      await this.view.click(resolved.x, resolved.y);
    }

    await this.view.type(text);
  }

  public async fillForm(
    fields: Array<{ target: ElementTarget; value: string; clear?: boolean }>
  ): Promise<void> {
    this.ensureActive();
    for (const field of fields) {
      await this.type(field.target, field.value, { clear: field.clear ?? true });
    }
  }

  public async pressKey(key: string, modifiers?: KeyModifier[]): Promise<void> {
    this.ensureActive();
    if (modifiers && modifiers.length > 0) {
      await this.view.press(key, { modifiers });
    } else {
      await this.view.press(key);
    }
  }

  public async hover(target: ElementTarget): Promise<void> {
    this.ensureActive();
    const resolved = resolveTarget(target);

    if (resolved.selector) {
      await this.view.scrollTo(resolved.selector);
      await this.view.evaluate(`
        (() => {
          const el = document.querySelector(${JSON.stringify(resolved.selector)});
          if (el) {
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
          }
        })()
      `);
    } else if (typeof resolved.x === "number" && typeof resolved.y === "number") {
      await this.view.evaluate(`
        (() => {
          const el = document.elementFromPoint(${resolved.x}, ${resolved.y});
          if (el) {
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: ${resolved.x}, clientY: ${resolved.y} }));
            el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${resolved.x}, clientY: ${resolved.y} }));
          }
        })()
      `);
    }
  }

  public async scroll(options: ScrollOptions = {}): Promise<void> {
    this.ensureActive();

    if (options.ref || options.selector) {
      const resolved = resolveTarget({ ref: options.ref, selector: options.selector });
      if (resolved.selector) {
        await this.view.scrollTo(resolved.selector, { block: options.block || "center" });
        return;
      }
    }

    if (options.direction) {
      switch (options.direction) {
        case "top":
          await this.view.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })");
          return;
        case "bottom":
          await this.view.evaluate(
            "window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })"
          );
          return;
        case "up":
          await this.view.scroll(0, -Math.floor(this.height * 0.75));
          return;
        case "down":
          await this.view.scroll(0, Math.floor(this.height * 0.75));
          return;
      }
    }

    const dx = options.deltaX ?? 0;
    const dy =
      options.deltaY ??
      (options.direction === "down" ? 300 : options.direction === "up" ? -300 : 0);
    await this.view.scroll(dx, dy);
  }

  public async selectOption(target: ElementTarget, values: string | string[]): Promise<void> {
    this.ensureActive();
    const resolved = resolveTarget(target);
    if (!resolved.selector) throw new Error("Select target requires a selector or ref");

    const valArray = Array.isArray(values) ? values : [values];
    await this.view.evaluate(`
      (() => {
        const select = document.querySelector(${JSON.stringify(resolved.selector)});
        if (!select || select.tagName.toLowerCase() !== 'select') {
          throw new Error('Element is not a <select>');
        }
        const targetValues = ${JSON.stringify(valArray)};
        let changed = false;
        for (const opt of Array.from(select.options)) {
          const match = targetValues.includes(opt.value) || targetValues.includes(opt.text.trim());
          if (opt.selected !== match) {
            opt.selected = match;
            changed = true;
          }
        }
        if (changed) {
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
  }

  public async drag(sourceTarget: ElementTarget, destTarget: ElementTarget): Promise<void> {
    this.ensureActive();
    const src = resolveTarget(sourceTarget);
    const dst = resolveTarget(destTarget);

    if (!src.selector || !dst.selector) {
      throw new Error("Drag and drop requires selectors or refs for both source and target");
    }

    await this.view.evaluate(`
      (() => {
        const srcEl = document.querySelector(${JSON.stringify(src.selector)});
        const dstEl = document.querySelector(${JSON.stringify(dst.selector)});
        if (!srcEl || !dstEl) throw new Error('Drag source or destination not found');

        const dataTransfer = new DataTransfer();
        srcEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
        dstEl.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer }));
        dstEl.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
        dstEl.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
        srcEl.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
      })()
    `);
  }

  public async evaluate(expression: string): Promise<any> {
    this.ensureActive();
    return await this.view.evaluate(expression);
  }

  public async getContent(format: "html" | "text" = "html"): Promise<string> {
    this.ensureActive();
    if (format === "text") {
      return (await this.view.evaluate("document.body ? document.body.innerText : ''")) as string;
    }
    return (await this.view.evaluate(
      "document.documentElement ? document.documentElement.outerHTML : ''"
    )) as string;
  }

  public getLogs(clear = false): ConsoleLogEntry[] {
    const logs = [...this.consoleLogs];
    if (clear) {
      this.consoleLogs = [];
    }
    return logs;
  }

  public async resize(width: number, height: number): Promise<void> {
    this.ensureActive();
    await this.view.resize(width, height);
    this.width = width;
    this.height = height;
  }

  public async cdp(method: string, params?: Record<string, any>): Promise<any> {
    this.ensureActive();
    if (typeof (this.view as any).cdp !== "function") {
      throw new Error("CDP is only available with Chrome/Chromium backend");
    }
    return await (this.view as any).cdp(method, params);
  }

  public async getCookies(): Promise<any> {
    this.ensureActive();
    try {
      const result = await this.cdp("Network.getCookies");
      return result.cookies || [];
    } catch {
      // Fallback for document.cookie in JS
      const cookieStr = (await this.view.evaluate("document.cookie")) as string;
      return cookieStr.split(";").map((c) => {
        const [name, ...val] = c.trim().split("=");
        return { name, value: val.join("=") };
      });
    }
  }

  public async setCookie(cookie: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }): Promise<void> {
    this.ensureActive();
    try {
      await this.cdp("Network.setCookie", {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || new URL(this.url).hostname,
        path: cookie.path || "/",
      });
    } catch {
      await this.view.evaluate(`
        (() => {
          document.cookie = ${JSON.stringify(`${cookie.name}=${cookie.value}; path=${cookie.path || "/"}`)};
        })()
      `);
    }
  }

  public async clearCookies(): Promise<void> {
    this.ensureActive();
    try {
      await this.cdp("Network.clearBrowserCookies");
    } catch {
      await this.view.evaluate(`
        (() => {
          const cookies = document.cookie.split(";");
          for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          }
        })()
      `);
    }
  }

  public async getLocalStorage(): Promise<Record<string, string>> {
    this.ensureActive();
    return (await this.view.evaluate(`
      (() => {
        const storage = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) storage[key] = localStorage.getItem(key);
        }
        return storage;
      })()
    `)) as Record<string, string>;
  }

  public async setLocalStorage(key: string, value: string): Promise<void> {
    this.ensureActive();
    await this.view.evaluate(`
      (() => {
        localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});
      })()
    `);
  }

  public async startRecording(options?: RecordingOptions): Promise<void> {
    this.ensureActive();
    await this.recorder.start(options);
  }

  public async stopRecording(options?: {
    savePath?: string;
    returnBase64?: boolean;
  }): Promise<RecordingResult> {
    this.ensureActive();
    return await this.recorder.stop(options);
  }

  public async recordAnimation(options: AnimationRecordOptions): Promise<RecordingResult> {
    this.ensureActive();
    return await this.recorder.recordAnimation(options);
  }

  public isRecording(): boolean {
    return this.recorder.isRecording();
  }

  public close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    if (this.recorder.isRecording()) {
      this.recorder.stop().catch(() => {});
    }
    try {
      this.view.close();
    } catch {}
  }

  private ensureActive() {
    if (this.isClosed) {
      throw new Error(`Tab '${this.id}' has been closed.`);
    }
  }
}
