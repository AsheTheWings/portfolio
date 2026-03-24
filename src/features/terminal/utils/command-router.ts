'use client';

/**
 * Command router - routes commands to feature executors
 * Pure routing, no command logic here
 */

import type { ParsedCommand, CommandResult, CommandExecutor, CommandContext } from '@/features/terminal/types';
import { textOutput } from '@/features/terminal/types';
import { terminalCommandExecutor } from './command-executor';
import { authCommandExecutor } from '@/features/authentication';

export class CommandRouter {
  private executors: CommandExecutor[] = [
    terminalCommandExecutor,    // Terminal's own commands (help, clear, config)
    authCommandExecutor,
  ];

  async execute(
    parsed: ParsedCommand,
    context?: CommandContext
  ): Promise<CommandResult> {
    const timestamp = new Date();

    // Route to appropriate executor
    for (const executor of this.executors) {
      if (executor.canHandle(parsed.command, parsed.subcommand)) {
        return await executor.execute(parsed, timestamp, context);
      }
    }

    // Unknown command
    return {
      success: false,
      output: textOutput(`Unknown command: ${parsed.command}. Type 'help' for available commands.`),
      timestamp,
    };
  }
}

// Export singleton instance
export const commandRouter = new CommandRouter();
