import sgMail from '@sendgrid/mail';
import { prisma } from './db';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@blobe.app';

const SUBJECTS: Record<string, string> = {
  post_created: 'New post in your feed',
  trust_vote: 'Your post received a vote',
  payment_received: 'You received a payment',
};

export async function sendEmailDigest(
  userId: string,
  type: string,
  content: string
): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) return;

  try {
    await sgMail.send({
      to: user.email,
      from: FROM_EMAIL,
      subject: SUBJECTS[type] ?? 'Blobe notification',
      html: `<p>${content}</p><p style="color:#888;font-size:12px">You can manage your notification preferences in the Blobe app.</p>`,
    });
  } catch (err) {
    console.error('[email] SendGrid send failed:', err);
  }
}
