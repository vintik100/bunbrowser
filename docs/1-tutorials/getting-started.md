# Tutorial: Getting Started with `@bunbrowser/mcp`

Welcome to **`@bunbrowser/mcp`** (`bunbrowser`). In this step-by-step tutorial, you will install the MCP server from [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser), connect it to your environment, and execute your first automated browser interaction powered natively by **`Bun.WebView`**.

---

## 🎯 Learning Objectives

By the end of this tutorial, you will:
1. Have configured and run `@bunbrowser/mcp` in your local environment.
2. Understand how an AI agent inspects and interacts with web pages via the semantic accessibility tree (`browser_snapshot`).
3. Execute a complete navigation, search, and interaction flow with automated verification.

---

## 📋 Prerequisites

Before you begin, ensure you have:
* **[Bun](https://bun.sh)** (version 1.3.12 or higher). Verify your installed version:
  ```bash
  bun --version
  ```
* A browser installed on your system:
  * **macOS**: Zero additional downloads needed (uses system `WKWebView`).
  * **Linux / Windows**: Google Chrome, Chromium, Microsoft Edge, or Brave.

---

## Step 1: Clone and Install Dependencies

Open your terminal and clone the repository:

```bash
git clone https://github.com/vintik100/bunbrowser.git
cd bunbrowser
bun install
```

To verify that your installation is working correctly, run the automated test suite:

```bash
bun test
```

You should see all test suites pass with zero failures:

```text
✓ Performance Metrics & Lighthouse Tools
✓ BrowserManager > should create a tab and make it active
✓ BrowserTab Interactions > should interact with elements
✓ MCP Server Integration > should list all registered browser tools
✓ Video & Animation Recording Module > should start and stop continuous video recording
...
 28 pass
 0 fail
```

---

## Step 2: Understand the Agent Interaction Loop

Unlike legacy browser automation that relies on pixel coordinates or fragile CSS selector chains, `bunpw-mcp` operates through a **semantic interaction loop**:

```text
[ AI Agent ] ───► 1. browser_navigate(url)
[ AI Agent ] ◄─── 2. Returns Page Title + Snapshot [ref=e1, ref=e2, ...]
[ AI Agent ] ───► 3. browser_type(ref="e1", text="Bun runtime")
[ AI Agent ] ───► 4. browser_click(ref="e2")
[ AI Agent ] ◄─── 5. Updated Snapshot with results
```

1. **Navigation**: The agent navigates to a URL using `browser_navigate`.
2. **Observation**: `bunpw-mcp` parses the DOM into a hierarchical accessibility tree where interactive nodes (buttons, inputs, links) are assigned deterministic references (`[e1]`, `[e2]`).
3. **Action**: The agent triggers interactions using the `ref` identifier with tools such as `browser_click`, `browser_type`, or `browser_fill_form`.

---

## Step 3: Your First Interactive Session

Let's test an automated interaction directly with a short TypeScript script.

Create a file named `first-session.ts`:

```typescript
// first-session.ts
import { BrowserManager } from "./src/browser/manager.js";

// 1. Initialize the browser manager
const manager = new BrowserManager();
const tab = await manager.getActiveTab();

console.log("1. Navigating to test page...");
await tab.navigate("https://example.com");

// 2. Capture semantic accessibility tree (Snapshot)
console.log("\n2. Capturing semantic accessibility tree:");
const snapshot = await tab.snapshot();
console.log(snapshot.treeText);

// 3. Capture and save a visual screenshot
console.log("\n3. Saving screenshot...");
const screenshot = await tab.screenshot({ format: "png" });
await Bun.write("screenshot-example.png", Buffer.from(screenshot.base64, "base64"));
console.log("Screenshot saved to 'screenshot-example.png'!");

// 4. Clean up
manager.closeAll();
```

Run the script:

```bash
bun run first-session.ts
```

### Expected Output

```text
1. Navigating to test page...

2. Capturing semantic accessibility tree:
generic
  heading "Example Domain"
  generic
    "This domain is for use in illustrative examples in documents..."
  [e1] link "More information..."

3. Saving screenshot...
Screenshot saved to 'screenshot-example.png'!
```

Notice that the link `"More information..."` was assigned identifier `[e1]`. An AI agent can click it directly using `browser_click({ ref: "e1" })`.

---

## Next Steps

Congratulations! You have completed the introductory tutorial. You are now ready to:
* Connect `bunpw-mcp` to your favorite AI client: See [Configuring MCP Clients](../2-how-to/configure-clients.md).
* Master token-efficient prompting: See [Optimal Agent Prompting Guide](../2-how-to/prompting-guide.md).
* Record video and debug animations: See [Recording Videos and Animations](../2-how-to/record-animations.md).
* Explore the full tools catalog: See [MCP Tools Reference](../3-reference/mcp-tools.md).
