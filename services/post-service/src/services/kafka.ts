import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'post-service',
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

export const publishPostCreated = async (post: {
  id: string;
  authorId: string;
  latitude: number;
  longitude: number;
  frontText?: string | null;
  backText?: string | null;
  mediaUrl?: string | null;
  createdAt: Date;
}) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  await producer.send({
    topic: 'posts',
    messages: [
      {
        key: post.id,
        value: JSON.stringify(post),
      },
    ],
  });
};
