import admin from 'firebase-admin';
import { prisma } from './db';

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const deviceTokens = await prisma.deviceToken.findMany({
    where: { userId, active: true },
    select: { token: true },
  });

  if (deviceTokens.length === 0) return;

  const tokens = deviceTokens.map((dt) => dt.token);

  let response: admin.messaging.BatchResponse;
  try {
    response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch (err) {
    console.error('[push] sendEachForMulticast failed:', err);
    return;
  }

  // Deactivate stale tokens
  const staleTokens: string[] = [];
  response.responses.forEach((res, idx) => {
    if (
      !res.success &&
      (res.error?.code === 'messaging/registration-token-not-registered' ||
        res.error?.code === 'messaging/invalid-registration-token')
    ) {
      staleTokens.push(tokens[idx]);
    }
  });

  if (staleTokens.length > 0) {
    await prisma.deviceToken.updateMany({
      where: { token: { in: staleTokens } },
      data: { active: false },
    });
  }
}
