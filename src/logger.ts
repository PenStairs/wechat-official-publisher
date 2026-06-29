import fs from "node:fs";
import path from "node:path";

export interface PublisherLogger {
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

export class FilePublisherLogger implements PublisherLogger {
  constructor(private readonly logFile: string) {}

  info(message: string, details?: Record<string, unknown>): void {
    this.append("info", message, details);
  }

  warn(message: string, details?: Record<string, unknown>): void {
    this.append("warn", message, details);
    console.warn(`[wechat-publisher] ${message}${details ? ` ${JSON.stringify(details)}` : ""}`);
  }

  error(message: string, details?: Record<string, unknown>): void {
    this.append("error", message, details);
  }

  private append(level: "info" | "warn" | "error", message: string, details?: Record<string, unknown>): void {
    fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
    const payload = {
      time: new Date().toISOString(),
      level,
      message,
      details
    };
    fs.appendFileSync(this.logFile, `${JSON.stringify(payload)}\n`);
  }
}

export class NullPublisherLogger implements PublisherLogger {
  info(): void {}
  warn(): void {}
  error(): void {}
}
