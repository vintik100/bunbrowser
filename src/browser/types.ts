export type KeyModifier = "Shift" | "Control" | "Alt" | "Meta";

export interface ClickOptions {
  button?: "left" | "right" | "middle";
  clickCount?: number;
  modifiers?: KeyModifier[];
  timeout?: number;
}

export interface TypeOptions {
  clear?: boolean;
  delayMs?: number;
}

export interface ScrollOptions {
  direction?: "up" | "down" | "top" | "bottom";
  deltaX?: number;
  deltaY?: number;
  ref?: string;
  selector?: string;
  block?: "start" | "center" | "end" | "nearest";
}

export interface ConsoleLogEntry {
  timestamp: number;
  type: string;
  text: string;
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  viewport: {
    width: number;
    height: number;
  };
  isActive: boolean;
}

export interface SnapshotNode {
  tag?: string;
  role?: string;
  ref?: string;
  name?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  selected?: boolean;
  required?: boolean;
  readonly?: boolean;
  type?: string;
  text?: string;
  children?: SnapshotNode[];
}

export interface SnapshotResult {
  url: string;
  title: string;
  treeText: string;
  elementsCount: number;
  rawTree?: SnapshotNode;
}

export interface ScreenshotOptions {
  format?: "png" | "jpeg" | "webp";
  quality?: number;
  outputPath?: string;
}

export interface ScreenshotResult {
  base64?: string;
  data?: Uint8Array;
  mimeType: string;
  outputPath?: string;
  fileSizeBytes?: number;
}

export interface BrowserConfig {
  defaultWidth?: number;
  defaultHeight?: number;
  backend?: "chrome" | "webkit" | Record<string, any>;
  dataStore?: "ephemeral" | { directory: string };
  initialUrl?: string;
}

export interface ElementTarget {
  ref?: string;
  selector?: string;
  x?: number;
  y?: number;
}

export interface CapturedFrame {
  timestamp: number;
  data: Uint8Array;
  mimeType?: string;
}

export interface RecordingOptions {
  fps?: number;
  format?: "webm" | "gif";
  outputPath?: string;
  quality?: number;
  scale?: number;
  maxFrames?: number;
  maxDurationMs?: number;
  showCursor?: boolean;
}

export interface RecordingResult {
  durationMs: number;
  fps: number;
  framesCount: number;
  format: "webm" | "gif";
  outputPath?: string;
  fileSizeBytes?: number;
  base64?: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface AnimationRecordOptions extends RecordingOptions {
  durationMs: number;
  triggerScript?: string;
  triggerSelector?: string;
  returnBase64?: boolean;
}
