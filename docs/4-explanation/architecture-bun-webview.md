# Technical Explanation: Internal Architecture of `@bunbrowser/mcp`

This document details the architectural foundation of **`@bunbrowser/mcp`** (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)), how it integrates natively with `Bun.WebView`, and how its design differs from traditional browser automation frameworks.

---

## 1. The `Bun.WebView` Paradigm

`Bun.WebView` enables lightweight browser automation directly within the JavaScript runtime without requiring heavy third-party driver binaries or dedicated browser bundle downloads.

```text
+-------------------------------------------------------------+
|                         Bun Process                         |
|  +-------------------------------------------------------+  |
|  |                     @bunbrowser/mcp                   |  |
|  |   [McpServer] <--> [BrowserManager] <--> [BrowserTab]  |  |
|  +-------------------------------------------------------+  |
+------------------------------+------------------------------+
                               |
              +----------------+----------------+
              | (macOS)                         | (Linux / Windows)
              ▼                                 ▼
   [ Host WebKit Process ]           [ Chrome / Chromium Process ]
   (Binary Unix Domain Socket)       (DevTools Protocol Pipe)
              |                                 |
              ▼                                 ▼
        [ WKWebView ]                    [ Render Target ]
```

### Engine Backends
* **macOS (Native WebKit)**: Bun spawns a host helper process that manages `WKWebView` communicating via a compact binary Unix domain socket. Zero additional downloads required.
* **Linux & Windows (Blink/Chrome via CDP Pipe)**: Bun connects directly to the host system's installed Chrome/Chromium binary using an anonymous OS pipe (`--remote-debugging-pipe`), avoiding open network ports and eliminating firewall issues.

---

## 2. Native OS Events (`isTrusted: true`)

A major challenge for AI agents navigating modern web applications is bot detection and anti-scraping systems (Cloudflare, reCAPTCHA, Datadome).

Traditional automation libraries (such as Puppeteer or Playwright web builds) frequently dispatch synthetic JavaScript events directly in the DOM. Modern anti-bot scripts verify `event.isTrusted`:

* Synthetic JavaScript events: `event.isTrusted === false` (immediate bot flag).
* In `@bunbrowser/mcp` (via `Bun.WebView`): Mouse and keyboard events are dispatched at the **native window manager and compositor level**:
  ```javascript
  document.addEventListener("click", (e) => {
    console.log(e.isTrusted); // => TRUE (identical to real human OS events)
  });
  ```

---

## 3. Semantic Accessibility Tree Engine (`browser_snapshot`)

Large Language Models (LLMs) reason over hierarchical semantic text much faster, more accurately, and more cheaply than raw screenshot images.

### How Semantic Labeling Works:
1. `browser_snapshot` traverses the visible DOM and computes the computed ARIA role of each element.
2. Every interactive element (`<button>`, `<a href>`, `<input>`, `<select>`, or nodes with `onclick`/`tabindex`) is tagged with a deterministic reference attribute: `data-bunbrowser-ref="eN"`.
3. The server generates a compact indented tree:
   ```text
   heading "Log In"
   [e1] textbox "Email address" value=""
   [e2] textbox "Password"
   [e3] button "Sign In" [disabled]
   ```
4. When the LLM decides to interact with `ref: "e3"`, `@bunbrowser/mcp` resolves it internally to `[data-bunbrowser-ref="e3"]` and triggers the native OS event with built-in actionability checks.

---

## 4. Lifecycle and Resource Management

* **Single Host Process, Multiple Views**: Tabs (`BrowserTab`) are isolated views sharing a single underlying browser engine to minimize memory consumption.
* **Guaranteed Cleanup**: `BrowserManager` captures process exit signals (`SIGINT`, `SIGTERM`, `exit`) to ensure all child helper processes are terminated with zero orphaned background tasks.
