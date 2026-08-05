/**
 * Function-calling adapter for the Hive Swarm Mind.
 *
 * Responsibilities:
 * - Register tools with JSON schemas
 * - Parse structured function-call intents
 * - Route to local handlers or remote execution
 * - Return normalized results
 */

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface FunctionCallIntent {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  source: string;
  confidence: number;
  requiresConfirmation: boolean;
}

export interface FunctionCallResult {
  success: boolean;
  tool: string;
  result: unknown;
  error?: string;
  latencyMs?: number | null;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

export class FunctionCallAdapter {
  private tools = new Map<string, ToolSchema>();
  private handlers = new Map<string, ToolHandler>();
  private history: FunctionCallResult[] = [];
  private maxHistory = 200;

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    this.registerTool({
      name: 'echo',
      description: 'Echo back the provided arguments for testing.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      }
    }, async (args) => ({ echo: args.message }));

    this.registerTool({
      name: 'system_status',
      description: 'Return basic system status for the current process.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }, async () => ({
      status: 'ok',
      uptime: process.uptime ? process.uptime() : null,
      memory: process.memoryUsage ? process.memoryUsage() : null
    }));
  }

  registerTool(schema: ToolSchema, handler: ToolHandler) {
    this.tools.set(schema.name, schema);
    this.handlers.set(schema.name, handler);
  }

  listTools() {
    return Array.from(this.tools.values());
  }

  async execute(intent: FunctionCallIntent): Promise<FunctionCallResult> {
    const startTime = Date.now();
    const handler = this.handlers.get(intent.tool);
    if (!handler) {
      const result: FunctionCallResult = {
        success: false,
        tool: intent.tool,
        result: null,
        error: `Unknown tool: ${intent.tool}`,
        latencyMs: Date.now() - startTime
      };
      this.record(result);
      return result;
    }

    try {
      const result = await handler(intent.arguments);
      const latencyMs = Date.now() - startTime;
      const success = result !== undefined && result !== null;
      const out: FunctionCallResult = {
        success,
        tool: intent.tool,
        result,
        latencyMs
      };
      this.record(out);
      return out;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const result: FunctionCallResult = {
        success: false,
        tool: intent.tool,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        latencyMs
      };
      this.record(result);
      return result;
    }
  }

  recent(count = 20) {
    return this.history.slice(-count);
  }

  private record(result: FunctionCallResult) {
    this.history.push(result);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }
}
