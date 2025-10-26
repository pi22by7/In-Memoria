/**
 * Safe logging utility for MCP server context
 * 
 * MCP STDIO Transport Protocol:
 * - STDOUT: Reserved for JSON-RPC messages ONLY
 * - STDERR: May be used for logging (per MCP spec)
 * 
 * When in MCP server mode, all logs go to STDERR to avoid polluting STDOUT.
 * When in CLI mode, logs go to their natural destinations (stdout/stderr).
 */

export class Logger {
  /**
   * Check if we're in MCP server mode (checked dynamically at each call)
   */
  private static isMCPServer(): boolean {
    return process.env.MCP_SERVER === 'true';
  }

  /**
   * Log an error message
   * - MCP mode: writes to stderr (allowed by MCP spec)
   * - CLI mode: writes to stderr
   */
  static error(message: string, ...args: any[]): void {
    console.error(message, ...args);
  }

  /**
   * Log an info message
   * - MCP mode: writes to stderr (allowed by MCP spec)
   * - CLI mode: writes to stdout
   */
  static info(message: string, ...args: any[]): void {
    if (this.isMCPServer()) {
      // In MCP mode, write to stderr instead of stdout
      // MCP spec allows stderr for logging
      console.error(message, ...args);
    } else {
      console.log(message, ...args);
    }
  }

  /**
   * Log a warning message
   * - MCP mode: writes to stderr (allowed by MCP spec)
   * - CLI mode: writes to stderr
   */
  static warn(message: string, ...args: any[]): void {
    console.warn(message, ...args);
  }

  /**
   * Log a debug message (only when DEBUG=true)
   * - MCP mode: writes to stderr (allowed by MCP spec)
   * - CLI mode: writes to stderr
   */
  static debug(message: string, ...args: any[]): void {
    if (process.env.DEBUG === 'true') {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  }
}
