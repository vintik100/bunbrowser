import { afterAll, describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { BrowserTab } from "../src/browser/tab.js";

describe("BrowserTab Interactions", () => {
  const tab = new BrowserTab();

  afterAll(() => {
    tab.close();
  });

  it("should interact with elements (click, type, evaluate)", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <input id="inp" type="text" value="initial" />
          <button id="btn" onclick="document.getElementById('msg').innerText = document.getElementById('inp').value">Update</button>
          <div id="msg">None</div>
        </body>
      </html>
    `;

    await tab.navigate(`data:text/html,${encodeURIComponent(html)}`);

    // Capture snapshot to populate refs
    const snap = await tab.snapshot();
    expect(snap.elementsCount).toBeGreaterThanOrEqual(2);

    // Type with clear
    await tab.type({ selector: "#inp" }, "Bun is fast!", { clear: true });
    const val = await tab.evaluate("document.getElementById('inp').value");
    expect(val).toBe("Bun is fast!");

    // Click button
    await tab.click({ selector: "#btn" });
    const msg = await tab.evaluate("document.getElementById('msg').innerText");
    expect(msg).toBe("Bun is fast!");
  });

  it("should select option in a select dropdown", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <select id="country">
            <option value="us">United States</option>
            <option value="ca">Canada</option>
            <option value="mx">Mexico</option>
          </select>
        </body>
      </html>
    `;

    await tab.navigate(`data:text/html,${encodeURIComponent(html)}`);
    await tab.selectOption({ selector: "#country" }, "ca");

    const selectedVal = await tab.evaluate("document.getElementById('country').value");
    expect(selectedVal).toBe("ca");
  });

  it("should capture screenshot in Base64", async () => {
    await tab.navigate("data:text/html,<h1 style='color:red'>Screenshot Test</h1>");
    const { base64, mimeType } = await tab.screenshot({ format: "png" });

    expect(mimeType).toBe("image/png");
    expect(typeof base64).toBe("string");
    expect(base64!.length).toBeGreaterThan(100);
  });

  it("should save screenshot directly to disk via Bun.write", async () => {
    await tab.navigate("data:text/html,<h1 style='color:blue'>Disk Screenshot Test</h1>");
    const outputPath = `${tmpdir()}/bunbrowser-screenshot-test.png`;
    const result = await tab.screenshot({ format: "png", outputPath });

    expect(result.mimeType).toBe("image/png");
    expect(result.outputPath).toBe(outputPath);
    expect(result.base64).toBeUndefined();
    expect(result.fileSizeBytes).toBeDefined();
    expect(result.fileSizeBytes!).toBeGreaterThan(0);

    const onDisk = await Bun.file(outputPath).exists();
    expect(onDisk).toBe(true);
    expect((await Bun.file(outputPath).bytes()).length).toBe(result.fileSizeBytes!);
    await Bun.write(outputPath, new Uint8Array(0));
  });

  it("should get HTML and text content", async () => {
    await tab.navigate("data:text/html,<div><p>Hello <b>World</b></p></div>");
    const html = await tab.getContent("html");
    const text = await tab.getContent("text");

    expect(html).toContain("<b>World</b>");
    expect(text).toContain("Hello World");
  });

  it("should capture console logs", async () => {
    await tab.navigate(
      "data:text/html,<script>console.log('Test Log message'); console.warn('Warning test');</script>"
    );
    // Wait slightly for async console event dispatch
    await tab.evaluate("1 + 1");
    const logs = tab.getLogs();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const logTexts = logs.map((l) => l.text).join(" ");
    expect(logTexts).toContain("Test Log message");
  });
});
