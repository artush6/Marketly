import SwiftUI

struct WatchlistView: View {
    @Environment(AppModel.self) private var app
    @State private var state = LoadState<[Quote]>()
    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Eyebrow(text: "Your research universe")
                        Spacer()
                        ModeLabel()
                    }

                    Text("Keep a closer watch.").font(.title.weight(.semibold)).tracking(-0.8)
                    Text("Saved on this device. Swipe a company to remove it.").font(.caption)
                        .foregroundStyle(MarketTheme.secondaryText)
                }

                .padding(.vertical, 10)
            }

            .listRowBackground(MarketTheme.background).listRowSeparator(.hidden)
            if let error = state.error {
                FailureState(message: error) { Task { await refresh() } }

                    .listRowBackground(MarketTheme.background).listRowSeparator(.hidden)
            }

            if app.watchlist.isEmpty {
                EmptyState(
                    title: "Your watchlist starts here",
                    message: "Find a company and tap the star to keep it close.", symbol: "star"
                ).listRowBackground(MarketTheme.background).listRowSeparator(.hidden)
                Button("Find a company") { app.selectedTab = 1 }

                    .listRowBackground(MarketTheme.surface)
            } else if let quotes = state.value {
                ForEach(quotes.filter { app.watchlist.contains($0.symbol) }) { quote in
                    NavigationLink(value: SearchResult(symbol: quote.symbol, name: quote.name)) {
                        QuoteRow(quote: quote)
                    }

                    .listRowBackground(MarketTheme.background).listRowSeparatorTint(
                        MarketTheme.border
                    ).swipeActions {
                        Button("Remove", systemImage: "star.slash", role: .destructive) {
                            app.toggleWatchlist(quote.symbol)
                        }
                    }
                }
            } else if state.isLoading {
                LoadingRows().listRowBackground(MarketTheme.background)
            }
        }

        .listStyle(.plain).scrollContentBackground(.hidden).marketScreen().navigationTitle(
            "Watchlist"
        ).toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    app.selectedTab = 1
                } label: {
                    Image(systemName: "plus").frame(width: 44, height: 44)
                }

                .accessibilityLabel("Add a company")
            }
        }

        .task(id: app.watchlist) { await refresh() }.refreshable { await refresh() }
    }

    private func refresh() async {
        await state.load {
            guard !app.watchlist.isEmpty else { return [] }

            var results: [Quote] = []
            // Bounded batches respect /market/overview's 12-symbol contract.
            for offset in stride(from: 0, to: app.watchlist.count, by: 9) {
                let symbols = Array(app.watchlist.dropFirst(offset).prefix(9))
                let snapshot = try await app.services.market.overview(symbols: symbols)
                results += symbols.map { symbol in
                    snapshot.quotes.first { $0.symbol == symbol }

                        ?? Quote(
                            symbol: symbol, name: symbol, price: nil, changePercent: nil,
                            marketCap: nil, sector: "")
                }
            }

            return results
        }
    }
}
