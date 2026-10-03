import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var app = app
        TabView(selection: $app.selectedTab) {
            NavigationStack { MarketsView().researchDestinations() }.tabItem {
                Label("Markets", systemImage: "chart.bar.xaxis")
            }.tag(0)
            NavigationStack { SmallCapView().researchDestinations() }.tabItem {
                Label("Small CAP", systemImage: "chart.line.uptrend.xyaxis")
            }.tag(1)
            NavigationStack { NewsView().researchDestinations() }.tabItem {
                Label("News", systemImage: "newspaper")
            }.tag(2)
            NavigationStack { WatchlistView().researchDestinations() }.tabItem {
                Label("Watchlist", systemImage: "star")
            }.tag(3)
            NavigationStack { MoreView().researchDestinations() }.tabItem {
                Label("More", systemImage: "line.3.horizontal")
            }.tag(4)
        }.id(app.generation).tint(MarketTheme.accentMint).preferredColorScheme(.dark)
            .toolbarBackground(MarketTheme.background, for: .tabBar).toolbarBackground(
                .visible, for: .tabBar
            ).fullScreenCover(item: $app.assistantContext) { context in
                AssistantSheet(context: context).environment(app)
            }.sheet(isPresented: $app.settingsPresented) {
                NavigationStack { SettingsView() }.environment(app).preferredColorScheme(.dark)
                    .tint(MarketTheme.accentMint)
            }.onReceive(NotificationCenter.default.publisher(for: .marketlyAPNSToken)) { event in
                guard let token = event.object as? String else { return }
                Task { await app.receiveAPNSToken(token) }
            }.onReceive(NotificationCenter.default.publisher(for: .marketlyAPNSError)) { event in
                guard let message = event.object as? String else { return }
                app.receiveAPNSError(message)
            }
    }
}

private struct ResearchDestinations: ViewModifier {
    func body(content: Content) -> some View {
        content.navigationDestination(for: SearchResult.self) { result in
            CompanyDetailView(symbol: result.symbol)
        }.navigationDestination(for: Article.self) { article in ArticleDetailView(article: article)
        }
    }
}

extension View { func researchDestinations() -> some View { modifier(ResearchDestinations()) } }
