import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.S3_ENDPOINT && {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  }),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
  },
});

const BUCKET = process.env.S3_BUCKET || 'blobe-media';

export const getUploadUrl = (postId: string): Promise<string> =>
  getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: `posts/${postId}/media`,
    }),
    { expiresIn: 3600 }
  );
