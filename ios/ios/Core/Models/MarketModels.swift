import Foundation

struct Quote: Identifiable, Codable, Hashable {
    var id: String { symbol }

    let symbol: String
    var name: String
    var price: Double?
    var changePercent: Double?
    var marketCap: Double?
    var sector: String
    var currency: String = "USD"
    var logoURL: URL? = nil
    var history: [PricePoint] = []
}

struct PricePoint: Identifiable, Codable, Hashable {
    var id: Date { date }

    let date: Date
    let close: Double
}

struct SearchResult: Identifiable, Codable, Hashable {
    var id: String { symbol }

    let symbol: String
    let name: String
    var type: String = "Common Stock"
}

struct Article: Identifiable, Codable, Hashable {
    var id: String { url?.absoluteString ?? headline }

    let headline: String
    let summary: String
    let source: String
    let category: String
    let publishedAt: Date?
    let imageURL: URL?
    let url: URL?
    var relatedSymbols: [String] = []
    var importanceLabel: String? = nil
}

struct MarketSnapshot {
    var quotes: [Quote]
    var articles: [Article]
    var fetchedAt: Date?
    var note: String
}

struct HeatmapStock: Identifiable, Codable, Hashable {
    var id: String { symbol }

    let symbol: String
    let name: String
    let sector: String
    let marketCap: Double
    let changePercent: Double?
}

enum MarketPeriod: String, CaseIterable, Identifiable {
    case day = "1D"
    case week = "1W"
    case month = "1M"
    case year = "1Y"
    var id: String { rawValue }
}

struct Metric: Identifiable {
    var id: String { label }

    let label: String
    let value: Double?
    let unit: String
    let basis: String
    var currency: String = "USD"
    var formatted: String {
        guard let value else { return "—" }

        switch unit {
        case "money": return MarketFormat.compact(value, currency: currency)
        case "percent": return String(format: "%.1f%%", value)
        case "multiple": return String(format: "%.1f×", value)
        default: return value.formatted(.number.precision(.fractionLength(0...2)))
        }
    }
}

struct CompanyDetail {
    var quote: Quote
    var summary: String
    var metrics: [Metric]
    var articles: [Article]
    var notice: String?
    var financialHistory: [FinancialPoint] = []
}

struct Breadth {
    let stocks: [HeatmapStock]
    var covered: [HeatmapStock] { stocks.filter { $0.changePercent != nil } }

    var advancing: Int { covered.filter { $0.changePercent! > 0 }.count }

    var declining: Int { covered.filter { $0.changePercent! < 0 }.count }

    var unchanged: Int { covered.count - advancing - declining }

    var equalWeight: Double? {
        covered.isEmpty ? nil : covered.reduce(0) { $0 + $1.changePercent! } / Double(covered.count)
    }

    var capWeight: Double? {
        let total = covered.reduce(0) { $0 + $1.marketCap }

        return total > 0 ? covered.reduce(0) { $0 + $1.marketCap * $1.changePercent! } / total : nil
    }
}
