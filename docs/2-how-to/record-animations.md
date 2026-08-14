# How-To Guide: Recording Videos & Debugging Animations (`record-animations`)

This guide explains how to use the video recording and animation capture tools in **`@bunbrowser/mcp`** (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)) to inspect UI transitions, CSS keyframe animations, Canvas/WebGL motion, and multi-step user interaction flows in **WebM** and **GIF** formats.

---

## 1. Why Record Animations in Browser MCP?

When debugging frontends or validating UI flows with AI models:
* Static screenshots (`browser_take_screenshot`) cannot verify animation smoothness, cubic-bezier timing curves, layout jank, or intermediate state transitions.
* Video recording allows visual inspection of real-time behavior over time, making it easy to spot visual glitches, flickering, or dropped frames in dropdowns, modals, and charts.

`@bunbrowser/mcp` provides two complementary approaches:
1. **One-Shot Animation Recording (`browser_record_animation`)**: Record a targeted interaction for a specific duration (`durationMs`).
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
    "outputPath": "./debug/menu_animation.gif",
    "returnBase64": true
  }
}
```

### Result:
* The agent executes the trigger action and records the active viewport for exactly 1.5 seconds at 30 FPS.
* The animated GIF is saved to `./debug/menu_animation.gif` using the zero-dependency pure TypeScript GIF89a encoder.
* Base64 image payload is returned for inline rendering in the chat interface.

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
    "outputPath": "./recordings/checkout_flow.webm"
  }
}
```

### Step 2: Perform User Interactions
Interact naturally using `@bunbrowser/mcp` tools:
1. `browser_fill_form` with billing information.
2. `browser_click` on payment options.
3. `browser_scroll` through order summary.

### Step 3: Stop and Export
```json
{
  "name": "browser_stop_recording",
  "arguments": {}
}
```

### Response Summary:
```text
🎬 Recording finished successfully!
* Duration: 4.82s
* Total Frames: 120 (~25 FPS)
* Format: WEBM (video/webm)
* File Size: 342.5 KB
* Saved to: ./recordings/checkout_flow.webm
```

---

## 4. Triggering Animations via JavaScript (`triggerScript`)

If an animation is triggered programmatically rather than by a simple button click:

```json
{
  "name": "browser_record_animation",
  "arguments": {
    "durationMs": 2000,
    "fps": 30,
    "format": "gif",
    "triggerScript": "document.querySelector('.modal-backdrop').classList.add('fade-in'); window.dispatchEvent(new CustomEvent('start-tour'));",
    "outputPath": "./debug/modal_fade.gif"
  }
}
```

---

## 5. Format Comparison: WebM vs. GIF

| Feature | WebM (`format: 'webm'`) | Animated GIF (`format: 'gif'`) |
| :--- | :--- | :--- |
| **Primary Use Case** | Smooth high-framerate video, long test recordings | Markdown documentation, PR reviews, chat previews |
| **Typical FPS** | 20 - 60 FPS | 10 - 30 FPS |
| **Compression** | High efficiency (smaller file sizes for long video) | 256-color palette with LZW compression |
| **Compatibility** | Modern video players, browsers, HTML5 video | Universal on all platforms, image viewers, and Markdown |
