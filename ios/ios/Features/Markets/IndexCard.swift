import SwiftUI

struct IndexCard: View {
    let quote: Quote
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                HStack(spacing: 8) {
                    LogoView(symbol: quote.symbol, url: quote.logoURL, size: 26)
                    Text(quote.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 8)).foregroundStyle(
                    MarketTheme.tertiaryText)
            }

            Text("\(quote.symbol) · ETF").font(.system(size: 10)).foregroundStyle(
                MarketTheme.secondaryText)
            Text(MarketFormat.price(quote.price)).font(.system(.title2, weight: .semibold))
                .tracking(-0.6).monospacedDigit().contentTransition(.numericText())
                .minimumScaleFactor(0.75).lineLimit(1)
            ChangeLabel(value: quote.changePercent).font(.caption.weight(.medium))
            PriceChart(
                points: quote.history, positive: (quote.changePercent ?? 0) >= 0, compact: true)
            Text("ETF proxy · USD").font(.system(size: 9)).foregroundStyle(MarketTheme.tertiaryText)
        }

        .marketPanel()
    }
}
