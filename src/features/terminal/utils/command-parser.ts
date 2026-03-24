'use client';

/**
 * Command parser - converts command strings to structured format
 */

export interface ParsedCommand {
  command: string;
  subcommand?: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

export class CommandParser {
  /**
   * Parse command string into structured format
   * Action-based syntax: <action> [entity] [args...] [--flags]
   * 
   * Examples:
   *   "login user pass" → { command: 'login', args: ['user', 'pass'] }
   *   "create workload \"My Task\" --desc \"Description\"" → { command: 'create', subcommand: 'workload', args: ['My Task'], flags: { desc: 'Description' } }
   *   "start slot math" → { command: 'start', subcommand: 'slot', args: ['math'] }
   *   "stop" → { command: 'stop', args: [] }
   */
  parse(input: string): ParsedCommand {
    const trimmed = input.trim();
    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    
    // Remove quotes from arguments
    const cleanParts = parts.map(p => p.replace(/^"(.*)"$/, '$1'));
    
    if (cleanParts.length === 0) {
      return {
        command: '',
        subcommand: undefined,
        args: [],
        flags: {},
      };
    }
    
    const command = cleanParts[0].toLowerCase();
    
    // Commands that don't require entity/subcommand (auth, utility)
    const standaloneCommands = ['login', 'signup', 'logout', 'whoami', 'help', 'clear', 'stop'];
    
    // Action commands that expect entity as subcommand
    const actionCommands = ['create', 'start', 'list', 'delete', 'update'];
    
    let subcommand: string | undefined;
    let startIndex: number;
    
    if (standaloneCommands.includes(command)) {
      // Standalone command - no entity required
      subcommand = undefined;
      startIndex = 1;
    } else if (actionCommands.includes(command) && cleanParts.length > 1 && !cleanParts[1].startsWith('--')) {
      // Action command with entity
      subcommand = cleanParts[1].toLowerCase();
      startIndex = 2;
    } else {
      // No subcommand
      subcommand = undefined;
      startIndex = 1;
    }
    
    const rest = cleanParts.slice(startIndex);
    
    // Separate flags from args
    const args: string[] = [];
    const flags: Record<string, string | boolean> = {};
    
    for (let i = 0; i < rest.length; i++) {
      const part = rest[i];
      if (part.startsWith('--')) {
        const flagName = part.slice(2);
        // Check if next part is a value or another flag
        if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) {
          flags[flagName] = rest[i + 1];
          i++; // Skip next part
        } else {
          flags[flagName] = true;
        }
      } else {
        args.push(part);
      }
    }
    
    return {
      command,
      subcommand,
      args,
      flags,
    };
  }
}

// Singleton instance
export const commandParser = new CommandParser();
