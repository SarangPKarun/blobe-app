import { Kafka } from 'kafkajs';
import type { PaymentCreatedPayload } from '@blobe/shared-types';

const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();

export const connectKafka = async () => {
  if (process.env.NODE_ENV !== 'test') {
    await producer.connect();
    console.log('Kafka Producer connected');
  }
};

export const disconnectKafka = async () => {
  if (process.env.NODE_ENV !== 'test') {
    await producer.disconnect();
  }
};

export const publishPaymentCreated = async (payload: PaymentCreatedPayload) => {
  if (process.env.NODE_ENV === 'test') return;
  await producer.send({
    topic: 'payments',
    messages: [{ key: payload.id, value: JSON.stringify(payload) }],
  });
};
