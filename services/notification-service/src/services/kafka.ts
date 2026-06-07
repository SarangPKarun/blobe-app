import { Kafka } from 'kafkajs';
import { handlePostCreated, handleTrustVote, handlePayment, handleChatMessage } from './notificationDispatcher';

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'notification-service-group' });

export const connectKafkaConsumer = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'test') return;

  await consumer.connect();
  await consumer.subscribe({
    topics: ['posts', 'trust-votes', 'payments', 'chat.message'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      let event: any;
      try {
        event = JSON.parse(message.value.toString());
      } catch {
        console.error(`[kafka] failed to parse message on topic ${topic}`);
        return;
      }

      // post-service publishes raw objects (no KafkaEvent wrapper); handle both formats
      const payload = event.payload ?? event;

      try {
        if (topic === 'posts')        await handlePostCreated(payload);
        if (topic === 'trust-votes')  await handleTrustVote(payload);
        if (topic === 'payments')     await handlePayment(payload);
        if (topic === 'chat.message') await handleChatMessage(payload);
      } catch (err) {
        console.error(`[kafka] handler failed for topic ${topic}:`, err);
        // Do not rethrow — keeps consumer offset advancing; failed events are logged not retried
      }
    },
  });

  console.log('Kafka Consumer connected');
};

export const disconnectKafka = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'test') return;
  await consumer.disconnect();
};
