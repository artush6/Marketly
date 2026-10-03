import SwiftUI

struct MarketHeatmapView: View {
    let stocks: [HeatmapStock]
    let select: (HeatmapStock) -> Void
    private var sectors: [String: [HeatmapStock]] { Dictionary(grouping: stocks, by: \.sector) }

    var body: some View {
        GeometryReader { geometry in
            let groups = sectors
            let sectorTiles = TreemapLayout.tiles(
                weights: groups.map { ($0.key, $0.value.reduce(0) { $0 + $1.marketCap }) },
                in: CGRect(origin: .zero, size: geometry.size))
            ZStack(alignment: .topLeading) {
                ForEach(sectorTiles) { sector in
                    let titleHeight: CGFloat = sector.rect.height > 65 ? 22 : 0
                    let members = groups[sector.id] ?? []
                    let memberMap = Dictionary(
                        members.map { ($0.symbol, $0) }, uniquingKeysWith: { first, _ in first })
                    let tiles = TreemapLayout.tiles(
                        weights: members.map { ($0.symbol, $0.marketCap) },
                        in: CGRect(
                            x: 0, y: titleHeight, width: max(0, sector.rect.width - 3),
                            height: max(0, sector.rect.height - titleHeight - 3)))
                    ZStack(alignment: .topLeading) {
                        if titleHeight > 0 {
                            Text(sector.id.uppercased()).font(.system(size: 8, weight: .medium))
                                .lineLimit(1).foregroundStyle(MarketTheme.secondaryText).padding(
                                    .horizontal, 4
                                ).frame(height: titleHeight)
                        }

                        ForEach(tiles) { tile in
                            if let stock = memberMap[tile.id] {
                                Button {
                                    select(stock)
                                } label: {
                                    VStack(alignment: .leading, spacing: 3) {
                                        if tile.rect.width > 38 && tile.rect.height > 27 {
                                            Text(stock.symbol).font(
                                                .system(
                                                    size: tile.rect.width > 85 ? 15 : 11,
                                                    weight: .semibold)
                                            ).lineLimit(1)
                                            if tile.rect.height > 48 {
                                                Text(MarketFormat.change(stock.changePercent)).font(
                                                    .system(size: 10)
                                                ).monospacedDigit().lineLimit(1)
                                            }
                                        }
                                    }

                                    .foregroundStyle(.white).padding(5).frame(
                                        width: max(0, tile.rect.width - 1),
                                        height: max(0, tile.rect.height - 1), alignment: .topLeading
                                    ).background(
                                        tileColor(stock.changePercent),
                                        in: RoundedRectangle(cornerRadius: 2))
                                }

                                .buttonStyle(.plain).offset(x: tile.rect.minX, y: tile.rect.minY)
                                .accessibilityLabel(
                                    "\(stock.name), \(stock.symbol), \(MarketFormat.change(stock.changePercent)), market cap \(MarketFormat.compact(stock.marketCap))"
                                ).accessibilityHint("Opens company research")
                            }
                        }
                    }

                    .frame(
                        width: sector.rect.width, height: sector.rect.height, alignment: .topLeading
                    ).offset(x: sector.rect.minX, y: sector.rect.minY)
                }
            }
        }
    }

    private func tileColor(_ change: Double?) -> Color {
        guard let change else { return MarketTheme.elevatedSurface }

        if change == 0 { return Color(white: 0.23) }

        let strength = min(abs(change) / 3, 1)
        return change > 0
            ? Color(red: 0.06, green: 0.28 + strength * 0.28, blue: 0.19 + strength * 0.09)
            : Color(red: 0.38 + strength * 0.22, green: 0.12, blue: 0.15)
    }
}
