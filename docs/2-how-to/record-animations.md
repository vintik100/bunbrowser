# How-To Guide: Recording Videos & Debugging Animations (`record-animations`)

This guide explains how to use the video recording and animation capture tools in **`@bunbrowser/mcp`** (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)) to inspect UI transitions, CSS keyframe animations, Canvas/WebGL motion, and multi-step user interaction flows in **WebM** and **GIF** formats.

---

## 1. Why Record Animations in Browser MCP?

When debugging frontends or validating UI flows with AI models:
* Static screenshots (`browser_take_screenshot`) cannot verify animation smoothness, cubic-bezier timing curves, layout jank, or intermediate state transitions.
* Video recording captures dynamic behavior over time, making it easy to spot visual glitches, flickering, or dropped frames in dropdowns, modals, and charts.

`@bunbrowser/mcp` provides two complementary approaches:
1. **One-Shot Animation Recording (`browser_record_animation`)**: Record a targeted interaction or micro-transition for an exact duration (`durationMs`).
2. **Continuous Session Recording (`browser_start_recording` / `browser_stop_recording`)**: Record long, multi-step user flows across clicks, typing, and page scrolling.

---

## 2. Recipe 1: One-Shot Animation Recording

Use `browser_record_animation` to capture an animation triggered by an element click or script.

### AI Agent Prompt Example:

```text
Navigate to http://localhost:3000, click '#menu-toggle', and record a 1.5-second animation in GIF format to verify that the sidebar opens smoothly. Save the output to './debug/menu_animation.gif'.
```

### MCP Tool Call:

```json
{
  "name": "browser_record_animation",
  "arguments": {
    "durationMs": 1500,
    "fps": 30,
    "format": "gif",
    "triggerSelector": "#menu-toggle",
    "scale": 0.75,
    "quality": 80,
    "showCursor": true,
    "outputPath": "./debug/menu_animation.gif",
    "returnBase64": true
  }
}
```

### Result:
* The agent executes the trigger action and records the active viewport for exactly 1.5 seconds at 30 FPS.
* Click ripples (`showCursor: true`) visually mark the interaction point.
* The animated GIF is encoded directly in the page context with accurate frame interval timing and saved to `./debug/menu_animation.gif`.
* A Base64 image payload is returned for inline preview in the chat interface.

---

## 3. Recipe 2: Continuous Flow Recording

To record a complete end-to-end user checkout or onboarding journey:

### Step 1: Start Recording
```json
{
  "name": "browser_start_recording",
  "arguments": {
    "fps": 25,
    "format": "webm",
    "scale": 0.5,
    "quality": 80,
    "showCursor": true,
    "outputPath": "./recordings/checkout_flow.webm"
  }
}
```

### Step 2: Perform User Interactions
Interact naturally using `@bunbrowser/mcp` tools:
1. `browser_fill_form` with billing information.
2. `browser_click` on payment options.
3. `browser_scroll` through order summary.

### Step 3: Stop and Export (with optional path override)
```json
{
  "name": "browser_stop_recording",
  "arguments": {
    "savePath": "./recordings/final_checkout.webm"
  }
}
```

### Response Summary:
```text
🎬 Recording finished successfully!
* Duration: 4.82s
* Total Frames: 120 (~25 FPS)
* Format: WEBM (video/webm) (640x360px)
* File Size: 342.5 KB
* Saved to: ./recordings/final_checkout.webm
```

---

## 4. Recipe 3: Triggering Animations via JavaScript (`triggerScript`)

If an animation is triggered programmatically rather than by a simple button click:

```json
{
  "name": "browser_record_animation",
  "arguments": {
    "durationMs": 2000,
    "fps": 30,
    "format": "gif",
    "scale": 1.0,
    "triggerScript": "document.querySelector('.modal-backdrop').classList.add('fade-in'); window.dispatchEvent(new CustomEvent('start-tour'));",
    "outputPath": "./debug/modal_fade.gif"
  }
}
```

---

## 5. Performance Optimization & Parameter Guide

| Parameter | Recommended Value | Impact |
| :--- | :--- | :--- |
| `scale` | `0.5` – `0.75` | Downscales frame resolution (e.g. `0.5` reduces a 1080p frame to 540p), reducing file size and encoding time by 4x. |
| `quality` | `70` – `85` | Balances image clarity and compression ratio for JPEG/WebP frame payloads. |
| `showCursor` | `true` (default) | Renders animated circular click ripples on mouse interactions so reviewers can track agent actions visually. |
| `maxFrames` | `500` – `2000` | Safety guardrail preventing excessive memory consumption during long recording sessions. |
| `returnBase64` | `true` for GIF / `false` for WebM | Inline rendering for markdown chat clients without requiring disk access. |

---

## 6. Format Comparison: WebM vs. GIF

| Feature | WebM (`format: 'webm'`) | Animated GIF (`format: 'gif'`) |
| :--- | :--- | :--- |
| **Primary Use Case** | High-framerate video, long test recordings, continuous flows | Markdown documentation, PR reviews, chat previews |
| **Typical FPS** | 20 – 60 FPS | 10 – 30 FPS |
| **Compression** | High efficiency (smaller file sizes for long video) | 256-color palette with LZW compression |
| **Compatibility** | Modern video players, browsers, HTML5 `<video>` | Universal on all platforms, image viewers, and Markdown |

