/**
 * MCP-compliant error handling system for In Memoria
 * Provides structured error types following JSON-RPC 2.0 specification
 * Compatible with Model Context Protocol requirements
 */

export enum MCPErrorCode {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // MCP-specific error codes (reserved range: -32000 to -32099)
  RESOURCE_NOT_FOUND = -32001,
  RESOURCE_ACCESS_DENIED = -32002,
  TOOL_EXECUTION_FAILED = -32003,
  PROTOCOL_VIOLATION = -32004,
  INITIALIZATION_FAILED = -32005,
  TRANSPORT_ERROR = -32006,
  AUTHENTICATION_FAILED = -32007,
  SESSION_EXPIRED = -32008,
  RATE_LIMITED = -32009,
  SERVICE_UNAVAILABLE = -32010,
}

export enum ErrorCode {
  // System/Infrastructure Errors (1000-1999)
  PLATFORM_UNSUPPORTED = 1001,
  NATIVE_BINDING_FAILED = 1002,
  DATABASE_INIT_FAILED = 1003,
  DATABASE_MIGRATION_FAILED = 1004,
  VECTOR_DB_INIT_FAILED = 1005,
  CIRCUIT_BREAKER_OPEN = 1006,

  // File System Errors (2000-2999)
  FILE_NOT_FOUND = 2001,
  FILE_READ_FAILED = 2002,
  FILE_WRITE_FAILED = 2003,
  DIRECTORY_NOT_FOUND = 2004,
  PERMISSION_DENIED = 2005,
  INVALID_PATH = 2006,

  // Parsing/Analysis Errors (3000-3999)
  LANGUAGE_UNSUPPORTED = 3001,
  PARSE_FAILED = 3002,
  TREE_SITTER_FAILED = 3003,
  CONCEPT_EXTRACTION_FAILED = 3004,
  PATTERN_ANALYSIS_FAILED = 3005,
  SEMANTIC_ANALYSIS_FAILED = 3006,

  // Configuration Errors (4000-4999)
  INVALID_CONFIG = 4001,
  MISSING_CONFIG = 4002,
  CONFIG_VALIDATION_FAILED = 4003,
  SETUP_INCOMPLETE = 4004,

  // Network/External Errors (5000-5999)
  NETWORK_TIMEOUT = 5001,
  EXTERNAL_SERVICE_FAILED = 5002,
  RATE_LIMIT_EXCEEDED = 5003,

  // User Input Errors (6000-6999)
  INVALID_ARGS = 6001,
  MISSING_ARGS = 6002,
  VALIDATION_FAILED = 6003,
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  operation?: string;
  filePath?: string;
  language?: string;
  component?: string;
  timestamp?: Date;
  stack?: string;
  additionalInfo?: Record<string, any>;
}

export interface RecoveryAction {
  description: string;
  command?: string;
  automated?: boolean;
}

/**
 * MCP-compliant error response following JSON-RPC 2.0 specification
 */
export interface MCPErrorResponse {
  code: MCPErrorCode;
  message: string;
  data?: {
    type?: string;
    context?: ErrorContext;
    recoveryActions?: RecoveryAction[];
    timestamp?: string;
    requestId?: string;
    [key: string]: any;
  };
}

/**
 * JSON-RPC 2.0 error object for MCP protocol compliance
 */
export interface JSONRPCError {
  jsonrpc: '2.0';
  error: MCPErrorResponse;
  id: string | number | null;
}

