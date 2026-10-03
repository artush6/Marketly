import SwiftUI

struct AssistantPill: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Label("Ask AI", systemImage: "sparkles").font(.subheadline.weight(.semibold)).padding(
                .horizontal, 18
            ).frame(minHeight: 46).foregroundStyle(MarketTheme.primaryText).background(
                MarketTheme.elevatedSurface, in: Capsule()
            ).overlay(Capsule().strokeBorder(MarketTheme.accentMint.opacity(0.85), lineWidth: 1))
        }

        .buttonStyle(.plain).accessibilityIdentifier("ask-ai").shadow(
            color: .black.opacity(0.3), radius: 8, y: 3)
    }
}
