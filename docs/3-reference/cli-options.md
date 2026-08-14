# Technical Reference: Command-Line Options (CLI) & Environment

This document details all command-line startup flags, environment variables, browser binary resolution, and process exit codes for **`@bunbrowser/mcp`** (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)).

---

## 1. Command-Line Flags

```bash
bun run src/index.ts [options]
bunx @bunbrowser/mcp [options]
bunbrowser [options]
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--width` | `number` | `1280` | Default viewport width in CSS pixels (100 - 16384). |
| `--height` | `number` | `720` | Default viewport height in CSS pixels (100 - 16384). |
| `--backend` | `string` | *Auto-detected* | Browser rendering engine: `"chrome"` or `"webkit"`. |
| `--datastore` | `string` | *Ephemeral* | Directory path to persist cookies, `localStorage`, and cache. |
| `--url` | `string` | `about:blank` | Initial URL to navigate to upon server startup. |
| `--help`, `-h` | `boolean` | — | Display help message and exit. |

---

## 2. Environment Variables

| Variable | Type | Description |
| :--- | :--- | :--- |
| `BUN_CHROME_PATH` | `string` | Explicit path to Chrome/Chromium binary when placed in a non-standard directory. |
| `PORT` | `number` | Port for optional HTTP/SSE server modes. |
| `DEBUG` | `string` | Enable diagnostic stderr logging (e.g. `DEBUG=bunpw:*`). |

---

## 3. Browser Binary Search Order (Linux & Windows)

When using the `"chrome"` backend, `Bun.WebView` resolves browser binaries using the following precedence:

1. Path provided via explicit programmatic configuration options.
2. `BUN_CHROME_PATH` environment variable.
3. System binaries in `$PATH`: `google-chrome-stable`, `google-chrome`, `chromium-browser`, `chromium`, `brave-browser`, `microsoft-edge`, `chrome`.
4. Standard platform installation paths (`/usr/bin/google-chrome`, `/Applications/Google Chrome.app`, etc.).
5. Cached Playwright installations (`~/.cache/ms-playwright/chromium-*/chrome-linux/chrome`).

---

## 4. Process Exit Codes

| Code | Meaning |
| :--- | :--- |
| `0` | Clean process termination or `--help` invocation. |
| `1` | Fatal error during initialization, unsupported platform, or transport failure. |
