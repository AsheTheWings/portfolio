export type DebugEvent = {
  source: 'system' | 'user';
  payload?: Record<string, unknown>;
};

type EventHandler = (event: DebugEvent) => void;

class DebugEmitter {
  private handlers: EventHandler[] = [];

  on(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  emit(event: DebugEvent): void {
    this.handlers.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error('Error in debug event handler:', err);
      }
    });
  }
}

export const debugEmitter = new DebugEmitter();
