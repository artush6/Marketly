import SwiftUI

struct QuoteRow: View {
    let quote: Quote
    var body: some View {
        HStack(spacing: 12) {
            LogoView(symbol: quote.symbol, url: quote.logoURL, size: 38)
            VStack(alignment: .leading, spacing: 4) {
                Text(quote.symbol).font(.subheadline.weight(.semibold))
                Text(quote.name).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Text(MarketFormat.price(quote.price, currency: quote.currency)).font(
                    .subheadline.weight(.medium)
                ).monospacedDigit()
                HStack(spacing: 8) {
                    if let cap = quote.marketCap, cap > 0 {
                        Text(MarketFormat.compact(cap)).foregroundStyle(MarketTheme.tertiaryText)
                    }

                    ChangeLabel(value: quote.changePercent)
                }

                .font(.caption)
            }
        }

        .padding(.vertical, 6).contentShape(Rectangle())
    }
}
