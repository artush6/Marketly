import SwiftUI

struct SectionTitle: View {
    let number: String
    let title: String
    var body: some View {
        HStack(spacing: 10) {
            Text(number).font(.system(.subheadline, design: .monospaced)).foregroundStyle(
                MarketTheme.tertiaryText)
            Text(title).font(.headline)
        }

        .accessibilityElement(children: .combine).accessibilityAddTraits(.isHeader)
    }
}