export class InMemoriaError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly recoveryActions: RecoveryAction[];
  public readonly userMessage: string;
  public readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {},
    recoveryActions: RecoveryAction[] = [],
    originalError?: Error
  ) {
    super(message);
    this.name = 'InMemoriaError';
    this.code = code;
    this.severity = severity;
    this.userMessage = userMessage;
    this.context = {
      ...context,
      timestamp: new Date(),
      stack: originalError?.stack || this.stack
    };
    this.recoveryActions = recoveryActions;
    this.originalError = originalError;
  }

  /**
   * Get a formatted error message for display to users
   */
  getFormattedMessage(): string {
    const parts = [
      `❌ ${this.userMessage}`,
      `   Code: ${this.code}`,
      this.context.operation && `   Operation: ${this.context.operation}`,
      this.context.filePath && `   File: ${this.context.filePath}`,
      this.context.component && `   Component: ${this.context.component}`
    ].filter(Boolean);

    if (this.recoveryActions.length > 0) {
      parts.push('', '💡 Suggested actions:');
      this.recoveryActions.forEach((action, i) => {
        parts.push(`   ${i + 1}. ${action.description}`);
        if (action.command) {
          parts.push(`      Run: ${action.command}`);
        }
      });
    }

    return parts.join('\n');
  }

  /**
   * Convert to a JSON-serializable object
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      context: this.context,
      recoveryActions: this.recoveryActions,
      originalError: this.originalError?.message
    };
  }

  /**
   * Convert to MCP-compliant error response
   */
  toMCPError(requestId?: string | number): MCPErrorResponse {
    // Map internal error codes to MCP error codes
    const mcpCode = this.getMCPErrorCode();
    
    return {
      code: mcpCode,
      message: this.userMessage,
      data: {
        type: this.name,
        context: this.context,
        recoveryActions: this.recoveryActions,
        timestamp: this.context.timestamp?.toISOString(),
        requestId: requestId?.toString(),
        internalCode: this.code,
        severity: this.severity,
        originalMessage: this.message
      }
    };
  }

  /**
   * Convert to JSON-RPC 2.0 error response
   */
  toJSONRPCError(requestId: string | number | null): JSONRPCError {
    return {
      jsonrpc: '2.0',
      error: this.toMCPError(requestId || undefined),
      id: requestId
    };
  }

  /**
   * Map internal error codes to MCP error codes
   */
  private getMCPErrorCode(): MCPErrorCode {
    switch (this.code) {
      case ErrorCode.FILE_NOT_FOUND:
      case ErrorCode.DIRECTORY_NOT_FOUND:
        return MCPErrorCode.RESOURCE_NOT_FOUND;
      
      case ErrorCode.PERMISSION_DENIED:
        return MCPErrorCode.RESOURCE_ACCESS_DENIED;
      
      case ErrorCode.INVALID_ARGS:
      case ErrorCode.MISSING_ARGS:
      case ErrorCode.VALIDATION_FAILED:
        return MCPErrorCode.INVALID_PARAMS;
      
      case ErrorCode.LANGUAGE_UNSUPPORTED:
      case ErrorCode.CONCEPT_EXTRACTION_FAILED:
      case ErrorCode.PATTERN_ANALYSIS_FAILED:
      case ErrorCode.SEMANTIC_ANALYSIS_FAILED:
        return MCPErrorCode.TOOL_EXECUTION_FAILED;
      
      case ErrorCode.PARSE_FAILED:
      case ErrorCode.TREE_SITTER_FAILED:
        return MCPErrorCode.PROTOCOL_VIOLATION;
      
      case ErrorCode.DATABASE_INIT_FAILED:
      case ErrorCode.DATABASE_MIGRATION_FAILED:
      case ErrorCode.VECTOR_DB_INIT_FAILED:
      case ErrorCode.SETUP_INCOMPLETE:
        return MCPErrorCode.INITIALIZATION_FAILED;
      
      case ErrorCode.PLATFORM_UNSUPPORTED:
      case ErrorCode.NATIVE_BINDING_FAILED:
        return MCPErrorCode.SERVICE_UNAVAILABLE;
      
      case ErrorCode.CIRCUIT_BREAKER_OPEN:
        return MCPErrorCode.SERVICE_UNAVAILABLE;
      
      case ErrorCode.NETWORK_TIMEOUT:
      case ErrorCode.EXTERNAL_SERVICE_FAILED:
        return MCPErrorCode.TRANSPORT_ERROR;
      
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return MCPErrorCode.RATE_LIMITED;
      
      default:
        return MCPErrorCode.INTERNAL_ERROR;
    }
  }
}

/**
 * Factory functions for creating common errors with appropriate context
 */
