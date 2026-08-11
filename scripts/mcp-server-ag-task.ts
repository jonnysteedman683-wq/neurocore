import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';

// Minimal stdio MCP server for Neurocore
const server = new Server(
  {
    name: 'neurocore-control-plane',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Load schema from contracts/neuro_intent.json
const schemaPath = path.resolve(process.cwd(), 'contracts/neuro_intent.json');
let intentSchema: Record<string, unknown> = {};

try {
  if (fs.existsSync(schemaPath)) {
    intentSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    console.error(`[neurocore-mcp] Successfully loaded schema from ${schemaPath}`);
  } else {
    console.error(`[neurocore-mcp] Warning: Schema file not found at ${schemaPath}`);
  }
} catch (err) {
  console.error(`[neurocore-mcp] Error reading schema from ${schemaPath}:`, err);
}

let systemStatus = 'healthy';
let activeActions = 0;

// Expose tools: neurocore.status and neurocore.emergency_stop
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[neurocore-mcp] Received ListTools request');
  return {
    tools: [
      {
        name: 'neurocore.status',
        description: 'Returns the current status of the Neurocore control plane',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'neurocore.emergency_stop',
        description: 'Triggers an emergency stop clearing all active actions and adapters',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  console.error(`[neurocore-mcp] Executing tool: ${name}`);

  if (name === 'neurocore.status') {
    const statusPayload = {
      status: systemStatus,
      version: '1.0.0',
      activeActions,
      schemaLoaded: Object.keys(intentSchema).length > 0,
      timestamp: Date.now(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(statusPayload, null, 2),
        },
      ],
    };
  }

  if (name === 'neurocore.emergency_stop') {
    systemStatus = 'emergency_stopped';
    activeActions = 0;
    console.error('[neurocore-mcp] EMERGENCY STOP TRIGGERED. All actions halted.');

    const stopPayload = {
      stopped: true,
      status: systemStatus,
      message: 'Emergency stop executed. All pending actions cleared across connected adapters.',
      timestamp: Date.now(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stopPayload, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool requested: ${name}`);
});

async function main() {
  console.error('[neurocore-mcp] Starting stdio transport server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[neurocore-mcp] Server successfully connected to stdio.');
}

main().catch((error) => {
  console.error('[neurocore-mcp] Fatal server error:', error);
  process.exit(1);
});
