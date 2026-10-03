import SwiftUI

struct EmptyState: View {
    let title: String
    let message: String
    var symbol = "tray"
    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: symbol)
        } description: {
            Text(message)
        }

        .foregroundStyle(MarketTheme.secondaryText).frame(maxWidth: .infinity)
    }
}
