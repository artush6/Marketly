import SwiftUI

enum NewsFeed: String, CaseIterable, Identifiable {
    case crucial = "Crucial"
    case all = "All stories"
    case stocks = "By stock"
    var id: String { rawValue }
}

struct NewsView: View {
    @Environment(AppModel.self) private var app
    @State private var state = LoadState<[Article]>()
    @State private var feed = NewsFeed.all
    @State private var category = "All categories"
    @State private var ticker = ""

    private var categories: [String] {
        ["All categories"] + Array(Set((state.value ?? []).map(\.category))).sorted()
    }
    private var filtered: [Article] {
        (state.value ?? []).filter { article in
            (category == "All categories" || article.category == category)
                && (feed != .crucial || article.importanceLabel == "critical"
                    || article.importanceLabel == "important")
        }
    }
    private var requestKey: String {
        "\(feed.rawValue)-\(ticker)-\(app.watchlist.joined(separator: ","))"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Eyebrow(text: "Deeper research")
                    Spacer()
                    ModeLabel()
                }
                VStack(alignment: .leading, spacing: 10) {
                    Text("Beyond the ticker.").font(.largeTitle.weight(.semibold)).tracking(-1.2)
                    Text("The forces shaping businesses, industries, and your next decision.").font(
                        .subheadline
                    ).foregroundStyle(MarketTheme.secondaryText)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(NewsFeed.allCases) { item in
                            Button {
                                feed = item
                            } label: {
                                Text(item.rawValue).font(.caption.weight(.medium)).padding(
                                    .horizontal, 14
                                ).frame(minHeight: 40).foregroundStyle(
                                    feed == item
                                        ? MarketTheme.background : MarketTheme.secondaryText
                                ).background(
                                    feed == item ? MarketTheme.accentMint : MarketTheme.surface,
                                    in: Capsule())
                            }.buttonStyle(.plain).accessibilityAddTraits(
                                feed == item ? .isSelected : [])
                        }
                    }
                }
                if feed == .stocks {
                    HStack {
                        Text("Company").font(.caption).foregroundStyle(MarketTheme.secondaryText)
                        Spacer()
                        Menu {
                            ForEach(app.watchlist, id: \.self) { symbol in
                                Button(symbol) { ticker = symbol }
                            }
                        } label: {
                            Label(
                                ticker.isEmpty ? "All watchlist stocks" : ticker,
                                systemImage: "line.3.horizontal.decrease"
                            ).font(.caption)
                        }
                    }
                    if app.watchlist.isEmpty {
                        EmptyState(
                            title: "Add a company first",
                            message: "Your ticker news follows the watchlist.", symbol: "star")
                    }
                }
                if feed == .all || feed == .crucial {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(categories, id: \.self) { item in
                                Button {
                                    category = item
                                } label: {
                                    Text(item).font(.caption).padding(.horizontal, 12).frame(
                                        minHeight: 36
                                    ).foregroundStyle(
                                        category == item
                                            ? MarketTheme.accentMint : MarketTheme.secondaryText
                                    ).background(MarketTheme.surface, in: Capsule())
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                }
                if let error = state.error {
                    FailureState(message: error) { Task { await refresh() } }
                }
                if state.isLoading && state.value == nil { LoadingRows() }
                if let articles = state.value, articles.isEmpty {
                    EmptyState(
                        title: feed == .crucial ? "No crucial stories" : "No stories yet",
                        message: feed == .crucial
                            ? "No current headlines carry an important or critical Marketly label."
                            : "Try another feed or pull to refresh.",
                        symbol: feed == .crucial ? "pin" : "newspaper")
                }
                ForEach(filtered) { article in
                    NavigationLink(value: article) { EditorialCard(article: article) }.buttonStyle(
                        .plain)
                }
            }.padding(20).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }.marketScreen().navigationTitle("News").navigationBarTitleDisplayMode(.inline).task(
            id: requestKey
        ) { await refresh() }.refreshable { await refresh() }
    }

    private func refresh() async {
        await state.load {
            switch feed {
            case .crucial, .all: return try await app.services.news.news(symbol: nil)
            case .stocks:
                let symbols = ticker.isEmpty ? app.watchlist : [ticker]
                return try await app.services.news.groupedNews(symbols: symbols)
            }
        }
    }
}
