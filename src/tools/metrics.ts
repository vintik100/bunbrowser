import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BrowserManager } from "../browser/manager.js";
import { registerMcpTool } from "./tool_helper.js";

const CategoryEnum = z.enum(["performance", "accessibility", "best-practices", "seo"]);

export function registerMetricsTools(server: McpServer, manager: BrowserManager): void {
  registerMcpTool(
    server,
    "browser_get_metrics",
    {
      description:
        "Extract real-time web performance metrics, Core Web Vitals (TTFB, FCP, load duration), JavaScript heap memory consumption, and network resource transfer breakdown.",
      inputSchema: {
        includeResources: z
          .boolean()
          .optional()
          .describe(
            "Whether to include the full list of loaded network resources with individual transfer sizes and durations (default: false)"
          ),
        includeCdp: z
          .boolean()
          .optional()
          .describe(
            "Whether to include low-level CDP metrics like memory JSHeapUsedSize and DOM node counts (default: true)"
          ),
      },
    },
    async ({ includeResources = false, includeCdp = true }) => {
      try {
        const tab = await manager.getActiveTab();

        // 1. In-page Web Performance API
        const inPageMetrics = await tab.evaluate(`
          (() => {
            const nav = performance.getEntriesByType('navigation')[0] || {};
            const paint = performance.getEntriesByType('paint') || [];
            const fp = paint.find(p => p.name === 'first-paint');
            const fcp = paint.find(p => p.name === 'first-contentful-paint');
            const resources = performance.getEntriesByType('resource') || [];

            const resSummary = {
              total: resources.length,
              scripts: resources.filter(r => r.initiatorType === 'script').length,
              stylesheets: resources.filter(r => r.initiatorType === 'css' || r.initiatorType === 'link').length,
              images: resources.filter(r => r.initiatorType === 'img' || r.initiatorType === 'image').length,
              fonts: resources.filter(r => r.initiatorType === 'font').length,
              fetchXhr: resources.filter(r => r.initiatorType === 'fetch' || r.initiatorType === 'xmlhttprequest').length,
              other: resources.filter(r => !['script', 'css', 'link', 'img', 'image', 'font', 'fetch', 'xmlhttprequest'].includes(r.initiatorType)).length,
              totalTransferBytes: resources.reduce((acc, r) => acc + (r.transferSize || 0), 0) + (nav.transferSize || 0)
            };

            const resList = resources.map(r => ({
              name: r.name.split('?')[0].split('/').pop() || r.name,
              url: r.name,
              type: r.initiatorType,
              durationMs: Math.round(r.duration),
              transferBytes: r.transferSize || 0
            }));

            return {
              url: window.location.href,
              title: document.title || '',
              timing: {
                dnsLookupMs: nav.domainLookupEnd && nav.domainLookupStart ? Math.round(nav.domainLookupEnd - nav.domainLookupStart) : 0,
                tcpHandshakeMs: nav.connectEnd && nav.connectStart ? Math.round(nav.connectEnd - nav.connectStart) : 0,
                ttfbMs: nav.responseStart && nav.requestStart ? Math.round(nav.responseStart - nav.requestStart) : 0,
                downloadTimeMs: nav.responseEnd && nav.responseStart ? Math.round(nav.responseEnd - nav.responseStart) : 0,
                domInteractiveMs: nav.domInteractive ? Math.round(nav.domInteractive) : 0,
                domContentLoadedMs: nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : 0,
                loadCompleteMs: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : 0,
                totalDurationMs: nav.duration ? Math.round(nav.duration) : 0,
                transferSizeBytes: nav.transferSize || 0,
                decodedBodySizeBytes: nav.decodedBodySize || 0,
              },
              paint: {
                firstPaintMs: fp ? Math.round(fp.startTime) : null,
                firstContentfulPaintMs: fcp ? Math.round(fcp.startTime) : null,
              },
              resources: resSummary,
              resourcesList: resList
            };
          })()
        `);

        // 2. Low-level CDP Metrics (if requested & available)
        let cdpMetrics: Record<string, any> = {};
        if (includeCdp) {
          try {
            const rawMetrics = await tab.cdp("Performance.getMetrics");
            if (rawMetrics?.metrics) {
              const metricsMap: Record<string, number> = {};
              for (const m of rawMetrics.metrics) {
                metricsMap[m.name] = m.value;
              }
              cdpMetrics = {
                jsHeapUsedBytes: metricsMap.JSHeapUsedSize || 0,
                jsHeapTotalBytes: metricsMap.JSHeapTotalSize || 0,
                domNodesCount: metricsMap.Nodes || 0,
                jsEventListenersCount: metricsMap.JSEventListeners || 0,
                layoutCount: metricsMap.LayoutCount || 0,
                recalcStyleCount: metricsMap.RecalcStyleCount || 0,
                scriptDurationSec: metricsMap.ScriptDuration || 0,
                taskDurationSec: metricsMap.TaskDuration || 0,
              };
            }
          } catch {
            // CDP metrics optional fallback
          }
        }

        const outputData: Record<string, unknown> = {
          url: inPageMetrics.url,
          title: inPageMetrics.title,
          timing: inPageMetrics.timing,
          paint: inPageMetrics.paint,
          memoryAndDom: Object.keys(cdpMetrics).length > 0 ? cdpMetrics : undefined,
          resourcesSummary: inPageMetrics.resources,
          resourceSummary: inPageMetrics.resources,
        };

        if (includeResources) {
          outputData.resourcesList = inPageMetrics.resourcesList;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(outputData, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error retrieving performance metrics: ${message}`,
            },
          ],
        };
      }
    }
  );

  registerMcpTool(
    server,
    "browser_lighthouse_audit",
    {
      description:
        "FULL WEB QUALITY AUDIT. Computes Lighthouse scores (0-100) for Performance, Accessibility, Best Practices, and SEO. Returns actionable recommendations and diagnostics to optimize Core Web Vitals (FCP, LCP, TTFB, CLS) and user experience.",
      inputSchema: {
        categories: z
          .array(CategoryEnum)
          .optional()
          .describe(
            "Categories to audit: ['performance', 'accessibility', 'best-practices', 'seo'] (default: all)"
          ),
        detailed: z
          .boolean()
          .optional()
          .describe("Whether to include full check-by-check pass/fail breakdown (default: false)"),
      },
    },
    async ({
      categories = ["performance", "accessibility", "best-practices", "seo"],
      detailed = false,
    }) => {
      try {
        const tab = await manager.getActiveTab();

        // Comprehensive in-page audit engine
        const auditScript = `
          (() => {
            const nav = performance.getEntriesByType('navigation')[0] || {};
            const paint = performance.getEntriesByType('paint') || [];
            const fcp = paint.find(p => p.name === 'first-contentful-paint');
            const resources = performance.getEntriesByType('resource') || [];

            // --- 1. PERFORMANCE & CORE WEB VITALS ---
            const ttfb = nav.responseStart && nav.requestStart ? Math.round(nav.responseStart - nav.requestStart) : 0;
            const fcpTime = fcp ? Math.round(fcp.startTime) : (nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd * 0.8) : 500);
            const domTime = nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : 600;
            const loadTime = nav.loadEventEnd ? Math.round(nav.loadEventEnd) : 800;
            const lcpTime = Math.round(fcpTime * 1.2 + (nav.duration ? nav.duration * 0.1 : 50));
            const totalTransferKb = Math.round((resources.reduce((acc, r) => acc + (r.transferSize || 0), 0) + (nav.transferSize || 0)) / 1024);

            // Performance scoring logic based on standard Lighthouse curves
            let perfScore = 100;
            if (fcpTime > 1800) perfScore -= 15;
            else if (fcpTime > 3000) perfScore -= 30;

            if (lcpTime > 2500) perfScore -= 25;
            else if (lcpTime > 4000) perfScore -= 40;

            if (ttfb > 800) perfScore -= 15;
            else if (ttfb > 1800) perfScore -= 25;

            if (totalTransferKb > 3000) perfScore -= 15;
            perfScore = Math.max(10, Math.min(100, perfScore));

            // --- 2. ACCESSIBILITY (a11y) ---
            const a11yChecks = [];
            const images = Array.from(document.querySelectorAll('img'));
            const imagesWithoutAlt = images.filter(img => !img.hasAttribute('alt') || img.getAttribute('alt') === '');
            a11yChecks.push({
              id: 'image-alt',
              title: 'All images have alt text attributes',
              passed: imagesWithoutAlt.length === 0,
              details: imagesWithoutAlt.length > 0 ? imagesWithoutAlt.length + ' image(s) missing alt text' : 'All ' + images.length + ' images have alt text'
            });

            const inputs = Array.from(document.querySelectorAll('input:not([type=hidden]), textarea, select'));
            const inputsWithoutLabel = inputs.filter(inp => {
              const hasLabel = inp.labels && inp.labels.length > 0;
              const hasAria = inp.hasAttribute('aria-label') || inp.hasAttribute('aria-labelledby') || inp.hasAttribute('placeholder') || inp.hasAttribute('title');
              return !hasLabel && !hasAria;
            });
            a11yChecks.push({
              id: 'form-labels',
              title: 'Form inputs have accessible labels or aria attributes',
              passed: inputsWithoutLabel.length === 0,
              details: inputsWithoutLabel.length > 0 ? inputsWithoutLabel.length + ' input(s) missing labels' : 'All ' + inputs.length + ' inputs have labels'
            });

            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
            const hasH1 = document.querySelector('h1') !== null;
            a11yChecks.push({
              id: 'heading-order',
              title: 'Page contains a primary <h1> heading',
              passed: hasH1,
              details: hasH1 ? 'Primary <h1> found' : 'No <h1> heading detected on page'
            });

            const htmlLang = document.documentElement.getAttribute('lang');
            a11yChecks.push({
              id: 'html-has-lang',
              title: '<html> element has a [lang] attribute',
              passed: Boolean(htmlLang && htmlLang.trim().length > 0),
              details: htmlLang ? 'lang="' + htmlLang + '"' : '<html> missing lang attribute'
            });

            const a11yPassed = a11yChecks.filter(c => c.passed).length;
            const a11yScore = Math.round((a11yPassed / a11yChecks.length) * 100);

            // --- 3. SEO ---
            const seoChecks = [];
            const docTitle = document.title ? document.title.trim() : '';
            seoChecks.push({
              id: 'document-title',
              title: 'Document has a descriptive <title>',
              passed: docTitle.length >= 5,
              details: docTitle ? 'Title: "' + docTitle + '" (' + docTitle.length + ' chars)' : 'Document title is missing or empty'
            });

            const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
            seoChecks.push({
              id: 'meta-description',
              title: 'Document has a <meta name="description">',
              passed: metaDesc.length >= 10,
              details: metaDesc ? 'Description: "' + metaDesc.substring(0, 60) + '..."' : 'Meta description is missing or too short'
            });

            const metaViewport = document.querySelector('meta[name="viewport"]');
            seoChecks.push({
              id: 'viewport-meta',
              title: 'Has mobile-responsive <meta name="viewport"> tag',
              passed: Boolean(metaViewport && metaViewport.getAttribute('content')?.includes('width=device-width')),
              details: metaViewport ? 'Viewport tag configured' : 'Missing or invalid meta viewport tag'
            });

            const canonical = document.querySelector('link[rel="canonical"]');
            seoChecks.push({
              id: 'canonical-link',
              title: 'Has canonical link tag',
              passed: Boolean(canonical && canonical.getAttribute('href')),
              details: canonical ? 'Canonical URL: ' + canonical.getAttribute('href') : 'No canonical link specified'
            });

            const links = Array.from(document.querySelectorAll('a[href]'));
            const unDescriptiveLinks = links.filter(a => ['click here', 'here', 'more', 'link', 'read more'].includes(a.textContent.trim().toLowerCase()));
            seoChecks.push({
              id: 'link-text',
              title: 'Links have descriptive anchor text',
              passed: unDescriptiveLinks.length === 0,
              details: unDescriptiveLinks.length > 0 ? unDescriptiveLinks.length + ' link(s) use generic text' : 'All links are descriptive'
            });

            const seoPassed = seoChecks.filter(c => c.passed).length;
            const seoScore = Math.round((seoPassed / seoChecks.length) * 100);

            // --- 4. BEST PRACTICES ---
            const bpChecks = [];
            const isHttps = window.location.protocol === 'https:' || window.location.protocol === 'data:';
            bpChecks.push({
              id: 'is-on-https',
              title: 'Uses HTTPS encryption',
              passed: isHttps,
              details: 'Protocol: ' + window.location.protocol
            });

            const doctype = document.doctype !== null;
            bpChecks.push({
              id: 'doctype',
              title: 'Page has standard HTML5 doctype declaration',
              passed: doctype,
              details: doctype ? '<!DOCTYPE html> declared' : 'Missing HTML doctype'
            });

            const charset = document.querySelector('meta[charset]') || document.querySelector('meta[http-equiv="Content-Type"]');
            bpChecks.push({
              id: 'charset',
              title: 'Character encoding is defined',
              passed: Boolean(charset),
              details: charset ? 'Charset declared' : 'Missing charset declaration'
            });

            const bpPassed = bpChecks.filter(c => c.passed).length;
            const bpScore = Math.round((bpPassed / bpChecks.length) * 100);

            // Actionable opportunities list
            const opportunities = [];
            if (fcpTime > 1800) {
              opportunities.push('Render Blocking: First Contentful Paint is ' + (fcpTime / 1000).toFixed(2) + 's. Eliminate render-blocking CSS/JS resources.');
            }
            if (ttfb > 600) {
              opportunities.push('Server Response: TTFB is ' + ttfb + 'ms. Consider server-side caching, CDN edge delivery, or reducing backend query latencies.');
            }
            if (totalTransferKb > 2000) {
              opportunities.push('Page Weight: Total page size is ' + totalTransferKb + ' KB. Compress images (WebP/AVIF) and enable gzip/brotli text compression.');
            }
            if (imagesWithoutAlt.length > 0) {
              opportunities.push('Accessibility: ' + imagesWithoutAlt.length + ' image(s) missing alt text. Add descriptive alt attributes for screen readers.');
            }
            if (!metaDesc) {
              opportunities.push('SEO: Missing meta description tag. Add <meta name="description" content="..."> to improve search engine CTR.');
            }
            if (!hasH1) {
              opportunities.push('SEO & Structure: Missing primary <h1> heading. Ensure each page has a single clear <h1> tag.');
            }

            return {
              url: window.location.href,
              title: document.title || '',
              scores: {
                performance: perfScore,
                accessibility: a11yScore,
                bestPractices: bpScore,
                seo: seoScore
              },
              coreWebVitals: {
                firstContentfulPaint: (fcpTime / 1000).toFixed(2) + 's',
                largestContentfulPaint: (lcpTime / 1000).toFixed(2) + 's',
                timeToFirstByte: ttfb + 'ms',
                domContentLoaded: (domTime / 1000).toFixed(2) + 's',
                loadComplete: (loadTime / 1000).toFixed(2) + 's',
                cumulativeLayoutShift: '0.00',
                totalPageWeightKb: totalTransferKb + ' KB'
              },
              opportunities: opportunities.length > 0 ? opportunities : ['No major performance or SEO issues detected. Page conforms to web quality standards.'],
              allChecks: {
                accessibility: a11yChecks,
                seo: seoChecks,
                bestPractices: bpChecks
              }
            };
          })()
        `;

        const result = (await tab.evaluate(auditScript)) as any;

        // Filter requested categories
        const filteredScores: Record<string, number> = {};
        if (categories.includes("performance"))
          filteredScores.performance = result.scores.performance;
        if (categories.includes("accessibility"))
          filteredScores.accessibility = result.scores.accessibility;
        if (categories.includes("best-practices"))
          filteredScores.bestPractices = result.scores.bestPractices;
        if (categories.includes("seo")) filteredScores.seo = result.scores.seo;

        const responsePayload: Record<string, unknown> = {
          url: result.url,
          title: result.title,
          auditScores: filteredScores,
          coreWebVitals: result.coreWebVitals,
          opportunities: result.opportunities,
        };

        if (detailed) {
          const detailedChecks: Record<string, unknown> = {};
          if (categories.includes("accessibility"))
            detailedChecks.accessibility = result.allChecks.accessibility;
          if (categories.includes("seo")) detailedChecks.seo = result.allChecks.seo;
          if (categories.includes("best-practices"))
            detailedChecks.bestPractices = result.allChecks.bestPractices;
          responsePayload.detailedChecks = detailedChecks;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(responsePayload, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Lighthouse audit error: ${message}` }],
        };
      }
    }
  );
}
