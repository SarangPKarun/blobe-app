# App Logo Assets

## Android Icon Sizes
Place your app icons in the respective Android mipmap folders:

- **mipmap-mdpi**: 48x48 px (ic_launcher.png)
- **mipmap-hdpi**: 72x72 px (ic_launcher.png)
- **mipmap-xhdpi**: 96x96 px (ic_launcher.png)
- **mipmap-xxhdpi**: 144x144 px (ic_launcher.png)
- **mipmap-xxxhdpi**: 192x192 px (ic_launcher.png)

Files to replace:
- `android/app/src/main/res/mipmap-*/ic_launcher.png`
- `android/app/src/main/res/mipmap-*/ic_launcher_round.png` (optional round variants)

## iOS Icon Sizes
Place your app icons in: `ios/blobeReactnative/Images.xcassets/AppIcon.appiconset/`

Required sizes (all in PNG format):
- 20x20 (@2x, @3x)
- 29x29 (@2x, @3x)
- 40x40 (@2x, @3x)
- 60x60 (@2x, @3x)
- 1024x1024 (App Store)

## Quick Setup
1. Create your logo in 1024x1024 px
2. Use an icon generator tool or manually resize for each platform
3. Replace the existing icon files in the folders mentioned above

After replacing icons, rebuild the app:
```bash
# Android
npm run android

# iOS
cd ios && pod install && cd ..
npm run ios
```
