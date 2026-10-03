import SwiftUI

struct LoadingRows: View {
    var body: some View {
        VStack(spacing: 16) {
            ForEach(0..<4) { _ in
                HStack {
                    RoundedRectangle(cornerRadius: 8).frame(width: 42, height: 42)
                    VStack(alignment: .leading) {
                        Text("Company name and ticker")
                        Text("Market details").font(.caption)
                    }

                    Spacer()
                }
            }
        }

        .foregroundStyle(MarketTheme.secondaryText).redacted(reason: .placeholder).padding(20)
        .accessibilityLabel("Loading market data").accessibilityElement(children: .ignore)
    }
}
