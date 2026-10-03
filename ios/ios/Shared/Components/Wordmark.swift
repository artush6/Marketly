import SwiftUI

struct Wordmark: View {
    var body: some View {
        HStack(spacing: 8) {
            Image("MarketlyMark").resizable().scaledToFit().frame(width: 30, height: 30)
                .accessibilityHidden(true)

            (Text("marketly").foregroundStyle(MarketTheme.primaryText)
                + Text(".").foregroundStyle(MarketTheme.accentMint)).font(
                    .system(.title, weight: .bold)
                ).tracking(-1.2)
        }.accessibilityElement(children: .ignore).accessibilityLabel("Marketly")
    }
}
