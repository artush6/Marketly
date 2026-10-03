import SwiftUI

enum MarketTheme {
    static let background = Color(red: 0.031, green: 0.043, blue: 0.047)
    static let surface = Color(red: 0.060, green: 0.075, blue: 0.080)
    static let elevatedSurface = Color(red: 0.090, green: 0.108, blue: 0.114)
    static let border = Color.white.opacity(0.10)
    static let primaryText = Color(red: 0.94, green: 0.96, blue: 0.95)
    static let secondaryText = Color(red: 0.61, green: 0.66, blue: 0.68)
    static let tertiaryText = Color(red: 0.46, green: 0.52, blue: 0.54)
    static let accentMint = Color(red: 0.60, green: 0.86, blue: 0.76)
    static let positive = Color(red: 0.17, green: 0.89, blue: 0.63)
    static let negative = Color(red: 1.0, green: 0.36, blue: 0.39)
    static let warning = Color(red: 0.94, green: 0.74, blue: 0.39)
    static let radius: CGFloat = 14
    enum Space {
        static let xs: CGFloat = 4, sm: CGFloat = 8, md: CGFloat = 12
        static let lg: CGFloat = 16, xl: CGFloat = 20, xxl: CGFloat = 24, xxxl: CGFloat = 32
    }
}

struct Panel: ViewModifier {
    func body(content: Content) -> some View {
        content.padding(MarketTheme.Space.lg).background(
            MarketTheme.surface, in: RoundedRectangle(cornerRadius: MarketTheme.radius)
        ).overlay(
            RoundedRectangle(cornerRadius: MarketTheme.radius).strokeBorder(MarketTheme.border))
    }
}

extension View {
    func marketPanel() -> some View { modifier(Panel()) }

    func marketScreen() -> some View {
        background(MarketTheme.background).foregroundStyle(MarketTheme.primaryText)
    }
}

enum MarketFormat {
    static func price(_ value: Double?, currency: String = "USD") -> String {
        guard let value else { return "—" }

        return value.formatted(.currency(code: currency).precision(.fractionLength(2)))
    }

    static func change(_ value: Double?) -> String {
        guard let value else { return "—" }

        return String(format: "%+.2f%%", value)
    }

    static func compact(_ value: Double?, currency: String? = nil) -> String {
        guard let value else { return "—" }

        let magnitude = abs(value)
        let (divisor, suffix): (Double, String) =
            magnitude >= 1e12
            ? (1e12, "T") : magnitude >= 1e9 ? (1e9, "B") : magnitude >= 1e6 ? (1e6, "M") : (1, "")
        return (currency == "USD" ? "$" : currency.map { $0 + " " } ?? "")
            + String(format: "%.2f", value / divisor) + suffix
    }
}
