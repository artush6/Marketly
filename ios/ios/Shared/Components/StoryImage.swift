import SwiftUI

struct StoryImage: View {
    let article: Article
    var body: some View {
        AsyncImage(url: article.imageURL) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            ZStack {
                LinearGradient(
                    colors: [MarketTheme.elevatedSurface, MarketTheme.surface],
                    startPoint: .topLeading, endPoint: .bottomTrailing)
                Image(
                    systemName: article.category == "Technology"
                        ? "cpu" : article.category == "Energy" ? "fuelpump" : "building.2"
                ).font(.title).foregroundStyle(MarketTheme.accentMint.opacity(0.55))
            }
        }

        .accessibilityHidden(true)
    }
}
