import SwiftUI

struct MarketsView: View {
    @Environment(AppModel.self) private var app
    @State private var state = LoadState<MarketSnapshot>()
    @State private var searchPresented = false
    @Environment(\.dynamicTypeSize) private var typeSize
    private let benchmarkSymbols = ["SPY", "QQQ", "DIA", "IWM"]
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let snapshot = state.value { ticker(snapshot.quotes) }

                header.padding(.horizontal, 20)
                VStack(alignment: .leading, spacing: 24) {
                    intro
                    if let error = state.error {
                        FailureState(message: error) { Task { await refresh() } }
                    }

                    if let snapshot = state.value {
                        indexCards(snapshot)
                        briefing(snapshot.articles)
                        HeatmapSection()
                        watchlistPreview(snapshot)
                        Text(snapshot.note).font(.caption2).foregroundStyle(
                            MarketTheme.tertiaryText)
                    } else if state.isLoading {
                        indexCards(
                            MarketSnapshot(
                                quotes: DemoData.indices, articles: [], fetchedAt: nil, note: "")
                        ).redacted(reason: .placeholder).allowsHitTesting(false)
                            .accessibilityHidden(true)
                        LoadingRows()
                    }
                }

                .padding(.horizontal, 20)
            }

            .padding(.top, 8).padding(.bottom, 20).frame(maxWidth: 900).frame(maxWidth: .infinity)
        }

        .marketScreen().toolbar(.hidden, for: .navigationBar).safeAreaInset(
            edge: .bottom, alignment: .trailing, spacing: 0
        ) { AssistantPill { app.ask() }.padding(.trailing, 20).padding(.vertical, 8) }

        .refreshable { await refresh() }.sheet(isPresented: $searchPresented) {
            NavigationStack { SearchView() }.environment(app).preferredColorScheme(.dark).tint(
                MarketTheme.accentMint)
        }

        .task { if state.value == nil { await refresh() } }
    }

    private var header: some View {
        VStack(spacing: 18) {
            HStack {
                Wordmark()
                ModeLabel()
                Spacer(minLength: 4)
                NavigationLink {
                    AlertsView()
                } label: {
                    Image(systemName: "bell").font(.title3).frame(width: 44, height: 44)
                }

                .accessibilityLabel("Alerts")
                Button {
                    app.settingsPresented = true
                } label: {
                    Image(systemName: "person.crop.circle").font(.title2).frame(
                        width: 44, height: 44)
                }

                .accessibilityLabel("Settings")
            }

            .foregroundStyle(MarketTheme.secondaryText)
            Button {
                searchPresented = true
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                    Text("Search companies or tickers").font(.subheadline)
                    Spacer()
                }

                .foregroundStyle(MarketTheme.secondaryText).padding(14).background(
                    MarketTheme.surface, in: RoundedRectangle(cornerRadius: 10)
                ).overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(MarketTheme.border))
            }

            .buttonStyle(.plain).accessibilityIdentifier("market-search")
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Eyebrow(text: "Marketly / Overview")
                Spacer()
                if let date = state.value?.fetchedAt {
                    Text(
                        app.mode == .demo
                            ? "Sample snapshot" : date.formatted(date: .omitted, time: .shortened)
                    ).font(.system(size: 10, design: .monospaced)).foregroundStyle(
                        MarketTheme.tertiaryText)
                }

                Button {
                    Task { await refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 32, height: 32)
                }

                .disabled(state.isLoading).accessibilityLabel("Refresh markets")
            }

            .foregroundStyle(MarketTheme.secondaryText)
            Text("The market, in focus.").font(.system(.largeTitle, weight: .semibold)).tracking(
                -1.4
            ).accessibilityAddTraits(.isHeader)
            Text("Key stories, market moves, and the bigger picture.").font(.subheadline)
                .foregroundStyle(MarketTheme.secondaryText)
        }
    }

    private func ticker(_ quotes: [Quote]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 18) {
                ForEach(quotes.filter { LiveServices.benchmarks[$0.symbol] != nil }) { quote in
                    HStack(spacing: 7) {
                        Text(quote.name).foregroundStyle(MarketTheme.secondaryText)
                        Text(quote.price?.formatted(.number.precision(.fractionLength(2))) ?? "—")
                            .monospacedDigit()
                        ChangeLabel(value: quote.changePercent)
                    }

                    .font(.system(size: 10, weight: .medium)).padding(.vertical, 12)
                    Rectangle().fill(MarketTheme.border).frame(width: 1, height: 12)
                }
            }

            .padding(.horizontal, 20)
        }

        .overlay(alignment: .bottom) { Rectangle().fill(MarketTheme.border).frame(height: 0.5) }
    }

    private func indexCards(_ snapshot: MarketSnapshot) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(
                    benchmarkSymbols.compactMap { symbol in
                        snapshot.quotes.first { $0.symbol == symbol }
                    }
                ) { quote in
                    NavigationLink(
                        value: SearchResult(symbol: quote.symbol, name: quote.name, type: "ETF")
                    ) {
                        IndexCard(quote: quote).containerRelativeFrame(.horizontal) { width, _ in
                            min(width * 0.82, 330)
                        }
                    }.buttonStyle(.plain)
                }
            }
        }.contentMargins(.trailing, 8)
    }
    private func briefing(_ articles: [Article]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionTitle(number: "01", title: "Market briefing")
                Spacer()
                Button {
                    app.selectedTab = 2
                } label: {
                    Image(systemName: "arrow.up.right").frame(width: 32, height: 32)
                }

                .accessibilityLabel("View all news")
            }

            if articles.isEmpty {
                Text("No briefing is available right now.").font(.caption).foregroundStyle(
                    MarketTheme.secondaryText
                ).padding(.vertical, 12)
            }

            ForEach(Array(articles.prefix(3))) { article in
                Divider().overlay(MarketTheme.border)
                NavigationLink(value: article) { StoryRow(article: article) }.buttonStyle(.plain)
            }
        }

        .marketPanel()
    }

    private func watchlistPreview(_ snapshot: MarketSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionTitle(number: "04", title: "Your watchlist")
                Spacer()
                Button("View all") { app.selectedTab = 3 }.font(.caption)
            }

            let quotes = snapshot.quotes.filter { app.watchlist.contains($0.symbol) }

            if quotes.isEmpty {
                Text("Save a company to follow its next move.").font(.subheadline).foregroundStyle(
                    MarketTheme.secondaryText)
            }

            ForEach(Array(quotes.prefix(4))) { quote in
                HStack {
                    NavigationLink(value: SearchResult(symbol: quote.symbol, name: quote.name)) {
                        QuoteRow(quote: quote)
                    }

                    .buttonStyle(.plain)
                    Button {
                        app.toggleWatchlist(quote.symbol)
                    } label: {
                        Image(systemName: "star.fill").foregroundStyle(MarketTheme.accentMint)
                            .frame(width: 44, height: 44)
                    }

                    .accessibilityLabel("Remove \(quote.symbol) from watchlist")
                }

                Divider().overlay(MarketTheme.border)
            }
        }
    }

    private func refresh() async {
        await state.load {
            try await app.services.market.overview(symbols: Array(app.watchlist.prefix(9)))
        }
    }
}
