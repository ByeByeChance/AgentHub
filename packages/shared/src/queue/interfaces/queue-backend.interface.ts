/** Handler for consumed messages. Call ack() to confirm or nack() to reject/requeue. */
export interface MessageHandler {
  (message: unknown, ack: () => Promise<void>, nack: (requeue?: boolean) => Promise<void>): Promise<void>;
}

/** Pluggable message queue backend (RabbitMQ, Redis, NATS, or in-memory mock). */
export interface QueueBackend {
  readonly name: string;

  /** Publish a message to an exchange with a routing key. */
  publish(exchange: string, routingKey: string, message: unknown): Promise<void>;

  /** Subscribe to an exchange with a queue, binding key, and message handler. */
  subscribe(
    exchange: string,
    queue: string,
    bindingKey: string,
    handler: MessageHandler,
  ): Promise<void>;

  /** Gracefully close the connection. */
  close(): Promise<void>;
}
