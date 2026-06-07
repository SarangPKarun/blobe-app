import { Kafka } from 'kafkajs';
import type { ChatMessagePayload } from '@blobe/shared-types';

const kafka = new Kafka({
  clientId: 'chat-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();

export const connectKafkaProducer = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'test') return;
  await producer.connect();
  console.log('[kafka] Producer connected');
};

export const disconnectKafka = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'test') return;
  await producer.disconnect();
};

export const publishChatMessage = async (payload: ChatMessagePayload): Promise<void> => {
  if (process.env.NODE_ENV === 'test') return;
  await producer.send({
    topic: 'chat.message',
    messages: [{ key: payload.messageId, value: JSON.stringify(payload) }],
  });
};
