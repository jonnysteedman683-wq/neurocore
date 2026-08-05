# Neurocore

Swarm-capable neural interface control plane. Connects neural signal decoding (EEG/BCI) with OMNIBUS swarm execution through a typed, safety-gated control layer.

## Architecture

```
Hermes (operator) 
   ↓ MCP tools
 Neurocore Core
   ├── Safety Gate    (emergency stop, policy, audit)
   ├── Contracts      (shared typed schemas)
   ├── Neural Adapter (decodes signals into intents)
   └── Swarm Adapter  (routes intents → OMNIBUS)
```

## Streams

| Stream | Operator | Path | Responsibility |
|--------|----------|------|----------------|
| You | Hermes | `neurocore/` | Integration, contracts, reviews |
| Antigravity | Antigravity | `OMNIBUS/Nuerocore-swarm.ts` | Swarm adapter + execution |
| AI Studio | Gemini | `experimental_ml.js` | Neural signal decoder |

## Usage

```bash
# Run tests
pnpm test

# Build adapters
pnpm build

# Start Hermes MCP server
node adapters/mcp/dist/index.js
```

Work in progress — production has begun.
