// backend/src/adapters/interfaces/IAdapter.ts

/**
 * BASE ADAPTER INTERFACE
 *
 * All adapters must implement:
 * - Health check
 * - Configuration validation
 * - Dual mode support (dev/prod)
 */

export interface IAdapterConfig {
  mode: 'dev' | 'prod';
  timeout?: number;
  retryPolicy?: {
    maxAttempts: number;
    initialInterval: number;
    multiplier: number;
  };
}

export interface IAdapterHealthCheck {
  isHealthy: boolean;
  latencyMs?: number;
  lastCheckedAt: Date;
  errorMessage?: string;
}

export interface IAdapter {
  /**
   * Adapter name (for logging)
   */
  readonly name: string;

  /**
   * Current configuration
   */
  readonly config: IAdapterConfig;

  /**
   * Initialize adapter (connect, authenticate)
   */
  initialize(): Promise<void>;

  /**
   * Health check (ping external service)
   */
  healthCheck(): Promise<IAdapterHealthCheck>;

  /**
   * Graceful shutdown
   */
  shutdown(): Promise<void>;
}