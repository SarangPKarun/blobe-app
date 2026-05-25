export interface KafkaEvent<T = any> {
  topic: string;
  timestamp: string;
  traceId: string;
  payload: T;
}
