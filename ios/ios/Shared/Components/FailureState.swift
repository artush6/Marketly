import SwiftUI

struct FailureState: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark").font(.title2).foregroundStyle(
                MarketTheme.accentMint)
            Text("Unable to load").font(.headline)
            Text(message).font(.subheadline).foregroundStyle(MarketTheme.secondaryText)
                .multilineTextAlignment(.center)
            Button("Try again", action: retry).buttonStyle(.bordered).tint(MarketTheme.accentMint)
        }

        .padding(24).frame(maxWidth: .infinity).marketPanel()
    }
}
