import {
  AgentimeCommandError,
  type AgentCommandInput,
  type CommandSuccessMessage,
} from '@agentime/client';
import type { ApplicationCommandType } from '@agentime/protocol';
import { useAgentStore } from '../stores/useAgentStore';

export async function runScopedCommand(
  execute: (command: AgentCommandInput) => Promise<CommandSuccessMessage>,
  command: AgentCommandInput,
  controlId: string,
): Promise<CommandSuccessMessage> {
  const store = useAgentStore.getState();
  store.setCommandProblem(controlId, null);
  try {
    return await execute(command);
  } catch (error) {
    if (error instanceof AgentimeCommandError) {
      store.setCommandProblem(controlId, {
        diagnosticId: error.problem.diagnosticId,
        problem: error.problem,
        delivery: 'command',
        observedAt: new Date().toISOString(),
        location: {
          kind: 'command',
          commandId: error.commandId,
          command: command.type as ApplicationCommandType,
          ...('sessionId' in command && command.sessionId
            ? { sessionId: command.sessionId }
            : {}),
          controlId,
        },
      });
    }
    throw error;
  }
}
