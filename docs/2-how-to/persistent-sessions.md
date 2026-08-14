# How-To Guide: Persisting Sessions, Cookies, and LocalStorage

By default, each `Bun.WebView` instance operates in an **ephemeral in-memory mode**: when the tab or server process closes, cookies, local storage, and cache are discarded.

This guide explains how to persist sessions between restarts and how to inspect or manipulate authentication state using MCP tools.

---

## 1. Configuring a Persistent Data Directory

To preserve login state, cookies, and cache across restarts, specify the `--datastore` CLI option:

```json
{
  "mcpServers": {
    "bunbrowser": {
      "command": "bunx",
      "args": [
        "@bunbrowser/mcp",
        "--datastore",
        "./.bunbrowser-profile"
      ]
    }
  }
}
```

### How it works internally:
* **Linux & Windows (Chrome/Blink backend)**: Maps automatically to `--user-data-dir=./.bunbrowser-profile`, maintaining full browser profiles.
* **macOS (WKWebView backend)**: Uses disk-persisted `WKWebsiteDataStore` (supported on macOS 15.2+).

---

## 2. Managing Cookies with `browser_cookies`

AI agents can retrieve, inject, or delete authentication cookies programmatically.

### A. Inspect Current Cookies
```json
{
  "action": "get"
}
```
**Returns**: A list of all cookies for the current domain with attributes (`name`, `value`, `domain`, `path`, `httpOnly`, `secure`).

### B. Inject a Session Cookie (Pre-authenticated Login)
```json
{
  "action": "set",
  "name": "session_token",
  "value": "xyz987654321",
  "domain": "app.example.com",
  "path": "/"
}
```

### C. Clear All Cookies (Logout)
```json
{
  "action": "clear"
}
```

---

## 3. Managing `localStorage` with `browser_localstorage`

For Single Page Applications (SPAs) that store JWT tokens or UI preferences in `localStorage`:

### A. Set a Key-Value Pair
```json
{
  "action": "set",
  "key": "authToken",
  "value": "Bearer eyJhbGciOi..."
}
```

### B. Get a Stored Key
```json
{
  "action": "get",
  "key": "authToken"
}
```

### C. Clear Storage
```json
{
  "action": "clear"
}
```

---

## 4. Multi-Tab Session Sharing

All tabs opened within the same `@bunbrowser/mcp` session share the same `dataStore` and cookie jar.

To open a new tab while preserving the active session:
1. Call `browser_tab_new({ url: "https://app.example.com/dashboard" })`.
2. List open tabs with `browser_tabs`.
3. Switch between tabs with `browser_tab_switch({ tabId: "tab_1" })`.
