import SwiftUI

struct HeatmapSection: View {
    @Environment(AppModel.self) private var app
    @State private var state = LoadState<[HeatmapStock]>()
    @State private var period = MarketPeriod.day
    @State private var sector = "All sectors"
    @State private var expanded = false
    @State private var selected: SearchResult?
    var fullscreen = false
    private var filtered: [HeatmapStock] {
        (state.value ?? []).filter { sector == "All sectors" || $0.sector == sector }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    SectionTitle(number: "02", title: "Market map")
                    Spacer()
                    if !fullscreen {
                        Button {
                            expanded = true
                        } label: {
                            Image(systemName: "arrow.up.left.and.arrow.down.right").frame(
                                width: 32, height: 32)
                        }

                        .accessibilityLabel("Expand market map")
                    }
                }

                HStack {
                    Menu {
                        Picker("Sector", selection: $sector) {
                            Text("All sectors").tag("All sectors")
                            ForEach(
                                Array(Set((state.value ?? []).map(\.sector))).sorted(), id: \.self
                            ) { Text($0).tag($0) }
                        }
                    } label: {
                        Label(sector, systemImage: "line.3.horizontal.decrease").font(.caption)
                            .lineLimit(1).frame(minHeight: 44)
                    }

                    Spacer()
                    Menu {
                        Picker("Timeframe", selection: $period) {
                            ForEach(MarketPeriod.allCases) { item in
                                Text(item.rawValue).tag(item).disabled(
                                    app.mode == .live && item != .day)
                            }
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Text(period.rawValue)
                            Image(systemName: "chevron.down").font(.system(size: 8))
                        }

                        .font(.caption.weight(.semibold)).foregroundStyle(MarketTheme.accentMint)
                        .padding(.horizontal, 12).frame(minHeight: 36).background(
                            MarketTheme.elevatedSurface, in: Capsule())
                    }

                    .accessibilityLabel("Map timeframe, \(period.rawValue)")
                }

                .foregroundStyle(MarketTheme.secondaryText)
                if let error = state.error {
                    FailureState(message: error) { Task { await refresh() } }
                } else if state.value == nil {
                    RoundedRectangle(cornerRadius: 6).fill(MarketTheme.elevatedSurface).frame(
                        height: 230
                    ).overlay { ProgressView() }
                } else if filtered.isEmpty {
                    Text("No market-map data is available.").font(.subheadline).foregroundStyle(
                        MarketTheme.secondaryText)
                } else {
                    MarketHeatmapView(stocks: filtered) { stock in
                        selected = SearchResult(symbol: stock.symbol, name: stock.name)
                    }

                    .frame(height: fullscreen ? 430 : 260).opacity(state.isLoading ? 0.4 : 1)
                    HStack(spacing: 7) {
                        Text("−3%").foregroundStyle(MarketTheme.negative)
                        LinearGradient(
                            colors: [
                                MarketTheme.negative.opacity(0.6), MarketTheme.elevatedSurface,
                                MarketTheme.positive.opacity(0.6),
                            ], startPoint: .leading, endPoint: .trailing
                        ).frame(width: 66, height: 5).clipShape(Capsule())
                        Text("+3%").foregroundStyle(MarketTheme.positive)
                        Spacer()
                        Text("Size = market cap")
                    }

                    .font(.system(size: 9)).foregroundStyle(MarketTheme.tertiaryText)
                    Text(
                        app.mode == .demo
                            ? "Sample universe · \(period.rawValue) change"
                            : "Finviz universe · Delayed · Daily change"
                    ).font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
                }
            }

            .marketPanel()
            if let stocks = state.value, !stocks.isEmpty, !state.isLoading, state.error == nil {
                BreadthView(stocks: filtered, period: period)
            }
        }

        .task(id: period) { await refresh() }

        .navigationDestination(item: $selected) { CompanyDetailView(symbol: $0.symbol) }

        .sheet(isPresented: $expanded) {
            NavigationStack {
                ScrollView { HeatmapSection(fullscreen: true).padding(20) }.marketScreen()
                    .navigationTitle("Market map").navigationBarTitleDisplayMode(.inline).toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { expanded = false }
                        }
                    }
            }

            .preferredColorScheme(.dark).tint(MarketTheme.accentMint)
        }
    }

    private func refresh() async {
        await state.load { try await app.services.market.heatmap(period: period) }
    }
}
