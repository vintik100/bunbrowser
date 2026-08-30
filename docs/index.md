# @bunbrowser/mcp Official Documentation

Welcome to the **`@bunbrowser/mcp`** (`bunbrowser`) documentation portal, organized according to the **Diátaxis Framework**. Repository: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser).

---

## 🧭 Documentation Map

```text
               LEARNING (Practical)
                        │
        [1. Tutorials]  │  [2. How-To Guides]
      Learn from zero   │  Solve concrete problems
  ──────────────────────┼───────────────────────
      [4. Explanation]  │  [3. Reference]
     Understand design  │  Look up specifications
                        │
              INFORMATION (Theoretical)
```

---

### 🎓 1. [Tutorials](./1-tutorials/getting-started.md)
*Focus: Learning-oriented lessons to guide newcomers to a successful outcome.*
* [Getting Started with `bunpw-mcp`](./1-tutorials/getting-started.md): Installation, accessibility tree fundamentals, and your first AI-driven browser automation workflow.

---

### 🛠️ 2. [How-To Guides](./2-how-to/)
*Focus: Problem-oriented recipes to solve specific development and automation tasks.*
* [Configuring MCP Clients](./2-how-to/configure-clients.md): Step-by-step setup for Claude Desktop, Cursor IDE, Antigravity, and VS Code.
* [Optimal Agent Prompting & Tool Selection](./2-how-to/prompting-guide.md): Action hierarchy, token reduction strategies, and optimized prompt patterns.
* [Recording Videos and Debugging Animations](./2-how-to/record-animations.md): Capturing UI transitions, micro-interactions, and exporting to WebM and GIF.
* [Persisting Sessions, Cookies, and LocalStorage](./2-how-to/persistent-sessions.md): Preserving logins, authentication tokens, and browser profiles.
* [Executing Raw CDP Commands](./2-how-to/cdp-raw-commands.md): Device emulation, custom headers, and low-level DevTools access.

---

### 📖 3. [Technical Reference](./3-reference/)
*Focus: Information-oriented technical descriptions of machinery, schemas, and CLI options.*
* [MCP Tools Catalog & Schemas](./3-reference/mcp-tools.md): Complete specifications for all 30 MCP tools, parameters, and return types.
* [Command-Line Options (CLI) & Environment](./3-reference/cli-options.md): Startup flags, environment variables, and exit codes.

---

### 💡 4. [Explanation & Architecture](./4-explanation/)
*Focus: Understanding-oriented discussions of design decisions, runtime internals, and architecture.*
* [Internal Architecture & Native Events](./4-explanation/architecture-bun-webview.md): How `Bun.WebView` works, native `isTrusted: true` events, and process management.
* [Technical Comparison vs. Official Playwright](./4-explanation/vs-playwright.md): Benchmarks, memory footprint, cold-start latency, and feature comparisons.
