import SwiftUI

struct ModeLabel: View {
    var body: some View {
        Text("LIVE API").font(.system(size: 9, weight: .semibold, design: .monospaced)).tracking(1)
            .foregroundStyle(MarketTheme.secondaryText).padding(.horizontal, 7).padding(
                .vertical, 5
            ).background(MarketTheme.elevatedSurface, in: Capsule()).accessibilityLabel(
                "Live API data. Quotes may be delayed.")
    }
}
