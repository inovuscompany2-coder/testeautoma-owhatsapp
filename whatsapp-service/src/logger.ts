export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  userId?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
}

interface LoggerOptions {
  source: string;
  minLevel?: LogLevel;
  onLog?: (entry: LogEntry) => void | Promise<void>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private source: string;
  private minLevel: LogLevel;
  private onLog?: (entry: LogEntry) => void | Promise<void>;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(options: LoggerOptions) {
    this.source = options.source;
    this.minLevel = options.minLevel || "info";
    this.onLog = options.onLog;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}]`;
    const userInfo = entry.userId ? ` [User:${entry.userId}]` : "";
    return `${prefix}${userInfo} ${entry.message}`;
  }

  private async log(
    level: LogLevel,
    message: string,
    options?: { userId?: string; sessionId?: string; data?: Record<string, unknown> }
  ): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source: this.source,
      userId: options?.userId,
      sessionId: options?.sessionId,
      data: options?.data,
    };

    // Console output
    const formattedMessage = this.formatMessage(entry);
    switch (level) {
      case "debug":
        console.debug(formattedMessage, options?.data || "");
        break;
      case "info":
        console.log(formattedMessage, options?.data || "");
        break;
      case "warn":
        console.warn(formattedMessage, options?.data || "");
        break;
      case "error":
        console.error(formattedMessage, options?.data || "");
        break;
    }

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Callback for external handling (e.g., save to database)
    if (this.onLog) {
      try {
        await this.onLog(entry);
      } catch (e) {
        console.error("[Logger] Error in onLog callback:", e);
      }
    }
  }

  debug(message: string, options?: { userId?: string; sessionId?: string; data?: Record<string, unknown> }): void {
    this.log("debug", message, options);
  }

  info(message: string, options?: { userId?: string; sessionId?: string; data?: Record<string, unknown> }): void {
    this.log("info", message, options);
  }

  warn(message: string, options?: { userId?: string; sessionId?: string; data?: Record<string, unknown> }): void {
    this.log("warn", message, options);
  }

  error(message: string, options?: { userId?: string; sessionId?: string; data?: Record<string, unknown> }): void {
    this.log("error", message, options);
  }

  getBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  getBufferByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter((entry) => entry.level === level);
  }

  getBufferByUser(userId: string): LogEntry[] {
    return this.logBuffer.filter((entry) => entry.userId === userId);
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

// Create default logger instance for WhatsApp service
export const logger = new Logger({
  source: "whatsapp-service",
  minLevel: process.env.LOG_LEVEL as LogLevel || "info",
});

// Factory function to create loggers for different modules
export function createLogger(source: string, options?: Omit<LoggerOptions, "source">): Logger {
  return new Logger({ source, ...options });
}

// Connection event logger
export const connectionLogger = createLogger("connection");

// Message logger
export const messageLogger = createLogger("messages");
