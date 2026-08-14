# Project Context & Guidelines

## 1. Project Overview
`@bunbrowser/mcp` (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)) is an ultra-fast, zero-download Model Context Protocol (MCP) server for browser automation powered natively by `Bun.WebView`. It serves as a drop-in replacement for `@playwright/mcp` with identical AI tool semantics, native OS-level user events (`isTrusted: true`), raw CDP execution, and sub-50ms startup times.

## 2. Technology Stack
* **Language & Runtime:** TypeScript (Strict mode), Bun (>= 1.3.12 / 1.4.0+)
* **Protocol & Frameworks:** Model Context Protocol (`@modelcontextprotocol/sdk`), `Bun.WebView` native bindings
* **Schema & Validation:** Zod (`zod`)
* **Package Manager:** `bun`
* **Documentation Standard:** Diátaxis Framework (`docs/`)

## 3. Essential Commands
* **Install dependencies:** `bun install`
* **Run server (stdio):** `bun start` or `bun run src/index.ts`
* **Run tests:** `bun test`
* **Typecheck:** `bun run check` (executes `bun tsc --noEmit`)

## 4. Architecture & Directory Structure
```text
bunbrowser/
├── bin/
│   ├── bunbrowser.ts        # CLI binary entry point
│   └── bunpw-mcp.ts         # Legacy alias binary entry point
├── src/
│   ├── index.ts             # Main entry point, CLI flag parsing & stdio transport
│   ├── server.ts            # MCP server initialization & tool registration
│   ├── browser/             # Core browser management
│   │   ├── manager.ts       # Multi-tab lifecycle & active tab tracking
│   │   ├── tab.ts           # Bun.WebView wrapper, actions & CDP bridges
│   │   ├── recorder.ts      # Video recording manager (TabRecorder)
│   │   ├── gif_encoder.ts   # Pure TS GIF89a encoder
│   │   ├── snapshot.ts      # Accessibility tree parsing & [ref=eN] ref resolver
│   │   └── types.ts         # Internal types & configuration options
│   └── tools/               # MCP Tool implementations
│       ├── navigation.ts    # browser_navigate, back, forward, reload
│       ├── interaction.ts   # click, type, fill_form, press_key, hover, scroll, drag, etc.
│       ├── inspection.ts    # snapshot, screenshot, evaluate, content, logs
│       ├── tabs.ts          # tabs, tab_new, tab_switch, tab_close, resize
│       ├── storage_cdp.ts   # cookies, localstorage, cdp
│       ├── metrics.ts       # get_metrics, lighthouse_audit
│       └── video.ts         # start_recording, stop_recording, record_animation
├── test/                    # Bun test suites (*.test.ts)
└── docs/                    # Diátaxis documentation structure
    ├── 1-tutorials/         # Step-by-step onboarding
    ├── 2-how-to/            # Practical task-based guides
    ├── 3-reference/         # Tool catalogs & CLI reference
    └── 4-explanation/       # Architecture & Playwright comparisons
```

## 5. Coding Standards & Conventions
* **TypeScript Strictness:** Full strict mode (`strict: true`), avoid `any` where possible, use explicit types and interfaces.
* **MCP Stdio Transport Discipline:** Never use `console.log` for debugging in server code; standard output is reserved strictly for JSON-RPC messages. Always use `console.error` for diagnostic logs.
* **Tool Semantics Compatibility:** Maintain 100% parameter schema and return type parity with `@playwright/mcp` conventions so LLM clients (Claude Desktop, Cursor, Antigravity) work interchangeably.
* **Accessibility Ref Format:** Ensure snapshot generation produces deterministic `[ref=eN]` identifiers and resolves refs, CSS selectors, or `(x, y)` coordinates reliably.

## 6. Safety & Workflow Rules
* Always run `bun test` and `bun run check` before marking any code task as complete.
* Never commit sensitive tokens, credential files, or secret keys.
* Preserve Diátaxis documentation structure when adding or updating features in `docs/`.
