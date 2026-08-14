import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";

const ModifierEnum = z.enum(["Shift", "Control", "Alt", "Meta"]);

export function registerInteractionTools(server: any, manager: BrowserManager) {
  server.tool(
    "browser_click",
    "Click on an element. PREFER using 'ref' (e.g. 'e1' from browser_snapshot) for reliable deterministic targeting. Fall back to CSS selector or coordinates (x, y) if ref is unavailable.",
    {
      ref: z.string().optional().describe("PREFERRED: Element reference ID from browser_snapshot (e.g. 'e1' or 'ref=e1')"),
      selector: z.string().optional().describe("CSS selector for the target element (e.g. '#submit-btn' or 'button.primary')"),
      x: z.number().optional().describe("Viewport X coordinate in pixels"),
      y: z.number().optional().describe("Viewport Y coordinate in pixels"),
      button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button to click (default: 'left')"),
      clickCount: z.number().min(1).max(3).optional().describe("Number of clicks: 1 for single click, 2 for double click (default: 1)"),
      modifiers: z.array(ModifierEnum).optional().describe("Keyboard modifier keys to hold during the click (e.g. ['Shift'])"),
      timeout: z.number().optional().describe("Timeout waiting for element to be actionable in ms (default: 30000)"),
      snapshot: z.boolean().optional().describe("Whether to return an updated accessibility snapshot after the click (default: true)"),
    },
    async ({
      ref,
      selector,
      x,
      y,
      button = "left",
      clickCount = 1,
      modifiers,
      timeout,
      snapshot = true,
    }: {
      ref?: string;
      selector?: string;
      x?: number;
      y?: number;
      button?: "left" | "right" | "middle";
      clickCount?: number;
      modifiers?: any[];
      timeout?: number;
      snapshot?: boolean;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.click({ ref, selector, x, y }, { button, clickCount, modifiers, timeout });

        const targetDesc = ref ? `ref '${ref}'` : selector ? `selector '${selector}'` : `coordinates (${x}, ${y})`;
        let responseText = `Clicked on ${targetDesc} successfully.`;

        if (snapshot) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Updated Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Click error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_type",
    "Type text into an editable input or textarea element. Prefer using 'ref' (e.g. 'e2'). For filling multiple form fields, use browser_fill_form instead to save steps.",
    {
      ref: z.string().optional().describe("PREFERRED: Element reference ID from browser_snapshot (e.g. 'e2')"),
      selector: z.string().optional().describe("CSS selector for the input element"),
      text: z.string().describe("The text string to type into the focused element"),
      clear: z.boolean().optional().describe("Whether to clear existing text before typing (default: false)"),
      pressEnter: z.boolean().optional().describe("Whether to press Enter key immediately after typing (default: false)"),
      snapshot: z.boolean().optional().describe("Whether to return an updated accessibility snapshot after typing (default: true)"),
    },
    async ({
      ref,
      selector,
      text,
      clear = false,
      pressEnter = false,
      snapshot = true,
    }: {
      ref?: string;
      selector?: string;
      text: string;
      clear?: boolean;
      pressEnter?: boolean;
      snapshot?: boolean;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.type({ ref, selector }, text, { clear });

        if (pressEnter) {
          await tab.pressKey("Enter");
        }

        const targetDesc = ref ? `ref '${ref}'` : `selector '${selector}'`;
        let responseText = `Typed "${text}" into ${targetDesc}.`;

        if (snapshot) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Updated Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Type error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_fill_form",
    "BATCH FORM FILLER. PREFER over multiple individual browser_type calls. Fills multiple inputs and optionally clicks a submit button in a single turn.",
    {
      fields: z.array(
        z.object({
          ref: z.string().optional().describe("PREFERRED: Element reference ID from browser_snapshot (e.g. 'e1')"),
          selector: z.string().optional().describe("CSS selector for input field"),
          value: z.string().describe("Value to fill into the input"),
          clear: z.boolean().optional().describe("Clear input before typing (default: true)"),
        })
      ).describe("Array of form fields to fill sequentially"),
      submitRef: z.string().optional().describe("Optional reference ID of submit button to click after filling (e.g. 'e5')"),
      submitSelector: z.string().optional().describe("Optional selector of submit button to click after filling"),
      snapshot: z.boolean().optional().describe("Whether to return an updated snapshot after filling (default: true)"),
    },
    async ({
      fields,
      submitRef,
      submitSelector,
      snapshot = true,
    }: {
      fields: Array<{ ref?: string; selector?: string; value: string; clear?: boolean }>;
      submitRef?: string;
      submitSelector?: string;
      snapshot?: boolean;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        const tabFields = fields.map((f) => ({
          target: { ref: f.ref, selector: f.selector },
          value: f.value,
          clear: f.clear ?? true,
        }));

        await tab.fillForm(tabFields);

        let responseText = `Filled ${fields.length} form fields.`;

        if (submitRef || submitSelector) {
          await tab.click({ ref: submitRef, selector: submitSelector });
          responseText += ` Submitted form via ${submitRef ? `ref '${submitRef}'` : `selector '${submitSelector}'`}.`;
        }

        if (snapshot) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Updated Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Fill form error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_press_key",
    "Press a keyboard key or key combination (e.g. 'Enter', 'Escape', 'Tab', 'ArrowDown', 'Backspace', 'KeyA')",
    {
      key: z.string().describe("Key name to press (e.g. 'Enter', 'Escape', 'Tab', 'Backspace', 'ArrowDown', 'a')"),
      modifiers: z.array(ModifierEnum).optional().describe("Modifier keys (e.g. ['Control'] or ['Meta'])"),
      snapshot: z.boolean().optional().describe("Whether to return an updated snapshot after key press (default: false)"),
    },
    async ({
      key,
      modifiers,
      snapshot = false,
    }: {
      key: string;
      modifiers?: any[];
      snapshot?: boolean;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.pressKey(key, modifiers);

        const chordDesc = modifiers && modifiers.length > 0 ? `${modifiers.join("+")}+${key}` : key;
        let responseText = `Pressed key '${chordDesc}'.`;

        if (snapshot) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Updated Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Press key error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_hover",
    "Hover the mouse pointer over an element to trigger hover states or dropdown menus",
    {
      ref: z.string().optional().describe("Element reference ID (e.g. 'e1')"),
      selector: z.string().optional().describe("CSS selector for target element"),
      x: z.number().optional().describe("Viewport X coordinate"),
      y: z.number().optional().describe("Viewport Y coordinate"),
      snapshot: z.boolean().optional().describe("Whether to return an updated snapshot (default: true)"),
    },
    async ({
      ref,
      selector,
      x,
      y,
      snapshot = true,
    }: {
      ref?: string;
      selector?: string;
      x?: number;
      y?: number;
      snapshot?: boolean;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.hover({ ref, selector, x, y });

        const targetDesc = ref ? `ref '${ref}'` : selector ? `selector '${selector}'` : `coordinates (${x}, ${y})`;
        let responseText = `Hovered over ${targetDesc}.`;

        if (snapshot) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Updated Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Hover error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_scroll",
    "Scroll the viewport or scroll an element into view",
    {
      direction: z.enum(["up", "down", "top", "bottom"]).optional().describe("Direction to scroll"),
      deltaX: z.number().optional().describe("Horizontal scroll delta in pixels"),
      deltaY: z.number().optional().describe("Vertical scroll delta in pixels"),
      ref: z.string().optional().describe("Element ref to scroll into view"),
      selector: z.string().optional().describe("CSS selector to scroll into view"),
      snapshot: z.boolean().optional().describe("Whether to return updated snapshot (default: true)"),
    },
    async ({
      direction,
      deltaX,
      deltaY,
      ref,
      selector,
      snapshot = true,
    }: {
      direction?: "up" | "down" | "top" | "bottom";
      deltaX?: number;
      deltaY?: number;
      ref?: string;
      selector?: string;
      snapshot?: boolean;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.scroll({ direction, deltaX, deltaY, ref, selector });

        let desc = "";
        if (ref || selector) desc = `Scrolled to element ${ref ? `ref '${ref}'` : `selector '${selector}'`}`;
        else if (direction) desc = `Scrolled ${direction}`;
        else desc = `Scrolled by dx=${deltaX ?? 0}, dy=${deltaY ?? 0}`;

        let responseText = `${desc}.`;

        if (snapshot) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Updated Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Scroll error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_select_option",
    "Select one or more options in a <select> dropdown element",
    {
      ref: z.string().optional().describe("Element reference ID for <select> (e.g. 'e3')"),
      selector: z.string().optional().describe("CSS selector for <select> element"),
      values: z.union([z.string(), z.array(z.string())]).describe("Option value(s) or visible text(s) to select"),
      snapshot: z.boolean().optional().describe("Whether to return updated snapshot (default: true)"),
    },
    async ({
      ref,
      selector,
      values,
      snapshot = true,
    }: {
      ref?: string;
      selector?: string;
      values: string | string[];
      snapshot?: boolean;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.selectOption({ ref, selector }, values);

        const valStr = Array.isArray(values) ? values.join(", ") : values;
        const targetDesc = ref ? `ref '${ref}'` : `selector '${selector}'`;
        let responseText = `Selected option(s) [${valStr}] on ${targetDesc}.`;

        if (snapshot) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Updated Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Select option error: ${err.message || String(err)}` }],
        };
      }
    }
  );

  server.tool(
    "browser_drag",
    "Drag an element and drop it onto another element",
    {
      sourceRef: z.string().optional().describe("Source element ref"),
      sourceSelector: z.string().optional().describe("Source element CSS selector"),
      targetRef: z.string().optional().describe("Target element ref"),
      targetSelector: z.string().optional().describe("Target element CSS selector"),
      snapshot: z.boolean().optional().describe("Whether to return updated snapshot (default: true)"),
    },
    async ({
      sourceRef,
      sourceSelector,
      targetRef,
      targetSelector,
      snapshot = true,
    }: {
      sourceRef?: string;
      sourceSelector?: string;
      targetRef?: string;
      targetSelector?: string;
      snapshot?: boolean;
    }) => {
      try {
        const tab = await manager.getActiveTab();
        await tab.drag(
          { ref: sourceRef, selector: sourceSelector },
          { ref: targetRef, selector: targetSelector }
        );

        let responseText = `Dragged element to destination.`;

        if (snapshot) {
          const snap = await tab.snapshot();
          responseText += `\n\n### Updated Snapshot:\n${snap.treeText}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Drag error: ${err.message || String(err)}` }],
        };
      }
    }
  );
}