export class ErrorFactory {
  static platformUnsupported(platform: string, arch: string): InMemoriaError {
    return new InMemoriaError(
      ErrorCode.PLATFORM_UNSUPPORTED,
      `Unsupported platform: ${platform}-${arch}`,
      'Your platform is not currently supported.',
      ErrorSeverity.CRITICAL,
      { component: 'native-binding', additionalInfo: { platform, arch } },
      [
        { description: 'Check supported platforms in documentation' },
        { description: 'Build from source if needed', command: 'npm run build:rust' }
      ]
    );
  }

  static nativeBindingFailed(originalError: Error, platform?: string): InMemoriaError {
    return new InMemoriaError(
      ErrorCode.NATIVE_BINDING_FAILED,
      `Failed to load native binary: ${originalError.message}`,
      'Could not load required native components.',
      ErrorSeverity.CRITICAL,
      { component: 'native-binding', additionalInfo: { platform } },
      [
        { description: 'Reinstall dependencies', command: 'npm install' },
        { description: 'Rebuild native components', command: 'npm run build:rust' },
        { description: 'Check Node.js version compatibility' }
      ],
      originalError
    );
  }

  static fileNotFound(filePath: string, operation: string): InMemoriaError {
    return new InMemoriaError(
      ErrorCode.FILE_NOT_FOUND,
      `File not found: ${filePath}`,
      'The requested file could not be found.',
      ErrorSeverity.MEDIUM,
      { filePath, operation },
      [
        { description: 'Check if the file path is correct' },
        { description: 'Ensure the file exists and is accessible' }
      ]
    );
  }

  static languageUnsupported(language: string, filePath?: string): InMemoriaError {
    return new InMemoriaError(
      ErrorCode.LANGUAGE_UNSUPPORTED,
      `Unsupported language: ${language}`,
      'This programming language is not currently supported.',
      ErrorSeverity.MEDIUM,
      { language, filePath },
      [
        { description: 'Check supported languages in documentation' },
        { description: 'Request language support on GitHub' },
        { description: 'Use fallback analysis for basic extraction' }
      ]
    );
  }

  static parseFailed(filePath: string, language: string, originalError?: Error): InMemoriaError {
    return new InMemoriaError(
      ErrorCode.PARSE_FAILED,
      `Failed to parse ${language} file: ${filePath}`,
      'Could not parse the source code file.',
      ErrorSeverity.MEDIUM,
      { filePath, language, operation: 'parsing' },
      [
        { description: 'Check if the file contains valid syntax' },
        { description: 'Try with fallback parser' },
        { description: 'Ensure the file is properly encoded (UTF-8)' }
      ],
      originalError
    );
  }

  static databaseInitFailed(dbPath: string, originalError: Error): InMemoriaError {
    return new InMemoriaError(
      ErrorCode.DATABASE_INIT_FAILED,
      `Database initialization failed: ${originalError.message}`,
      'Could not initialize the database.',
      ErrorSeverity.HIGH,
      { operation: 'database-init', additionalInfo: { dbPath } },
      [
        { description: 'Check database file permissions' },
        { description: 'Ensure SQLite is available' },
        { description: 'Try removing corrupted database file' },
        { description: 'Run setup again', command: 'in-memoria setup --interactive' }
      ],
      originalError
    );
  }

  static invalidConfig(configPath: string, validationErrors: string[]): InMemoriaError {
    return new InMemoriaError(
      ErrorCode.INVALID_CONFIG,
      `Invalid configuration: ${validationErrors.join(', ')}`,
      'The configuration file contains invalid settings.',
      ErrorSeverity.HIGH,
      { 
        filePath: configPath, 
        operation: 'config-validation',
        additionalInfo: { validationErrors }
      },
      [
        { description: 'Fix configuration file manually' },
        { description: 'Run interactive setup', command: 'in-memoria setup --interactive' },
        { description: 'Reset to default configuration' }
      ]
    );
  }

  static circuitBreakerOpen(component: string, lastFailure?: Date): InMemoriaError {
    return new InMemoriaError(
      ErrorCode.CIRCUIT_BREAKER_OPEN,
      `Circuit breaker is open for ${component}`,
      'Service temporarily unavailable due to repeated failures.',
      ErrorSeverity.HIGH,
      { 
        component, 
        operation: 'circuit-breaker',
        additionalInfo: { lastFailure }
      },
      [
        { description: 'Wait for circuit breaker to reset' },
        { description: 'Check underlying service health' },
        { description: 'Use fallback functionality if available' }
      ]
    );
  }
}

