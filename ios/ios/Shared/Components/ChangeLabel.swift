import SwiftUI

struct ChangeLabel: View {
    let value: Double?
    var body: some View {
        Text(MarketFormat.change(value)).foregroundStyle(
            value.map { $0 < 0 ? MarketTheme.negative : MarketTheme.positive }

                ?? MarketTheme.secondaryText
        ).monospacedDigit().contentTransition(.numericText()).accessibilityLabel(
            value.map {
                "\($0 < 0 ? "Down" : "Up") \(abs($0).formatted(.number.precision(.fractionLength(2)))) percent"
            } ?? "Change unavailable")
    }
}
