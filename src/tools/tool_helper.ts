import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

export interface ToolConfig<T extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>> {
  description?: string;
  inputSchema?: T;
}

export type ToolResult = {
  content?: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
};

/**
 * Clean, type-safe wrapper around McpServer.registerTool to avoid TS2589 deep generic recursion
 * in TypeScript 5+ when using chained Zod schema objects.
 */
export function registerMcpTool<
  T extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>,
>(
  server: McpServer,
  name: string,
  config: ToolConfig<T>,
  handler: (args: z.infer<z.ZodObject<T>>) => Promise<ToolResult>
): void {
  (server as any).registerTool(name, config, handler);
}
