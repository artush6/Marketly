import SwiftUI

struct SearchView: View {
    @Environment(AppModel.self) private var app
    @State private var query = ""
    @State private var state = LoadState<[SearchResult]>()
    @State private var retryID = 0
    private var normalizedQuery: String {
        String(query.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Eyebrow(text: "Your next research starts here")
                    Spacer()
                    ModeLabel()
                }

                if normalizedQuery.isEmpty {
                    if !app.recentSearches.isEmpty {
                        HStack {
                            Text("Recent searches").font(.headline)
                            Spacer()
                            Button("Clear") { app.clearRecents() }.font(.caption)
                        }

                        results(app.recentSearches)
                    }

                    Text("Start with a company").font(.headline)
                    Text(
                        "Search a ticker, a business, or an ETF. Build a watchlist around what matters to you."
                    ).font(.subheadline).foregroundStyle(MarketTheme.secondaryText)
                    results([
                        SearchResult(symbol: "AAPL", name: "Apple"),
                        SearchResult(symbol: "MSFT", name: "Microsoft"),
                        SearchResult(symbol: "NVDA", name: "NVIDIA"),
                    ])
                } else if state.isLoading {
                    LoadingRows()
                } else if let error = state.error {
                    FailureState(message: error) { retryID += 1 }
                } else if let items = state.value {
                    if items.isEmpty {
                        EmptyState(
                            title: "No companies found",
                            message: "Try a different company name or ticker.",
                            symbol: "magnifyingglass")
                    } else {
                        Eyebrow(text: "Companies & securities")
                        results(items)
                    }
                }
            }

            .padding(20).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }

        .marketScreen().navigationTitle("Search").searchable(
            text: $query, prompt: "Company or ticker"
        ).autocorrectionDisabled().textInputAutocapitalization(.characters).task(
            id: "\(normalizedQuery)-\(retryID)"
        ) {
            let term = normalizedQuery
            guard !term.isEmpty else { return }

            await state.load {
                try await Task.sleep(for: .milliseconds(300))
                return try await app.services.company.search(query: term)
            }
        }
    }

    private func results(_ items: [SearchResult]) -> some View {
        VStack(spacing: 0) {
            ForEach(items) { item in
                NavigationLink(value: item) {
                    HStack(spacing: 14) {
                        Text(String(item.symbol.prefix(1))).font(.headline).foregroundStyle(
                            MarketTheme.accentMint
                        ).frame(width: 42, height: 42).background(
                            MarketTheme.elevatedSurface, in: RoundedRectangle(cornerRadius: 10))
                        VStack(alignment: .leading, spacing: 5) {
                            Text(item.symbol).font(.headline)
                            Text(item.name).font(.subheadline).foregroundStyle(
                                MarketTheme.secondaryText)
                        }

                        Spacer()
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(
                            MarketTheme.tertiaryText)
                    }

                    .padding(.vertical, 12).contentShape(Rectangle())
                }

                .buttonStyle(.plain).accessibilityIdentifier("search-result-\(item.symbol)")
                Divider().overlay(MarketTheme.border)
            }
        }
    }
}
