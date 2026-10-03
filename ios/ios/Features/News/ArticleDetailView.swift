import SwiftUI

struct ArticleDetailView: View {
    @Environment(AppModel.self) private var app
    let article: Article
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                StoryImage(article: article).frame(height: 230).clipped().clipShape(
                    RoundedRectangle(cornerRadius: 12))
                Eyebrow(text: article.category)
                Text(article.headline).font(.largeTitle.weight(.semibold)).tracking(-0.8)
                Text(article.source).font(.caption).foregroundStyle(MarketTheme.accentMint)
                if let date = article.publishedAt {
                    Text(date.formatted(date: .abbreviated, time: .shortened)).font(.caption)
                        .foregroundStyle(MarketTheme.secondaryText)
                }

                Text(
                    article.summary.isEmpty
                        ? "Open the original article to read the full story." : article.summary
                ).font(.body).lineSpacing(7).foregroundStyle(MarketTheme.secondaryText)
                if let url = article.url {
                    Link(destination: url) {
                        Label("Read original story", systemImage: "arrow.up.right").frame(
                            maxWidth: .infinity, minHeight: 44)
                    }

                    .buttonStyle(.bordered)
                }

                Divider().overlay(MarketTheme.border)
                Text("Put the story in context.").font(.title2.weight(.semibold))
                Text(
                    article.relatedSymbols.isEmpty
                        ? "Ask how this could affect a business, a sector, or your research thesis."
                        : "Related tickers: " + article.relatedSymbols.joined(separator: ", ")
                ).font(.subheadline).foregroundStyle(MarketTheme.secondaryText)
            }

            .padding(20).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }

        .marketScreen().navigationTitle("Beyond the ticker").navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, alignment: .trailing) {
            AssistantPill {
                app.ask(
                    AssistantContext(
                        symbol: article.relatedSymbols.first ?? "MARKET", name: article.headline,
                        article: article))
            }

            .padding(.trailing, 20).padding(.vertical, 8)
        }
    }
}
