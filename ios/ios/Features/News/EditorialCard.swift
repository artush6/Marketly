import SwiftUI

struct EditorialCard: View {
    let article: Article
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            StoryImage(article: article).frame(height: 190).clipped()
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Eyebrow(text: article.category)
                    Spacer()
                    if article.isDemo {
                        Text("Sample story").font(.caption2).foregroundStyle(
                            MarketTheme.tertiaryText)
                    } else if let date = article.publishedAt {
                        Text(date, style: .relative).font(.caption2).foregroundStyle(
                            MarketTheme.tertiaryText)
                    }
                }

                Text(article.headline).font(.title3.weight(.semibold)).tracking(-0.3).fixedSize(
                    horizontal: false, vertical: true)
                Text(article.summary).font(.subheadline).foregroundStyle(MarketTheme.secondaryText)
                    .lineLimit(3).lineSpacing(3)
                HStack {
                    Text(article.source).font(.caption2)
                    Spacer()
                    Image(systemName: "arrow.up.right")
                }

                .foregroundStyle(MarketTheme.accentMint)
            }

            .padding(18)
        }

        .background(MarketTheme.surface).clipShape(RoundedRectangle(cornerRadius: 14)).overlay(
            RoundedRectangle(cornerRadius: 14).strokeBorder(MarketTheme.border))
    }
}
