# How-To Guide: Optimal Agent Prompting & Tool Selection (`prompting-guide`)

This guide explains best practices for prompting AI agents (Claude Desktop, Cursor, Antigravity, VS Code Cline) when using **`@bunbrowser/mcp`** (`bunbrowser`, GitHub: [github.com/vintik100/bunbrowser](https://github.com/vintik100/bunbrowser)), and outlines the optimal tool selection hierarchy to eliminate token waste and achieve deterministic browser automation.

---

## 1. The Golden Hierarchy of Browser Actions

To achieve maximum reliability with minimal token consumption, agents should follow this step-by-step hierarchy:

```text
[Navigate to URL] (browser_navigate)
         │
         ▼
[1. Inspect Semantics] ──► browser_snapshot (Default, fast, [ref=eN] IDs)
         │
         ├──► [2. Form Filling] ──► browser_fill_form (Batch multiple fields in 1 turn)
         │
         ├──► [3. Single Interaction] ──► browser_click / browser_type (Use ref='eN')
         │
         ├──► [4. Motion / Animation] ──► browser_record_animation (WebM / GIF over time)
         │
         └──► [5. Web Vitals & Audit] ──► browser_get_metrics / browser_lighthouse_audit
```

---

## 2. Tool Selection Rules

| Objective | Recommended Tool | Why & When to Use | Antipattern to Avoid |
| :--- | :--- | :--- | :--- |
| **Understand Page State** | `browser_snapshot` | Returns structured accessibility tree with `[ref=eN]` IDs in ~100 tokens. | Do NOT use `browser_take_screenshot` for reading text or finding buttons. |
| **Interact with Elements** | `browser_click({ ref: "e1" })` | Deterministic and robust against layout shifts and responsive CSS. | Do NOT guess fragile CSS selectors (`div > button.nth-child(2)`). |
| **Fill Forms & Submit** | `browser_fill_form` | Fills multiple inputs and clicks submit in **a single tool call**. | Do NOT call `browser_type` 5 times in consecutive turns. |
| **Visual Validation** | `browser_take_screenshot` | Base64 visual capture for image/canvas layout verification. | Only use when visual appearance or design fidelity is needed. |
| **Debug UI Animations** | `browser_record_animation` | Records CSS transitions, keyframes, and micro-interactions into WebM/GIF. | Single screenshots cannot detect jank or timing curve issues. |
| **Performance & SEO** | `browser_lighthouse_audit` | Instant 0-100 scores for Performance, A11y, SEO, and Core Web Vitals. | Do NOT write custom JS scripts for metrics manually. |

---

## 3. Recommended System Prompt for AI Clients

Add the following instructions to your client's custom system prompt (e.g. Cursor rules, Claude project instructions, or Antigravity rules):

```markdown
### Browser Automation Rules (@bunbrowser/mcp)

1. **Snapshot First**: Always use `browser_snapshot` as the primary inspection method. It provides deterministic interactive element references ([ref=eN]) and full semantic text.
2. **Targeting by Ref**: When clicking (`browser_click`) or typing (`browser_type`), always prefer the element's `ref` (e.g., `ref: "e2"`) from the latest snapshot over CSS selectors or pixel coordinates.
3. **Batch Form Filling**: For forms (logins, sign-ups, checkouts), always prefer `browser_fill_form` to fill all fields and optionally submit in a single round-trip.
4. **Animation Debugging**: To verify motion, transitions, or dynamic UI states, use `browser_record_animation` with `durationMs` and optional `triggerSelector`.
5. **Screenshots**: Reserve `browser_take_screenshot` strictly for visual design audits or when the user explicitly requests an image.
```

---

## 4. High-Efficiency User Prompt Patterns

### 🧪 Pattern A: Deterministic E2E Workflow & Form Filling

```text
Navigate to https://example.com/checkout, inspect the form with snapshot, use browser_fill_form to enter:
- Full Name: 'Jane Doe'
- Email: 'jane@example.com'
- Country: 'United States'
and submit the order. Confirm the confirmation message.
```

### 🎬 Pattern B: UI Motion & Animation Debugging

```text
Go to http://localhost:3000, trigger the navigation drawer using browser_record_animation for 1200ms in GIF format, and verify if the ease-in-out transition is smooth without layout shifts.
```

### ⚡ Pattern C: Instant Core Web Vitals & Lighthouse Audit

```text
Run browser_lighthouse_audit on https://news.ycombinator.com with detailed=true. List the top 3 opportunities to improve Largest Contentful Paint (LCP) and Cumulative Layout Shift (CLS).
```

---

## 5. Comparison: `@bunbrowser/mcp` vs `@playwright/mcp` Prompting

| Capability | `@playwright/mcp` Prompting | `@bunbrowser/mcp` Optimized Prompting |
| :--- | :--- | :--- |
| **Form Inputs** | 1 tool turn per input (`browser_type` x N) | **1 turn total** via `browser_fill_form` |
| **Animation Verification** | Not possible via MCP tools | Native `browser_record_animation` (WebM/GIF) |
| **Quality & CWV Audits** | Requires manual `browser_evaluate` scripts | Built-in `browser_lighthouse_audit` (0-100 scores) |
| **CDP Low-Level Access** | Limited | Direct `browser_cdp` support |
| **Startup Latency** | ~1.5s cold start delay | Sub-50ms instant execution |
