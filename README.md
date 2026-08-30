# ⚡ @bunbrowser/mcp

[![GitHub Repository](https://img.shields.io/badge/GitHub-vintik100%2Fbunbrowser-blue?logo=github)](https://github.com/vintik100/bunbrowser)
[![npm version](https://img.shields.io/badge/npm-%40bunbrowser%2Fmcp-red?logo=npm)](https://www.npmjs.com/package/@bunbrowser/mcp)
[![Bun Version](https://img.shields.io/badge/Bun-%3E%3D1.3.12-black?logo=bun)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **Ultra-fast, zero-download Model Context Protocol (MCP) server for browser automation, powered natively by `Bun.WebView`.**
> 
> *A 100% drop-in lightweight replacement for `@playwright/mcp` with identical AI tool semantics, native `isTrusted: true` OS events, sub-50ms startup times, and zero binary bloat.*

---

## 🚀 Why `bunbrowser`?

| Feature | `@playwright/mcp` (Official Playwright) | `@bunbrowser/mcp` (Native Bun.WebView) |
| :--- | :--- | :--- |
| **Startup Latency** | ~500ms - 2.5s cold start | **< 50ms (Instantaneous)** |
| **Binary Downloads** | ~300MB - 1GB dedicated browser packages | **0 MB (Uses Chrome/Chromium on Linux/Win or WKWebView on macOS)** |
| **Base Memory Footprint** | ~180MB - 350MB RAM | **~25MB - 50MB RAM** |
| **Event Fidelity** | Synthetic via CDP JavaScript injection | **Native OS-level compositor events (`isTrusted: true`)** |
| **Accessibility Tree** | `browser_snapshot` with `[ref=eN]` | **Identical `[ref=eN]` format and prompt compatibility** |
| **Batch Form Filling** | Individual turns for each field | **Single-turn `browser_fill_form`** |
| **Performance & SEO** | Requires custom scripts | **Built-in `browser_lighthouse_audit` (0-100 scores) & `browser_get_metrics`** |
| **Motion & Animation** | Not exposed directly | **Built-in `browser_record_animation` (WebM & animated GIF)** |
| **Raw CDP Access** | Restricted | **Built-in `browser_cdp` tool** |

---

## 📚 Official Documentation (Diátaxis Framework)

The project documentation is structured using the **[Diátaxis Framework](https://diataxis.fr/)**:

* 🎓 **[Tutorials (Learn from scratch)](./docs/1-tutorials/getting-started.md)**: Guided onboarding, installation, and your first AI automation.
* 🛠️ **[How-To Guides (Practical recipes)](./docs/2-how-to/)**:
  * [Configuring AI Clients (Claude Desktop, Cursor, Antigravity, VS Code)](./docs/2-how-to/configure-clients.md)
  * [Optimal Agent Prompting & Tool Selection](./docs/2-how-to/prompting-guide.md)
  * [Recording Videos & Debugging Animations](./docs/2-how-to/record-animations.md)
  * [Persisting Sessions, Cookies, and LocalStorage](./docs/2-how-to/persistent-sessions.md)
  * [Executing Direct CDP Commands](./docs/2-how-to/cdp-raw-commands.md)
* 📖 **[Technical Reference (Specifications)](./docs/3-reference/)**:
  * [Complete Catalog of all 30 MCP Tools & Schemas](./docs/3-reference/mcp-tools.md)
  * [Command-Line Options (CLI) & Environment Variables](./docs/3-reference/cli-options.md)
* 💡 **[Explanation & Architecture (Concepts)](./docs/4-explanation/)**:
  * [Internal Architecture & Native Events (`isTrusted: true`)](./docs/4-explanation/architecture-bun-webview.md)
  * [Detailed Technical Comparison vs. `@playwright/mcp`](./docs/4-explanation/vs-playwright.md)

For a complete navigation map, see **[`docs/index.md`](./docs/index.md)**.

---

## 📦 Installation & Setup

### 1. Requirements
* [Bun](https://bun.sh) (v1.3.12 or higher).
* On **macOS**: Zero additional downloads (uses built-in `WKWebView`).
* On **Linux / Windows**: Google Chrome, Chromium, Brave, or Microsoft Edge installed.

### 2. Configure in your MCP Client

#### Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "playwright": {
      "command": "bunx",
      "args": ["@bunbrowser/mcp"]
    }
  }
}
```

#### Cursor (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "browser": {
      "command": "bunx",
      "args": ["@bunbrowser/mcp"]
    }
  }
}
```

#### Google Antigravity (`~/.gemini/antigravity/mcp_config.json`):
```json
{
  "mcpServers": {
    "browser": {
      "command": "bunx",
      "args": ["@bunbrowser/mcp"]
    }
  }
}
```

#### CLI Execution with Custom Viewport:
```bash
bunx @bunbrowser/mcp --width 1920 --height 1080 --url "https://bun.sh"
```

---

## 🛠️ Complete MCP Tools Catalog (30 Tools)

### 🌐 Navigation
* **`browser_navigate`**: Navigate to a URL with optional accessibility snapshot.
* **`browser_navigate_back`**: Navigate back in history.
* **`browser_navigate_forward`**: Navigate forward in history.
* **`browser_reload`**: Reload active page.

### 🔍 Inspection & State
* **`browser_snapshot`**: PRIMARY INSPECTION. Captures semantic accessibility tree with `[ref=eN]` IDs.
* **`browser_take_screenshot`**: Visual viewport screenshot in Base64 (PNG, JPEG, WebP) or direct zero-copy disk save.
* **`browser_evaluate`**: Evaluates JavaScript in page context.
* **`browser_get_content`**: Returns full HTML markup or plain text.
* **`browser_console_logs`**: Retrieves recorded console logs.

### 🖱️ Element Interaction
* **`browser_click`**: Clicks element via `ref`, CSS selector, or coordinates.
* **`browser_type`**: Types text into input elements with auto-wait.
* **`browser_fill_form`**: BATCH FORM FILLER. Fills multiple inputs and submits in a single turn.
* **`browser_press_key`**: Dispatches keyboard keys and key combinations.
* **`browser_hover`**: Moves mouse pointer over an element.
* **`browser_scroll`**: Directional, delta-based, or element-targeted scrolling.
* **`browser_select_option`**: Selects options in `<select>` dropdowns.
* **`browser_drag`**: Drag-and-drop between source and destination elements.

### 📑 Tab Management
* **`browser_tabs`**: Lists all open tabs and active state.
* **`browser_tab_new`**: Opens a new tab with optional URL and viewport size.
* **`browser_tab_switch`**: Switches active tab focus by `tabId`.
* **`browser_tab_close`**: Closes a specific tab or active tab.
* **`browser_resize`**: Resizes viewport dimensions.

### ⚡ Storage & CDP
* **`browser_cdp`**: Executes raw Chrome DevTools Protocol commands.
* **`browser_cookies`**: Gets, sets, or clears browser session cookies.
* **`browser_localstorage`**: Gets, sets, or clears `localStorage` keys.

### 📊 Performance & Lighthouse Audits
* **`browser_get_metrics`**: Real-time network timings (TTFB, DOM load), JS heap memory, and resource waterfalls.
* **`browser_lighthouse_audit`**: Full Lighthouse audit with 0-100 scores for Performance, Accessibility, Best Practices, and SEO.

### 🎬 Video Recording & Motion
* **`browser_start_recording`**: Starts continuous video recording (`webm` or `gif`) with scaling, compression quality, and click ripples.
* **`browser_stop_recording`**: Stops recording and exports file with duration, frame count, dimensions, and size metrics.
* **`browser_record_animation`**: One-shot recording of UI transitions and keyframe animations for a given `durationMs` with trigger actions.

---

## 🧪 Automated Testing

Run the complete test suite:

```bash
# Run unit & integration tests
bun test

# Verify strict TypeScript types
bun run check
```

---

## 📂 Codebase Structure

```text
bunbrowser/
├── bin/
│   ├── bunbrowser.ts         # CLI binary executable
│   └── bunpw-mcp.ts          # Legacy compatibility wrapper
├── src/
│   ├── index.ts              # Entrypoint CLI & Stdio transport
│   ├── server.ts             # McpServer instance & tool registration
│   ├── browser/
│   │   ├── types.ts          # TypeScript interfaces & configuration types
│   │   ├── manager.ts        # BrowserManager (multi-tab lifecycle)
│   │   ├── tab.ts            # BrowserTab wrapper over Bun.WebView
│   │   ├── recorder.ts       # TabRecorder video & animation capture
│   │   ├── gif_encoder.ts    # Pure TypeScript GIF89a encoder (0 dependencies)
│   │   └── snapshot.ts       # Accessibility Tree & ref resolver
│   └── tools/
│       ├── navigation.ts     # Navigation tools
│       ├── inspection.ts     # Snapshot, screenshot, evaluate, content, logs
│       ├── interaction.ts    # Click, type, fill_form, press_key, hover, scroll, drag
│       ├── tabs.ts           # Tabs management & resize
│       ├── storage_cdp.ts    # CDP, cookies, localStorage
│       ├── metrics.ts        # get_metrics, lighthouse_audit
│       └── video.ts          # start_recording, stop_recording, record_animation
├── test/
│   ├── manager.test.ts       # Tab manager tests
│   ├── snapshot.test.ts      # Accessibility tree tests
│   ├── interaction.test.ts   # Real DOM interaction tests
│   ├── metrics.test.ts       # Metrics & Lighthouse audit tests
│   ├── video.test.ts         # Video recording & GIF encoder tests
│   └── mcp_server.test.ts    # End-to-end MCP JSON-RPC tests
└── docs/                     # Diátaxis framework documentation
    ├── 1-tutorials/
    ├── 2-how-to/
    ├── 3-reference/
    └── 4-explanation/
```

---

## 📄 License

MIT License. See [LICENSE](https://github.com/vintik100/bunbrowser/blob/main/LICENSE) for details.
