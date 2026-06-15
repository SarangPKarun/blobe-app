import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'user-service',
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

export const publishUserCreated = async (user: { id: string; email?: string; phone?: string; username?: string }) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  await producer.send({
    topic: 'user.created',
    messages: [{ key: user.id, value: JSON.stringify(user) }],
  });
};

export const publishUserDeleted = async (userId: string) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  await producer.send({
    topic: 'user.deleted',
    messages: [
      {
        key: userId,
        value: JSON.stringify({ id: userId, deletedAt: new Date().toISOString() }),
      },
    ],
  });
};
