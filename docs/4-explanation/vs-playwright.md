# Technical Explanation: Detailed Comparison (`@bunbrowser/mcp` vs. `@playwright/mcp`)

This document compares the architecture, performance characteristics, memory footprint, and practical use cases of `@playwright/mcp` versus **`@bunbrowser/mcp`** (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)).

---

## 1. Comparison Matrix

| Criterion | `@playwright/mcp` (Official Playwright) | `@bunbrowser/mcp` (Native Bun.WebView) |
| :--- | :--- | :--- |
| **Startup Time (Cold Start)** | ~1.2s - 3.0s | **< 0.05s (Sub-50ms)** |
| **Base Memory Footprint** | ~200MB - 450MB | **~30MB - 60MB** |
| **Binary Download Size** | ~350MB to 1.2GB dedicated browser bundles | **0 MB extra** (Uses existing Chrome/Chromium/Edge or WebKit) |
| **Mouse / Keyboard Event Fidelity** | Synthetic via CDP JavaScript injection | **Native OS-level events (`isTrusted: true`)** |
| **Batch Form Filling** | Individual turns for each input | **Single-turn `browser_fill_form`** |
| **Lighthouse Audits & Web Vitals** | Not available as dedicated MCP tools | **Built-in `browser_lighthouse_audit` (0-100 scores)** |
| **Video & Motion Recording** | Requires complex custom video options | **Native `browser_record_animation` (WebM / GIF)** |
| **Raw CDP Execution** | Not exposed directly | **Built-in `browser_cdp` tool** |
| **Snapshot Generation Time** | ~40ms - 90ms | **~5ms - 15ms** |

---

## 2. Key Advantages of `@bunbrowser/mcp`

### A. Sub-50ms Startup for AI Agents
In agentic workflows, MCP servers are spawned or queried repeatedly. The near-instant startup of Bun (<50ms vs 2s) eliminates perceptible lag on each tool call.

### B. Zero-Friction Installation in CI/CD and Containers
In cloud sandboxes and CI/CD pipelines, `@playwright/mcp` requires running `npx playwright install --with-deps` (which downloads hundreds of megabytes of binary packages). In contrast, `@bunbrowser/mcp` runs instantly against any Chrome, Chromium, Brave, or Edge already available on the system.

### C. Superior Bot-Detection Resilience
By dispatching native OS-level user events (`isTrusted: true`) through `Bun.WebView`, `@bunbrowser/mcp` avoids triggering anti-bot protections (Cloudflare, reCAPTCHA) that flag synthetic JavaScript events.

---

## 3. When to Choose Each Server

### Choose `@bunbrowser/mcp` when:
* You require **maximum execution speed, minimal token latency, and low memory usage**.
* You want to use system-installed browsers without downloading gigabytes of browser dependencies.
* You need **built-in Core Web Vitals, Lighthouse audits, or UI animation recording (WebM/GIF)**.
* You are running on **macOS** and want native `WKWebView` with zero overhead.
* You need direct low-level CDP access (`browser_cdp`).

### Choose `@playwright/mcp` when:
* You have a strict requirement to automate Mozilla Firefox on Linux environments.
* You rely specifically on Playwright Trace Viewer `.zip` export formats.
