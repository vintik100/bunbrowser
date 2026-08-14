import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

describe("Performance Metrics & Lighthouse Tools", () => {
  let client: Client;
  let manager: any;

  beforeAll(async () => {
    const { server, manager: mgr } = createServer();
    manager = mgr;

    client = new Client({ name: "test-metrics-client", version: "1.0.0" }, { capabilities: {} });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    if (manager) {
      manager.closeAll();
    }
  });

  it("should extract performance metrics via browser_get_metrics", async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head><title>Metrics Page</title></head>
        <body>
          <h1>Performance Test</h1>
          <p>Sample content for metrics</p>
        </body>
      </html>
    `;

    await client.callTool({
      name: "browser_navigate",
      arguments: { url: `data:text/html,${encodeURIComponent(html)}` },
    });

    const res = (await client.callTool({
      name: "browser_get_metrics",
      arguments: {
        includeResources: true,
        includeCdp: true,
      },
    })) as any;

    expect(res.content).toBeDefined();
    const data = JSON.parse(res.content[0].text);

    expect(data.timing).toBeDefined();
    expect(data.timing.domContentLoadedMs).toBeGreaterThanOrEqual(0);
    expect(data.resourcesSummary).toBeDefined();
  });

  it("should execute a Lighthouse audit with scores and Core Web Vitals", async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="description" content="Página de prueba optimizada para auditoría Lighthouse">
          <link rel="canonical" href="https://example.com">
          <title>Auditoría de Calidad Web</title>
        </head>
        <body>
          <h1>Título Principal de la Página</h1>
          <img src="data:image/svg+xml,<svg></svg>" alt="Logo descriptivo" />
          <form>
            <label for="name">Nombre:</label>
            <input id="name" type="text" />
          </form>
          <a href="/ayuda">Centro de ayuda</a>
        </body>
      </html>
    `;

    await client.callTool({
      name: "browser_navigate",
      arguments: { url: `data:text/html,${encodeURIComponent(html)}` },
    });

    const res = (await client.callTool({
      name: "browser_lighthouse_audit",
      arguments: {
        categories: ["performance", "accessibility", "best-practices", "seo"],
        detailed: true,
      },
    })) as any;

    expect(res.content).toBeDefined();
    const audit = JSON.parse(res.content[0].text);

    expect(audit.auditScores).toBeDefined();
    expect(audit.auditScores.performance).toBeGreaterThanOrEqual(80);
    expect(audit.auditScores.accessibility).toBe(100);
    expect(audit.auditScores.seo).toBe(100);
    expect(audit.auditScores.bestPractices).toBe(100);
    expect(audit.coreWebVitals).toBeDefined();
    expect(audit.opportunities).toBeDefined();
    expect(audit.detailedChecks).toBeDefined();
  });
});
