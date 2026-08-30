import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

describe("MCP Server Integration", () => {
  let client: Client;
  let manager: any;

  beforeAll(async () => {
    const { server, manager: mgr } = createServer();
    manager = mgr;

    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    if (manager) {
      manager.closeAll();
    }
  });

  it("should list all registered browser tools", async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((t) => t.name);

    // 1. Navigation (4)
    expect(toolNames).toContain("browser_navigate");
    expect(toolNames).toContain("browser_navigate_back");
    expect(toolNames).toContain("browser_navigate_forward");
    expect(toolNames).toContain("browser_reload");

    // 2. Inspection & State (5)
    expect(toolNames).toContain("browser_snapshot");
    expect(toolNames).toContain("browser_take_screenshot");
    expect(toolNames).toContain("browser_evaluate");
    expect(toolNames).toContain("browser_get_content");
    expect(toolNames).toContain("browser_console_logs");

    // 3. Interaction (8)
    expect(toolNames).toContain("browser_click");
    expect(toolNames).toContain("browser_type");
    expect(toolNames).toContain("browser_fill_form");
    expect(toolNames).toContain("browser_press_key");
    expect(toolNames).toContain("browser_hover");
    expect(toolNames).toContain("browser_scroll");
    expect(toolNames).toContain("browser_select_option");
    expect(toolNames).toContain("browser_drag");

    // 4. Tabs Management (5)
    expect(toolNames).toContain("browser_tabs");
    expect(toolNames).toContain("browser_tab_new");
    expect(toolNames).toContain("browser_tab_switch");
    expect(toolNames).toContain("browser_tab_close");
    expect(toolNames).toContain("browser_resize");

    // 5. Storage & CDP (3)
    expect(toolNames).toContain("browser_cdp");
    expect(toolNames).toContain("browser_cookies");
    expect(toolNames).toContain("browser_localstorage");

    // 6. Metrics & Lighthouse (2)
    expect(toolNames).toContain("browser_get_metrics");
    expect(toolNames).toContain("browser_lighthouse_audit");

    // 7. Video Recording (3)
    expect(toolNames).toContain("browser_start_recording");
    expect(toolNames).toContain("browser_stop_recording");
    expect(toolNames).toContain("browser_record_animation");
  });

  it("should execute browser_navigate and return snapshot", async () => {
    const html =
      "<h1>Welcome to Bunpw MCP</h1><button id='action-btn' onclick='window.__ok=1'>Click Here</button>";
    const res = (await client.callTool({
      name: "browser_navigate",
      arguments: {
        url: `data:text/html,${encodeURIComponent(html)}`,
        snapshot: true,
      },
    })) as any;

    expect(res.content).toBeDefined();
    const text = res.content[0].text;
    expect(text).toContain("Successfully navigated to");
    expect(text).toContain("Welcome to Bunpw MCP");
    expect(text).toContain("Click Here");
  });

  it("should execute browser_snapshot and return ref identifiers", async () => {
    const res = (await client.callTool({
      name: "browser_snapshot",
      arguments: {},
    })) as any;

    expect(res.content).toBeDefined();
    const text = res.content[0].text;
    expect(text).toMatch(/\[e\d+\]/);
    expect(text).toContain("button");
  });

  it("should execute browser_click on target", async () => {
    const res = (await client.callTool({
      name: "browser_click",
      arguments: {
        selector: "#action-btn",
        snapshot: false,
      },
    })) as any;

    expect(res.content[0].text).toContain("Clicked on selector '#action-btn'");

    const evalRes = (await client.callTool({
      name: "browser_evaluate",
      arguments: {
        script: "window.__ok",
      },
    })) as any;

    expect(evalRes.content[0].text).toBe("1");
  });

  it("should execute browser_take_screenshot", async () => {
    const res = (await client.callTool({
      name: "browser_take_screenshot",
      arguments: {
        format: "png",
      },
    })) as any;

    expect(res.content.some((c: any) => c.type === "image")).toBe(true);
  });

  it("should execute browser_fill_form", async () => {
    const html = `
      <form>
        <input id="email" type="text" />
        <input id="age" type="number" />
        <button id="send" type="button" onclick="window.__formDone = document.getElementById('email').value + ':' + document.getElementById('age').value">Submit</button>
      </form>
    `;
    await client.callTool({
      name: "browser_navigate",
      arguments: { url: `data:text/html,${encodeURIComponent(html)}` },
    });

    await client.callTool({
      name: "browser_fill_form",
      arguments: {
        fields: [
          { selector: "#email", value: "test@example.com" },
          { selector: "#age", value: "25" },
        ],
        submitSelector: "#send",
        snapshot: false,
      },
    });

    const res = (await client.callTool({
      name: "browser_evaluate",
      arguments: { script: "window.__formDone" },
    })) as any;

    expect(res.content[0].text).toBe("test@example.com:25");
  });

  it("should execute browser_press_key", async () => {
    const html = `<input id="inp" onkeydown="window.__key = event.key" />`;
    await client.callTool({
      name: "browser_navigate",
      arguments: { url: `data:text/html,${encodeURIComponent(html)}` },
    });

    await client.callTool({
      name: "browser_click",
      arguments: { selector: "#inp", snapshot: false },
    });

    await client.callTool({
      name: "browser_press_key",
      arguments: { key: "Enter" },
    });

    const res = (await client.callTool({
      name: "browser_evaluate",
      arguments: { script: "window.__key" },
    })) as any;

    expect(res.content[0].text).toBe("Enter");
  });

  it("should execute browser_scroll and browser_hover", async () => {
    const html = `<div style="height:2000px"><button id="bottom-btn" style="margin-top:1500px">Bottom</button></div>`;
    await client.callTool({
      name: "browser_navigate",
      arguments: { url: `data:text/html,${encodeURIComponent(html)}` },
    });

    const scrollRes = (await client.callTool({
      name: "browser_scroll",
      arguments: { selector: "#bottom-btn" },
    })) as any;
    expect(scrollRes.content[0].text).toContain("Scrolled to element");

    const hoverRes = (await client.callTool({
      name: "browser_hover",
      arguments: { selector: "#bottom-btn" },
    })) as any;
    expect(hoverRes.content[0].text).toContain("Hovered over selector");
  });

  it("should manage cookies and localstorage", async () => {
    await client.callTool({
      name: "browser_navigate",
      arguments: { url: "https://example.com" },
    });

    // Set cookie
    await client.callTool({
      name: "browser_cookies",
      arguments: {
        action: "set",
        name: "test_session",
        value: "abc123xyz",
      },
    });

    const cookieGet = (await client.callTool({
      name: "browser_cookies",
      arguments: { action: "get" },
    })) as any;
    expect(cookieGet.content[0].text).toContain("test_session");

    // LocalStorage
    await client.callTool({
      name: "browser_localstorage",
      arguments: {
        action: "set",
        key: "user_pref",
        value: "dark_mode",
      },
    });

    const lsGet = (await client.callTool({
      name: "browser_localstorage",
      arguments: { action: "get", key: "user_pref" },
    })) as any;
    expect(lsGet.content[0].text).toBe("dark_mode");
  });

  it("should execute browser_tabs management and new tab switching", async () => {
    const newTabRes = (await client.callTool({
      name: "browser_tab_new",
      arguments: { url: "data:text/html,<h2>New Tab Page</h2>" },
    })) as any;

    expect(newTabRes.content[0].text).toContain("Opened new Tab");

    const tabsRes = (await client.callTool({
      name: "browser_tabs",
      arguments: {},
    })) as any;
    expect(tabsRes.content[0].text).toContain("Open Tabs (2)");

    const closeRes = (await client.callTool({
      name: "browser_tab_close",
      arguments: {},
    })) as any;
    expect(closeRes.content[0].text).toContain("Tab closed successfully");
  });
});
