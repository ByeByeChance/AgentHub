export interface HealthServerOptions {
  serviceName: string;
  port?: number;
  /** Register the global RFC 9457 error handler. Default: true */
  registerErrorHandler?: boolean;
}
