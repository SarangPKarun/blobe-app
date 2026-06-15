# Store Assets

Place the following files here before submission:

| File | Size | Notes |
|---|---|---|
| `app-icon-1024.png` | 1024×1024 px | RGB, no alpha channel (Apple requirement) |
| `feature-graphic-1024x500.png` | 1024×500 px | Google Play feature graphic |
| `screenshots/ios/01-globe-view.png` … | 1290×2796 px (6.5") | Capture on iPhone 14 Pro Max |
| `screenshots/ios/55-01-globe-view.png` … | 1242×2208 px (5.5") | Capture on iPhone 8 Plus |
| `screenshots/android/01-globe-view.png` … | 1080×1920 px | Capture on physical Android device |

See `metadata.json` for full screenshot list and submission notes.

## Before submitting

1. Store `SENTRY_DSN` as an EAS Secret: `eas secret:create --scope project --name SENTRY_DSN --value <dsn>`
2. Fill in `ascAppId` in `eas.json` (App Store Connect app ID)
3. Set age rating to **4+** / **Everyone** in App Store Connect and Play Console manually
4. Host `docs/privacy-policy.md` at `https://blobe.app/privacy`
5. Build: `eas build --platform all --profile production`
6. Submit: `eas submit --platform all --profile production`
