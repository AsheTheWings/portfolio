/**
 * Terminal feature exports
 */

// Components
export { Terminal } from './components/Screen';

// Stores (recommended)
export { useTerminalStore, type CommandHistory } from './stores/terminalStore';
export { usePluginStore, type ConfigSection, type ConfigSectionProps } from './stores/pluginStore';

// Command executor
export { terminalCommandExecutor } from './utils/command-executor';
