import SwiftUI

struct LogoView: View {
    let symbol: String
    var url: URL?
    var size: CGFloat = 44

    var body: some View {
        AsyncImage(url: validURL) { phase in
            switch phase {
            case .success(let image): image.resizable().scaledToFit().padding(5)
            case .empty, .failure:
                Text(String(symbol.prefix(1))).font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundStyle(MarketTheme.accentMint)
            @unknown default: Text(String(symbol.prefix(1))).foregroundStyle(MarketTheme.accentMint)
            }
        }.frame(width: size, height: size).background(
            MarketTheme.elevatedSurface, in: RoundedRectangle(cornerRadius: size * 0.24)
        ).accessibilityLabel("\(symbol) company logo")
    }

    private var validURL: URL? {
        guard let url, url.scheme?.lowercased() == "https", url.host != nil else { return nil }
        return url
    }
}
