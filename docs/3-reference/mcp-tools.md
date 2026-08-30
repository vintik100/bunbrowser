# Technical Reference: MCP Tools Catalog (`mcp-tools`)

This document is the complete reference specification for all 30 tools exposed by the **`@bunbrowser/mcp`** (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)) server.

---

## 1. Navigation Module

### `browser_navigate`
Navigates the active tab to a specified URL and waits for page load.

* **Parameters:**
  * `url` (`string`, **required**): Destination URL (e.g. `"https://bun.sh"` or `"data:text/html,..."`).
  * `timeout` (`number`, optional): Maximum navigation timeout in milliseconds (default: `30000`).
  * `snapshot` (`boolean`, optional): Whether to include the semantic accessibility snapshot in the response (default: `true`).
* **Returns:** Navigation confirmation text, page title, and accessibility tree (if `snapshot` enabled).

---

### `browser_navigate_back`
Navigates backward in the active tab's history.

* **Parameters:**
  * `snapshot` (`boolean`, optional): Return updated snapshot after navigating back (default: `true`).
* **Returns:** URL and title of previous page.

---

### `browser_navigate_forward`
Navigates forward in the active tab's history.

* **Parameters:**
  * `snapshot` (`boolean`, optional): Return updated snapshot after navigating forward (default: `true`).
* **Returns:** URL and title of next page.

---

### `browser_reload`
Reloads the active browser page.

* **Parameters:**
  * `snapshot` (`boolean`, optional): Return updated snapshot after reload (default: `true`).
* **Returns:** Reload confirmation and snapshot.

---

## 2. Inspection and State Module

### `browser_snapshot`
**PRIMARY INSPECTION TOOL.** Captures the complete hierarchical accessibility tree of the current page with deterministic element references (`[ref=eN]`).

* **Parameters:** None.
* **Returns:** Structured text with ARIA roles (`heading`, `button`, `textbox`, `link`), accessible names, states (`[checked]`, `[disabled]`, `[focused]`), and input values.

---

### `browser_take_screenshot`
**VISUAL ONLY.** Captures a visual image of the current viewport encoded in Base64, or writes it directly to disk when `outputPath` is provided.

* **Parameters:**
  * `format` (`"png" | "jpeg" | "webp"`, optional): Image format (default: `"png"`).
  * `quality` (`number`, optional): Compression quality 0-100 for JPEG/WebP (default: `80`).
  * `outputPath` (`string`, optional): File path destination to save the image directly to disk (e.g. `"./screenshots/page.png"`). Uses `Bun.write()` with zero-copy binary buffers for maximum performance without Base64 serialization overhead.
* **Returns:** Base64 image payload and MIME type (default), or a text confirmation with the saved path and file size in bytes (when `outputPath` is set).

---

### `browser_evaluate`
Executes an arbitrary JavaScript expression in the context of the active page.

* **Parameters:**
  * `script` (`string`, **required**): JavaScript expression to evaluate.
* **Returns:** Serialized expression result as formatted text/JSON.

---

### `browser_get_content`
Retrieves the raw HTML source or visible text of the active page.

* **Parameters:**
  * `format` (`"html" | "text"`, optional): Format to return (`"html"` for outerHTML DOM, `"text"` for body innerText, default: `"html"`).
* **Returns:** Complete page markup or text.

---

### `browser_console_logs`
Retrieves captured console messages (`log`, `warn`, `error`, `info`) emitted by the page.

* **Parameters:**
  * `clear` (`boolean`, optional): Whether to clear the log buffer after reading (default: `false`).
* **Returns:** Timestamped list of console log entries.

---

## 3. Element Interaction Module

### `browser_click`
Clicks on an element. Prefers `ref` (`"e1"`) from `browser_snapshot` for deterministic targeting.

* **Parameters:**
  * `ref` (`string`, optional): Element reference ID (e.g. `"e1"`).
  * `selector` (`string`, optional): CSS selector (e.g. `"#submit-btn"`).
  * `x`, `y` (`number`, optional): Viewport coordinates in pixels.
  * `button` (`"left" | "right" | "middle"`, optional): Mouse button (default: `"left"`).
  * `clickCount` (`number`, optional): 1 for single, 2 for double click (default: `1`).
  * `modifiers` (`Array<"Shift" | "Control" | "Alt" | "Meta">`, optional): Modifier keys to hold.
  * `timeout` (`number`, optional): Maximum wait timeout in ms (default: `30000`).
  * `snapshot` (`boolean`, optional): Return updated snapshot after click (default: `true`).

---

### `browser_type`
Types text into an input or textarea element.