/**
 * MCP-specific utility functions for error handling
 */
export class MCPErrorUtils {
  /**
   * Create a standard MCP error response from an MCPErrorCode
   */
  static createMCPError(
    code: MCPErrorCode,
    message: string,
    data?: MCPErrorResponse['data']
  ): MCPErrorResponse {
    return {
      code,
      message,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Create a JSON-RPC error response
   */
  static createJSONRPCError(
    code: MCPErrorCode,
    message: string,
    requestId: string | number | null,
    data?: MCPErrorResponse['data']
  ): JSONRPCError {
    return {
      jsonrpc: '2.0',
      error: this.createMCPError(code, message, data),
      id: requestId
    };
  }

  /**
   * Wrap tool execution errors for MCP compliance
   */
  static wrapToolError(
    toolName: string,
    error: unknown,
    requestId?: string | number
  ): JSONRPCError {
    const errorMessage = typeof error === 'string' ? error : 
                        error instanceof Error ? error.message :
                        'Unknown error occurred';
    
    return this.createJSONRPCError(
      MCPErrorCode.TOOL_EXECUTION_FAILED,
      `Tool '${toolName}' execution failed: ${errorMessage}`,
      requestId || null,
      {
        toolName,
        originalError: errorMessage,
        type: 'ToolExecutionError'
      }
    );
  }

  /**
   * Handle resource access errors
   */
  static resourceNotFound(
    resourceType: string,
    resourceId: string,
    requestId?: string | number
  ): JSONRPCError {
    return this.createJSONRPCError(
      MCPErrorCode.RESOURCE_NOT_FOUND,
      `${resourceType} not found: ${resourceId}`,
      requestId || null,
      {
        resourceType,
        resourceId,
        type: 'ResourceNotFound'
      }
    );
  }

  /**
   * Handle invalid parameter errors
   */
  static invalidParams(
    paramName: string,
    expected: string,
    received: unknown,
    requestId?: string | number
  ): JSONRPCError {
    return this.createJSONRPCError(
      MCPErrorCode.INVALID_PARAMS,
      `Invalid parameter '${paramName}': expected ${expected}, received ${typeof received}`,
      requestId || null,
      {
        paramName,
        expected,
        received: typeof received,
        type: 'InvalidParams'
      }
    );
  }
}

/**
 * Utility functions for error handling
 */
export class ErrorUtils {
  /**
   * Safely extract error message from unknown error
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: InMemoriaError): boolean {
    return error.recoveryActions.length > 0 && 
           error.severity !== ErrorSeverity.CRITICAL;
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: InMemoriaError): void {
    const logLevel = this.getSeverityLogLevel(error.severity);
    console[logLevel](error.getFormattedMessage());
    
    if (error.originalError && process.env.DEBUG) {
      console.debug('Original error:', error.originalError);
    }
  }

  private static getSeverityLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
      default:
        return 'info';
    }
  }

  /**
   * Convert standard Error to InMemoriaError
   */
  static fromError(error: Error, context: ErrorContext = {}): InMemoriaError {
    // Try to determine error type from message patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('unsupported language')) {
      const match = error.message.match(/unsupported language:\s*(\w+)/i);
      const language = match?.[1] || 'unknown';
      return ErrorFactory.languageUnsupported(language, context.filePath);
    }
    
    if (message.includes('file not found') || message.includes('enoent')) {
      return ErrorFactory.fileNotFound(context.filePath || 'unknown', context.operation || 'unknown');
    }
    
    if (message.includes('failed to parse')) {
      return ErrorFactory.parseFailed(
        context.filePath || 'unknown',
        context.language || 'unknown',
        error
      );
    }
    
    // Generic error conversion
    return new InMemoriaError(
      ErrorCode.SEMANTIC_ANALYSIS_FAILED,
      error.message,
      'An unexpected error occurred during analysis.',
      ErrorSeverity.MEDIUM,
      context,
      [
        { description: 'Check the error details above' },
        { description: 'Try running with debug mode', command: 'in-memoria debug --verbose' }
      ],
      error
    );
  }
}