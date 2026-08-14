import { afterAll, describe, expect, it } from "bun:test";
import { resolveTarget } from "../src/browser/snapshot.js";
import { BrowserTab } from "../src/browser/tab.js";

describe("Snapshot & Ref Engine", () => {
  const tab = new BrowserTab();

  afterAll(() => {
    tab.close();
  });

  it("should resolve target refs, selectors and coords correctly", () => {
    expect(resolveTarget({ ref: "e1" }).selector).toContain('[data-bunbrowser-ref="e1"]');
    expect(resolveTarget({ ref: "ref=e5" }).selector).toContain('[data-bunbrowser-ref="e5"]');
    expect(resolveTarget({ ref: "[e2]" }).selector).toContain('[data-bunbrowser-ref="e2"]');
    expect(resolveTarget({ selector: "#btn" })).toEqual({ selector: "#btn" });
    expect(resolveTarget({ x: 100, y: 200 })).toEqual({ x: 100, y: 200 });
    expect(() => resolveTarget({})).toThrow();
  });

  it("should parse full accessibility tree with interactive element refs", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Form Test</title></head>
        <body>
          <h1>User Registration</h1>
          <form>
            <label for="uname">Username</label>
            <input id="uname" type="text" placeholder="Enter username" />

            <label for="pwd">Password</label>
            <input id="pwd" type="password" />

            <label><input type="checkbox" id="terms" checked /> Accept terms</label>

            <button type="submit" id="submit-btn">Register</button>
            <button type="button" disabled>Disabled Button</button>
            <a href="/login">Already have an account? Log in</a>
          </form>
        </body>
      </html>
    `;

    await tab.navigate(`data:text/html,${encodeURIComponent(html)}`);
    const snap = await tab.snapshot();

    expect(snap.title).toBe("Form Test");
    expect(snap.elementsCount).toBeGreaterThanOrEqual(5);
    expect(snap.treeText).toContain("heading");
    expect(snap.treeText).toContain("textbox");
    expect(snap.treeText).toContain("checkbox");
    expect(snap.treeText).toContain("[checked]");
    expect(snap.treeText).toContain("[disabled]");
    expect(snap.treeText).toContain("button");
    expect(snap.treeText).toContain("link");
    expect(snap.treeText).toMatch(/\[e\d+\]/);
  });
});
