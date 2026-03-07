import { createClaudeAgent } from './claude-agent-sdk/index.js';
import { createPiCodingAgent } from './pi-coding-agent/index.js';
import { createPiCodingAgentWithTools } from './pi-coding-agent-with-tools/index.js';
import type { Agent } from './types.js';

// Agent registry: factory functions are used so heavyweight agent initialization is
// deferred until the agent is actually requested.
const agents: Record<string, () => Agent> = {
  'claude-agent-sdk': () => createClaudeAgent(),
  'pi-coding-agent': () => createPiCodingAgent(),
  'pi-coding-agent-with-tools': () => createPiCodingAgentWithTools(),
};

/**
 * Look up an agent by name and instantiate it via the corresponding factory function.
 */
export function getAgent(name: string): Agent {
  const factory = agents[name];
  if (!factory) {
    const available = Object.keys(agents).join(', ');
    throw new Error(`Unknown agent: "${name}". Available: ${available}`);
  }
  return factory();
}

export type { Agent } from './types.js';