* **Parameters:**
  * `ref` (`string`, optional): Element reference ID (e.g. `"e2"`).
  * `selector` (`string`, optional): CSS selector.
  * `text` (`string`, **required**): Text string to type.
  * `clear` (`boolean`, optional): Clear input before typing (default: `false`).
  * `pressEnter` (`boolean`, optional): Press Enter key immediately after typing (default: `false`).
  * `snapshot` (`boolean`, optional): Return updated snapshot (default: `true`).

---

### `browser_fill_form`
**BATCH FORM FILLER.** Fills multiple form inputs in a single round-trip and optionally clicks submit.

* **Parameters:**
  * `fields` (`Array<{ ref?: string, selector?: string, value: string, clear?: boolean }>`, **required**): Array of form fields to fill sequentially.
  * `submitRef` (`string`, optional): Reference ID of submit button to click after filling.
  * `submitSelector` (`string`, optional): Selector of submit button to click after filling.
  * `snapshot` (`boolean`, optional): Return updated snapshot (default: `true`).

---

### `browser_press_key`
Dispatches keyboard key events.

* **Parameters:**
  * `key` (`string`, **required**): Key name (e.g. `"Enter"`, `"Escape"`, `"Tab"`, `"ArrowDown"`, `"Backspace"`).
  * `modifiers` (`Array<"Shift" | "Control" | "Alt" | "Meta">`, optional): Modifier keys.
  * `snapshot` (`boolean`, optional): Return updated snapshot (default: `false`).

---

### `browser_hover`
Hovers the mouse pointer over an element to trigger CSS `:hover` states and dropdown menus.

* **Parameters:**
  * `ref` (`string`, optional): Element reference ID.
  * `selector` (`string`, optional): CSS selector.
  * `x`, `y` (`number`, optional): Coordinates in pixels.
  * `snapshot` (`boolean`, optional): Return updated snapshot (default: `true`).

---

### `browser_scroll`
Scrolls the viewport or scrolls a specific element into view.

* **Parameters:**
  * `direction` (`"up" | "down" | "top" | "bottom"`, optional): Direction of scroll.
  * `deltaX`, `deltaY` (`number`, optional): Pixel scroll deltas.
  * `ref`, `selector` (`string`, optional): Target element to scroll into view.
  * `snapshot` (`boolean`, optional): Return updated snapshot (default: `true`).

---

### `browser_select_option`
Selects one or more options in a `<select>` dropdown element.

* **Parameters:**
  * `ref` (`string`, optional): `<select>` element reference ID.
  * `selector` (`string`, optional): CSS selector.
  * `values` (`string | string[]`, **required**): Value(s) or visible text(s) to select.
  * `snapshot` (`boolean`, optional): Return updated snapshot (default: `true`).

---

### `browser_drag`
Drags a source element and drops it onto a destination element.

* **Parameters:**
  * `sourceRef`, `sourceSelector` (`string`, optional): Source element identifier.
  * `targetRef`, `targetSelector` (`string`, optional): Destination element identifier.
  * `snapshot` (`boolean`, optional): Return updated snapshot (default: `true`).

---

## 4. Multi-Tab Management Module

### `browser_tabs`
Lists all open browser tabs with IDs, URLs, titles, and active statuses.

---

### `browser_tab_new`
Opens a new browser tab/view with optional initial URL and dimensions.

* **Parameters:**
  * `url` (`string`, optional): Initial URL.
  * `width`, `height` (`number`, optional): Viewport dimensions in pixels (default: `1280x720`).
  * `snapshot` (`boolean`, optional): Return snapshot of new tab (default: `true`).

---

### `browser_tab_switch`
Switches the active browser context to a different tab by `tabId`.

* **Parameters:**
  * `tabId` (`string`, **required**): Target tab ID.
  * `snapshot` (`boolean`, optional): Return snapshot of switched tab (default: `true`).

---

### `browser_tab_close`
Closes a browser tab (closes active tab if omitted).

* **Parameters:**
  * `tabId` (`string`, optional): Target tab ID to close.

---

### `browser_resize`
Resizes the viewport dimensions of the active tab.

* **Parameters:**
  * `width` (`number`, **required**): Viewport width in pixels (100 - 16384).
  * `height` (`number`, **required**): Viewport height in pixels (100 - 16384).

---

## 5. Storage and CDP Protocol Module

### `browser_cdp`
Executes raw Chrome DevTools Protocol commands on Chrome/Chromium backend.

* **Parameters:**
  * `method` (`string`, **required**): CDP method (e.g. `"Network.enable"`, `"Emulation.setUserAgentOverride"`).
  * `params` (`object`, optional): JSON parameters for the method.

---

### `browser_cookies`
Manages cookies for the active session.

