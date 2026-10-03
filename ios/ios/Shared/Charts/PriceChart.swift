import Charts
import SwiftUI

struct PriceChart: View {
    let points: [PricePoint]
    var positive = true
    var compact = false
    @State private var selectedDate: Date?
    private var color: Color { positive ? MarketTheme.positive : MarketTheme.negative }

    private var domain: ClosedRange<Double> {
        let values = points.map(\.close)
        let low = values.min() ?? 0
        let high = values.max() ?? 1
        let padding = max((high - low) * 0.15, max(abs(high) * 0.001, 0.01))
        return (low - padding)...(high + padding)
    }

    private var selected: PricePoint? {
        guard let selectedDate else { return nil }

        return points.min {
            abs($0.date.timeIntervalSince(selectedDate))
                < abs($1.date.timeIntervalSince(selectedDate))
        }
    }

    var body: some View {
        if points.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "chart.xyaxis.line").font(compact ? .body : .title)
                Text(compact ? "History unavailable" : "Price history is not available yet").font(
                    .caption)
            }

            .foregroundStyle(MarketTheme.tertiaryText).frame(
                maxWidth: .infinity, minHeight: compact ? 44 : 160)
        } else {
            Chart {
                ForEach(points) { point in
                    AreaMark(
                        x: .value("Time", point.date), yStart: .value("Base", domain.lowerBound),
                        yEnd: .value("Price", point.close)
                    ).foregroundStyle(
                        LinearGradient(
                            colors: [color.opacity(0.16), color.opacity(0)], startPoint: .top,
                            endPoint: .bottom))
                    LineMark(x: .value("Time", point.date), y: .value("Price", point.close))
                        .foregroundStyle(color).lineStyle(
                            StrokeStyle(lineWidth: compact ? 1.4 : 1.8))
                }

                if let selected, !compact {
                    RuleMark(x: .value("Selected", selected.date)).foregroundStyle(
                        MarketTheme.secondaryText.opacity(0.6)
                    ).annotation(position: .top, alignment: .leading) {
                        Text(MarketFormat.price(selected.close)).font(.caption.monospacedDigit())
                            .padding(6).background(MarketTheme.elevatedSurface, in: Capsule())
                    }

                    PointMark(x: .value("Time", selected.date), y: .value("Price", selected.close))
                        .foregroundStyle(color)
                }
            }

            .chartYScale(domain: domain).chartXAxis(compact ? .hidden : .automatic).chartYAxis(
                compact ? .hidden : .automatic
            ).chartXSelection(value: $selectedDate).frame(height: compact ? 48 : 195)
            .accessibilityLabel(
                compact ? "Price sparkline" : "Price history. Drag to inspect a price.")
        }
    }
}
