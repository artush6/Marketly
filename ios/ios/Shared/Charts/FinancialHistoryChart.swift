import Charts
import SwiftUI

struct FinancialHistoryChart: View {
    let points: [FinancialPoint]
    @State private var series = FinancialSeries.revenue

    private var plottedPoints: [(FinancialPoint, Double)] {
        points.compactMap { point in series.value(from: point).map { (point, $0) } }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Reported financials").font(.headline)
                Spacer()
                Menu {
                    Picker("Measure", selection: $series) {
                        ForEach(FinancialSeries.allCases) { Text($0.rawValue).tag($0) }
                    }
                } label: {
                    Label(series.rawValue, systemImage: "chevron.down").font(.caption)
                }
            }
            if plottedPoints.isEmpty {
                Text(
                    "The backend has no annual \(series.rawValue.lowercased()) series for this company."
                ).font(.caption).foregroundStyle(MarketTheme.secondaryText).frame(
                    maxWidth: .infinity, minHeight: 140, alignment: .center)
            } else {
                Chart(plottedPoints, id: \.0.id) { point, value in
                    BarMark(
                        x: .value("Fiscal year", point.date, unit: .year), y: .value("USD", value)
                    ).foregroundStyle(MarketTheme.accentMint.gradient).cornerRadius(4)
                    PointMark(
                        x: .value("Fiscal year", point.date, unit: .year), y: .value("USD", value)
                    ).foregroundStyle(MarketTheme.accentMint)
                }.chartYAxisLabel("USD, millions").chartYAxis { AxisMarks(position: .leading) }
                    .frame(height: 190).accessibilityLabel(
                        "Annual reported \(series.rawValue.lowercased())")
                ForEach(plottedPoints, id: \.0.id) { point, value in
                    HStack {
                        Text(point.period)
                        Spacer()
                        Text(MarketFormat.compact(value, currency: "USD")).monospacedDigit()
                            .foregroundStyle(MarketTheme.primaryText)
                    }.font(.caption).foregroundStyle(MarketTheme.secondaryText)
                }
            }
            Text(
                "Source: Marketly’s normalized annual financial statements. Restatements may change prior values."
            ).font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
        }
    }
}
