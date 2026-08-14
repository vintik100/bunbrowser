import { BrowserTab, type CreateTabOptions } from "./tab.js";
import type { BrowserConfig, TabInfo } from "./types.js";

export class BrowserManager {
  private tabs: Map<string, BrowserTab> = new Map();
  private activeTabId: string | null = null;
  private tabCounter = 1;
  private config: BrowserConfig;
  private isCleanedUp = false;

  constructor(config: BrowserConfig = {}) {
    this.config = config;
    this.setupExitHandlers();
  }

  private setupExitHandlers() {
    const cleanup = () => {
      this.closeAll();
    };

    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      cleanup();
      process.exit(0);
    });
  }

  public async createTab(url?: string, options: Partial<CreateTabOptions> = {}): Promise<BrowserTab> {
    const tabId = options.id || `tab_${this.tabCounter++}`;
    const targetUrl = url || options.url || this.config.initialUrl;

    const tab = new BrowserTab({
      id: tabId,
      width: options.width || this.config.defaultWidth || 1280,
      height: options.height || this.config.defaultHeight || 720,
      backend: options.backend || this.config.backend,
      dataStore: options.dataStore || this.config.dataStore,
      url: targetUrl,
    });

    this.tabs.set(tabId, tab);
    this.activeTabId = tabId;

    if (targetUrl && !tab.url) {
      await tab.navigate(targetUrl);
    }

    return tab;
  }

  public async getActiveTab(autoCreate = true): Promise<BrowserTab> {
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      return this.tabs.get(this.activeTabId)!;
    }

    if (this.tabs.size > 0) {
      const firstTab = this.tabs.values().next().value;
      if (firstTab) {
        this.activeTabId = firstTab.id;
        return firstTab;
      }
    }

    if (autoCreate) {
      return await this.createTab();
    }

    throw new Error("No active browser tabs available.");
  }

  public getTab(id: string): BrowserTab | undefined {
    return this.tabs.get(id);
  }

  public switchTab(id: string): BrowserTab {
    const tab = this.tabs.get(id);
    if (!tab) {
      throw new Error(`Tab with id '${id}' not found.`);
    }
    this.activeTabId = id;
    return tab;
  }

  public async closeTab(id?: string): Promise<boolean> {
    const targetId = id || this.activeTabId;
    if (!targetId || !this.tabs.has(targetId)) {
      return false;
    }

    const tab = this.tabs.get(targetId)!;
    tab.close();
    this.tabs.delete(targetId);

    if (this.activeTabId === targetId) {
      if (this.tabs.size > 0) {
        this.activeTabId = this.tabs.keys().next().value || null;
      } else {
        this.activeTabId = null;
      }
    }

    return true;
  }

  public listTabs(): TabInfo[] {
    const result: TabInfo[] = [];
    for (const [id, tab] of this.tabs.entries()) {
      result.push(tab.getInfo(id === this.activeTabId));
    }
    return result;
  }

  public closeAll(): void {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true;

    for (const tab of this.tabs.values()) {
      try {
        tab.close();
      } catch {}
    }
    this.tabs.clear();
    this.activeTabId = null;
  }
}
