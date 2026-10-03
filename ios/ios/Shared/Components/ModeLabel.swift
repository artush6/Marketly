import SwiftUI

struct ModeLabel: View {
    @Environment(AppModel.self) private var app
    var body: some View {
        Text(app.mode == .demo ? "DEMO" : "LIVE API").font(
            .system(size: 9, weight: .semibold, design: .monospaced)
        ).tracking(1).foregroundStyle(
            app.mode == .demo ? MarketTheme.accentMint : MarketTheme.secondaryText
        ).padding(.horizontal, 7).padding(.vertical, 5).background(
            MarketTheme.elevatedSurface, in: Capsule()
        ).accessibilityLabel(
            app.mode == .demo
                ? "Demo data. Not live market prices." : "Live API mode. Quotes may be delayed.")
    }
}
