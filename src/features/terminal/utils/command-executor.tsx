'use client';

/**
 * Terminal command executor
 * Handles: help, clear, config
 */

import type { ParsedCommand, CommandResult, CommandExecutor, CommandContext } from '@/features/terminal/types';
import { textOutput } from '@/features/terminal/types';
import { ConfigUI } from '../components/ConfigUI';

const TERMINAL_COMMANDS = ['help', 'clear', 'config'];

export class TerminalCommandExecutor implements CommandExecutor {
  canHandle(command: string): boolean {
    return TERMINAL_COMMANDS.includes(command);
  }

  async execute(
    parsed: ParsedCommand,
    timestamp: Date,
    context?: CommandContext
  ): Promise<CommandResult> {
    switch (parsed.command) {
      case 'help':
        return this.showHelp(timestamp);

      case 'clear':
        return this.clearConsole(timestamp);

      case 'config':
        return this.showConfig(timestamp, context);

      default:
        return {
          success: false,
          output: textOutput(`Unknown terminal command: ${parsed.command}`),
          timestamp,
        };
    }
  }

  private showHelp(timestamp: Date): CommandResult {
    const helpText = `
Available Commands:

Authentication:
  login <username/email> <password>  - Login with username or email
  signup <username> <password>       - Create new account
  logout                             - Sign out
  whoami                             - Show current user

Workload Management:
  create workload <name> [--desc "description"]
  list workloads
  delete workload <name>

Time Tracking:
  start slot [workload]              - Start tracking time (or resume last workload)
  stop slot [workload]               - Stop slot (latest or by workload name)
  stop all slots                     - Stop all active slots
  list slots [--active]              - List slots

Configuration:
  config                             - Configure session settings

General:
  help                               - Show this help
  clear                              - Clear console history
    `.trim();

    return {
      success: true,
      output: textOutput(helpText),
      timestamp,
    };
  }

  private clearConsole(timestamp: Date): CommandResult {
    return {
      success: true,
      output: { type: 'text', content: '__CLEAR__' }, // Special marker
      timestamp,
    };
  }

  private showConfig(
    timestamp: Date,
    context?: CommandContext
  ): CommandResult {
    // Create multi-domain config UI with dynamic section composition
    const component = (
      <ConfigUI
        onComplete={(resultText) => {
          // Replace component with text result
          context?.updateOutput?.({ type: 'text', content: resultText });
        }}
      />
    );

    return {
      success: true,
      output: { type: 'component', component },
      timestamp,
    };
  }
}

// Export singleton instance
export const terminalCommandExecutor = new TerminalCommandExecutor();
