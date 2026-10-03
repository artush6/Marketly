import SwiftUI

private struct PreviewWorkspace<Content: View>: View {
    @State private var app = AppModel(preview: true)
    @ViewBuilder let content: () -> Content

    var body: some View {
        NavigationStack { content().researchDestinations() }

            .environment(app).preferredColorScheme(.dark).tint(MarketTheme.accentMint)
    }
}

#Preview("Markets · Dark") { RootView().environment(AppModel(preview: true)) }

#Preview("News") { PreviewWorkspace { NewsView() } }

#Preview("Company") { PreviewWorkspace { CompanyDetailView(symbol: "AAPL") } }

#Preview("Watchlist") { PreviewWorkspace { WatchlistView() } }

#Preview("Assistant · Collapsed") {
    PreviewWorkspace {
        VStack {
            Spacer()
            HStack {
                Spacer()
                AssistantPill {}
            }

            .padding(20)
        }

        .marketScreen()
    }
}

#Preview("Assistant · Sheet") { AssistantPreview() }

#Preview("Assistant · Full screen") {
    AssistantSheet(context: AssistantContext(symbol: "NVDA", name: "NVIDIA")).environment(
        AppModel(preview: true))
}

#Preview("Loading") { PreviewWorkspace { LoadingRows().marketScreen() } }

#Preview("Error") {
    PreviewWorkspace {
        FailureState(message: "You appear to be offline. Reconnect, then try again.") {}

            .padding(20).marketScreen()
    }
}

#Preview("Market map") {
    PreviewWorkspace { ScrollView { HeatmapSection().padding(20) }.marketScreen() }
}

#Preview("Accessibility · Large type") {
    PreviewWorkspace { CompanyDetailView(symbol: "AAPL") }

        .environment(\.dynamicTypeSize, .accessibility1)
}

private struct AssistantPreview: View {
    @State private var presented = true
    @State private var app = AppModel(preview: true)

    var body: some View {
        MarketTheme.background.ignoresSafeArea().sheet(isPresented: $presented) {
            AssistantSheet(context: .market).environment(app)
        }
    }
}