* **Parameters:**
  * `action` (`"get" | "set" | "clear"`, **required**).
  * `name`, `value`, `domain`, `path` (for `action: "set"`).

---

### `browser_localstorage`
Manages `localStorage` key-value storage for the active page origin.

* **Parameters:**
  * `action` (`"get" | "set" | "clear"`, **required**).
  * `key`, `value` (based on action).

---

## 6. Performance & Lighthouse Audit Module

### `browser_get_metrics`
Extracts real-time Web Performance API metrics, Core Web Vitals, JS Heap memory, and network transfer waterfalls.

* **Parameters:**
  * `includeResources` (`boolean`, optional): Include individual network resource breakdown (default: `false`).
  * `includeCdp` (`boolean`, optional): Include low-level memory and DOM node counts (default: `true`).
* **Returns:** Structured JSON with DNS, TCP, TTFB, DOMContentLoaded, LoadComplete, First Paint, FCP, memory heap, and resource summary.

---

### `browser_lighthouse_audit`
Runs a full Lighthouse-style quality audit computing scores (0-100) for Performance, Accessibility, Best Practices, and SEO with prioritized optimization opportunities.

* **Parameters:**
  * `categories` (`Array<"performance" | "accessibility" | "best-practices" | "seo">`, optional): Audit categories to run (default: all 4).
  * `detailed` (`boolean`, optional): Include check-by-check pass/fail breakdown (default: `false`).
* **Returns:** JSON with `auditScores` (0-100), `coreWebVitals` (FCP, LCP, TTFB, CLS), and `opportunities`.

---

## 7. Video Recording & Animation Module

### `browser_start_recording`
Starts continuous background video recording of user interactions and animations on the active tab into WebM or animated GIF.

* **Parameters:**
  * `fps` (`number`, optional): Frame rate between 1 and 60 FPS (default: `20`).
  * `format` (`"webm" | "gif"`, optional): Output video format (`"webm"` or `"gif"`, default: `"webm"`).
  * `outputPath` (`string`, optional): File path destination to save the recording (e.g. `"./recordings/flow.webm"`).
  * `quality` (`number`, optional): Image compression quality 1-100 (default: `80`).
  * `scale` (`number`, optional): Downscaling factor for video frame dimensions 0.1-2.0 (e.g. `0.5` for 50% width/height, default: `1.0`).
  * `maxFrames` (`number`, optional): Maximum frame count safety cap to prevent OOM (default: `1500`).
  * `showCursor` (`boolean`, optional): Whether to render animated click ripples on interactions during recording (default: `true`).
* **Returns:** Confirmation message with active tab ID, format, FPS, scaling, and output destination.

---

### `browser_stop_recording`
Stops active video recording, exports the resulting WebM or animated GIF file to disk, and returns duration, frame counts, and dimensions.

* **Parameters:**
  * `savePath` (`string`, optional): Override file path destination to save the recording.
  * `returnBase64` (`boolean`, optional): Whether to return base64 payload in the MCP response (default: `false`).
* **Returns:** Detailed recording summary (duration, total frames, average FPS, format, dimensions `(WxH px)`, file size in KB, and saved path) plus inline image data if `returnBase64` is enabled for GIF.

---

### `browser_record_animation`
**ONE-SHOT ANIMATION & MOTION RECORDER.** Records UI transitions, CSS keyframe animations, micro-interactions, or visual jank for an exact duration (`durationMs`) into WebM or animated GIF with optional JavaScript or click triggers.

* **Parameters:**
  * `durationMs` (`number`, **required**): Recording duration in milliseconds (100 to 60000).
  * `fps` (`number`, optional): Frames per second between 1 and 60 (default: `20`).
  * `format` (`"webm" | "gif"`, optional): Output format (`"webm"` or `"gif"`, default: `"webm"`).
  * `outputPath` (`string`, optional): File path destination to save the recording (e.g. `"./recordings/animation.gif"`).
  * `scale` (`number`, optional): Downscaling factor for video frame dimensions 0.1-2.0 (default: `1.0`).
  * `quality` (`number`, optional): Image compression quality 1-100 (default: `80`).
  * `showCursor` (`boolean`, optional): Whether to render animated click ripples on interactions during recording (default: `true`).
  * `triggerScript` (`string`, optional): JavaScript code to execute in the page context right when recording begins.
  * `triggerSelector` (`string`, optional): CSS selector of an element to click right when recording begins.
  * `returnBase64` (`boolean`, optional): Whether to include base64 payload in the response (default: `false`).
* **Returns:** Structured summary (duration, frames captured, average FPS, format, dimensions, file size, output path) and inline Base64 data if requested.
