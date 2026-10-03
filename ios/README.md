# Marketly for iOS

The SwiftUI app lives alongside the web frontend and FastAPI backend. It uses the
same FastAPI endpoints for live market data and research, and Supabase for Google
sign-in and cross-device watchlist and saved-research state. The app has no demo
data service or mode.

## Open and build

Open `ios.xcodeproj` in Xcode and run the `ios` scheme on an iOS 18 or newer
simulator. The app always uses the Marketly Render API URL from
`ios/App/AppConfig.swift`. Sign in with Google from **More → Settings** to use
authenticated endpoints and sync the workspace.

For native push setup, enable Push Notifications on the `Marketly.ios` App ID,
add the APNs key values to Render, then enable notifications in Settings and
send a test alert from Alerts. See [account and deployment setup](../docs/account-and-deployment.md).

In Supabase Auth, enable Google and add `marketly://auth/callback` to the allowed
redirect URLs. The native app uses the same Supabase project as the web app.

## Formatting

Use the checked-in Swift configuration and script:

```sh
./scripts/format.sh format
./scripts/format.sh check
```

The script uses Xcode's bundled `swift-format` and keeps the app's Swift code in
four-space indentation with a 100-character line length.
