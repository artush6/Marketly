import SwiftUI

struct Eyebrow: View {
    let text: String
    var body: some View {
        Text(text.uppercased()).font(.system(.caption2, design: .monospaced)).tracking(1.7)
            .foregroundStyle(MarketTheme.secondaryText)
    }
}
