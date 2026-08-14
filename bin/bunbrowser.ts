#!/usr/bin/env bun
import { main } from "../src/index.js";

main().catch((err) => {
  console.error("[@bunbrowser/mcp] Fatal error:", err);
  process.exit(1);
});
