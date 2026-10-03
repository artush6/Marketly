import SwiftUI

struct StoryRow: View {
    let article: Article
    var body: some View {
        HStack(spacing: 12) {
            StoryImage(article: article).frame(width: 76, height: 65).clipShape(
                RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 6) {
                Text(article.headline).font(.subheadline.weight(.medium)).lineLimit(3)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    Text(article.source).lineLimit(1)
                    if !article.relatedSymbols.isEmpty {
                        Text("· " + article.relatedSymbols.joined(separator: ", ")).lineLimit(1)
                    }
                }.font(.caption2).foregroundStyle(MarketTheme.secondaryText)
            }

            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(
                MarketTheme.tertiaryText)
        }

        .padding(.vertical, 10).contentShape(Rectangle())
    }
}
