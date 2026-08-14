import { describe, expect, it, afterAll } from "bun:test";
import { BrowserManager } from "../src/browser/manager.js";

describe("BrowserManager", () => {
  const manager = new BrowserManager({ defaultWidth: 1024, defaultHeight: 768 });

  afterAll(() => {
    manager.closeAll();
  });

  it("should create a tab and make it active", async () => {
    const tab = await manager.createTab("data:text/html,<h1>Tab 1</h1>");
    expect(tab).toBeDefined();
    expect(tab.width).toBe(1024);
    expect(tab.height).toBe(768);

    const active = await manager.getActiveTab();
    expect(active.id).toBe(tab.id);
  });

  it("should list tabs and track active tab", async () => {
    const tab2 = await manager.createTab("data:text/html,<h1>Tab 2</h1>");
    const tabs = manager.listTabs();

    expect(tabs.length).toBeGreaterThanOrEqual(2);
    const activeTab = tabs.find((t) => t.isActive);
    expect(activeTab?.id).toBe(tab2.id);
  });

  it("should switch tabs", async () => {
    const tabs = manager.listTabs();
    const firstTab = tabs[0];

    const switched = manager.switchTab(firstTab.id);
    expect(switched.id).toBe(firstTab.id);

    const active = await manager.getActiveTab();
    expect(active.id).toBe(firstTab.id);
  });

  it("should close a tab", async () => {
    const tabsBefore = manager.listTabs();
    const tabToClose = tabsBefore[tabsBefore.length - 1];

    const closed = await manager.closeTab(tabToClose.id);
    expect(closed).toBe(true);

    const tabsAfter = manager.listTabs();
    expect(tabsAfter.length).toBe(tabsBefore.length - 1);
  });
});
