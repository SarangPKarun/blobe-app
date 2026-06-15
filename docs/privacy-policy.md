# Blobe Privacy Policy

**Effective date:** 2026-06-15

## 1. Introduction

Blobe ("we", "us", or "our") operates the Blobe mobile application. This policy explains what personal data we collect, why we collect it, and the rights you have over your data under the GDPR (EU 2016/679) and similar regulations.

## 2. Data We Collect

| Data type | Purpose | Linked to identity |
|---|---|---|
| **Location** (approximate) | Placing posts on the globe, showing nearby content | Yes |
| **Email address** | Account registration and authentication via Firebase | Yes |
| **Phone number** (optional) | Alternative authentication method | Yes |
| **User ID** | Session management, attributing posts and votes | Yes |
| **Payment information** | Processing creator payments and campaign funding via Stripe Connect | Yes |
| **Messages** | End-to-end encrypted chat between users | Yes |
| **Post content** | User-generated text and media published to the globe | Yes |
| **Trust votes** | Community moderation of post quality | Yes |
| **Device token** | Push notifications (Firebase Cloud Messaging) | Yes |

We do **not** use data for cross-app tracking or advertising.

## 3. Third-Party Processors

| Processor | Role | Privacy policy |
|---|---|---|
| **Firebase (Google)** | Authentication, push notifications | https://firebase.google.com/support/privacy |
| **AWS** | Infrastructure hosting (EKS, S3, RDS, Secrets Manager) | https://aws.amazon.com/privacy/ |
| **Stripe** | Payment processing and Stripe Connect for creator payouts | https://stripe.com/privacy |
| **Sentry** | Crash reporting and performance monitoring (anonymised stack traces) | https://sentry.io/privacy/ |
| **Elasticsearch** | Post search index | Data processed within our own AWS infrastructure |

## 4. Data Retention

- **Posts and votes** are retained until you delete them individually or delete your account.
- **Payment records** are retained for 7 years for financial audit compliance; sender and recipient identities are anonymised upon account deletion.
- **Chat messages** you send are soft-deleted (content replaced) when you delete your account; the conversation thread remains visible to other participants.
- **Audit log** of account deletion is retained for 3 years with no personal identifiers beyond your user ID.
- **Crash reports** in Sentry are automatically deleted after 90 days.

## 5. Your Rights (GDPR Article 15–22)

You have the right to:

- **Access** — request a copy of your personal data.
- **Rectification** — correct inaccurate data in your profile settings.
- **Erasure (right to be forgotten)** — delete your account from the Profile → Settings → Delete Account screen. This triggers immediate deletion of your posts, votes, campaigns, follow graph, trust score, device tokens, and push notification preferences. Payment records are anonymised, not deleted.
- **Portability** — contact us to request a JSON export of your data.
- **Restriction and objection** — contact us to restrict processing in specific circumstances.
- **Withdraw consent** — you may revoke location permission at any time in your device settings; this disables post placement but does not delete existing posts.

To exercise any right, contact **privacy@blobe.app**. We respond within 30 days.

## 6. Security

All data in transit is protected by TLS 1.3. Service-to-service communication inside our Kubernetes cluster uses Istio mutual TLS. Payments are processed by Stripe and we never store raw card numbers. Chat messages are end-to-end encrypted using libsodium.

## 7. Children

Blobe is rated 4+ / Everyone and does not knowingly collect data from children under 13. If you believe a child has created an account, contact privacy@blobe.app and we will delete it promptly.

## 8. Changes to This Policy

We will notify you of material changes via in-app notification and update the effective date above. Continued use of the app after the change constitutes acceptance.

## 9. Contact

**Blobe Inc.**
privacy@blobe.app
