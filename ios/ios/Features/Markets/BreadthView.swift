import SwiftUI

struct BreadthView: View {
    let stocks: [HeatmapStock]
    let period: MarketPeriod
    private var breadth: Breadth { Breadth(stocks: stocks) }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            SectionTitle(number: "03", title: "Under the surface")
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("\(breadth.advancing)").font(.title.weight(.semibold)).foregroundStyle(
                        MarketTheme.positive)
                    Text("Advancing").font(.caption).foregroundStyle(MarketTheme.secondaryText)
                }

                Spacer()
                VStack(alignment: .trailing, spacing: 5) {
                    Text("\(breadth.declining)").font(.title.weight(.semibold)).foregroundStyle(
                        MarketTheme.negative)
                    Text("Declining").font(.caption).foregroundStyle(MarketTheme.secondaryText)
                }
            }

            .monospacedDigit()
            GeometryReader { geo in
                HStack(spacing: 3) {
                    Capsule().fill(MarketTheme.positive).frame(
                        width: max(
                            0,
                            geo.size.width * Double(breadth.advancing)
                                / Double(max(breadth.covered.count, 1)) - 2))
                    Capsule().fill(MarketTheme.negative)
                }
            }

            .frame(height: 5).accessibilityHidden(true)
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Equal weight")
                    ChangeLabel(value: breadth.equalWeight).font(.headline)
                }

                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    Text("Cap weight")
                    ChangeLabel(value: breadth.capWeight).font(.headline)
                }
            }

            .font(.caption).foregroundStyle(MarketTheme.secondaryText)
            Divider().overlay(MarketTheme.border)
            ForEach(Array(Dictionary(grouping: stocks, by: \.sector).keys).sorted(), id: \.self) {

                sector in
                let sectorBreadth = Breadth(stocks: stocks.filter { $0.sector == sector })
                HStack {
                    Text(sector)
                    Spacer()
                    ChangeLabel(value: sectorBreadth.equalWeight)
                }

                .font(.caption)
            }

            Text(
                "\(period.rawValue) · \(breadth.covered.count) covered stocks · \(breadth.unchanged) unchanged. Calculated from this map universe, not an exchange-wide breadth measure."
            ).font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
        }

        .marketPanel()
    }
}
