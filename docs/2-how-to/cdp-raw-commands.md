# How-To Guide: Executing Direct Chrome DevTools Protocol (CDP) Commands

When `@bunbrowser/mcp` (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)) runs on the Chrome/Chromium backend (the default on Linux and Windows, or optional on macOS), the **`browser_cdp`** tool provides direct access to 500+ low-level Chrome DevTools Protocol APIs without intermediate abstractions.

---

## 1. Emulating Mobile Devices and Overriding User-Agents

To test responsive mobile layouts or bypass user-agent restrictions:

### Override User-Agent:
```json
{
  "method": "Emulation.setUserAgentOverride",
  "params": {
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  }
}
```

### Emulate Mobile Resolution & Pixel Ratio:
```json
{
  "method": "Emulation.setDeviceMetricsOverride",
  "params": {
    "width": 390,
    "height": 844,
    "deviceScaleFactor": 3,
    "mobile": true
  }
}
```

---

## 2. Geolocation Emulation

To test location-dependent web features:

```json
{
  "method": "Emulation.setGeolocationOverride",
  "params": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 100
  }
}
```

---

## 3. Network Inspection and Custom Headers

To monitor network requests or inject authentication headers:

### Enable Network Domain:
```json
{
  "method": "Network.enable",
  "params": {
    "maxPostDataSize": 65536
  }
}
```

### Inject Extra HTTP Headers:
```json
{
  "method": "Network.setExtraHTTPHeaders",
  "params": {
    "headers": {
      "X-Custom-Auth": "secret-token-12345",
      "Accept-Language": "en-US,en;q=0.9"
    }
  }
}
```

---

## 4. Performance & Memory Profiling

To retrieve low-level JavaScript heap memory usage and DOM node counts:

```json
{
  "method": "Performance.getMetrics"
}
```

**Example Server Response:**
```json
{
  "metrics": [
    { "name": "Timestamp", "value": 128456.78 },
    { "name": "Documents", "value": 3 },
    { "name": "Frames", "value": 2 },
    { "name": "JSEventListeners", "value": 45 },
    { "name": "Nodes", "value": 312 },
    { "name": "JSHeapUsedSize", "value": 4194304 },
    { "name": "JSHeapTotalSize", "value": 8388608 }
  ]
}
```

---

## 5. Tool Selection: `browser_cdp` vs. Standard Tools

| Objective | Recommended Tool |
| :--- | :--- |
| Standard navigation, clicking, typing | `browser_navigate`, `browser_click`, `browser_type`, `browser_fill_form` |
| Understanding page layout & semantics | `browser_snapshot` |
| High-framerate animation recording | `browser_record_animation` |
| Core Web Vitals and Lighthouse audit | `browser_lighthouse_audit`, `browser_get_metrics` |
| Custom network throttling, headers, or device emulation | `browser_cdp` (`Network.*`, `Emulation.*`) |
