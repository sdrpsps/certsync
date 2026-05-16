export interface LogEvent {
  message: string;
  timestamp: string;
  level: 'info' | 'error';
}

export class AcmeLogger {
  private emitFn?: (event: LogEvent) => void;

  constructor(emitFn?: (event: LogEvent) => void) {
    this.emitFn = emitFn;
  }

  log(message: string) {
    const event: LogEvent = {
      message,
      timestamp: new Date().toISOString(),
      level: 'info'
    };
    console.log(message);
    this.emitFn?.(event);
  }

  error(message: string) {
    const event: LogEvent = {
      message,
      timestamp: new Date().toISOString(),
      level: 'error'
    };
    console.error(message);
    this.emitFn?.(event);
  }
}
