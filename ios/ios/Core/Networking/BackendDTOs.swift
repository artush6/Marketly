import Foundation

/// Transport DTOs mirror the existing FastAPI contracts. Unknown fields are ignored;
/// missing financial values remain nil rather than becoming invented zeros.
struct QuoteDTO: Decodable {
    let symbol: String
    let price: Double?
    let changePercent: Double?
    let stale: Bool?
    func model(name: String? = nil) -> Quote {
        Quote(
            symbol: symbol, name: name ?? symbol, price: price, changePercent: changePercent,
            marketCap: nil, sector: "")
    }
}

struct ArticleDTO: Decodable {
    let headline: String
    let summary: String?
    let source: String?
    let category: String?
    let datetime: Double?
    let importanceLabel: String?
    let image: String?
    let url: String?
    var model: Article {
        Article(
            headline: headline, summary: summary ?? "", source: source ?? "Source unavailable",
            category: category ?? "Markets",
            publishedAt: datetime.map(Date.init(timeIntervalSince1970:)),
            imageURL: Self.safeURL(image), url: Self.safeURL(url), importanceLabel: importanceLabel)
    }

    static func safeURL(_ value: String?) -> URL? {
        guard let value, let url = URL(string: value),
            ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host != nil
        else { return nil }

        return url
    }
}

struct CompanyMetadataDTO: Decodable {
    let symbol: String
    let name: String
    let logoUrl: String?
}
struct MetadataResponseDTO: Decodable { let companies: [CompanyMetadataDTO] }
struct OverviewDTO: Decodable {
    let quotes: [QuoteDTO]
    let news: [ArticleDTO]
    let fetchedAt: String?
    let quoteBasis: String?
    let newsStatus: String?
}

struct SearchDTO: Decodable { let results: [SearchResult] }

struct HeatmapDTO: Decodable {
    let stocks: [HeatmapStock]
    let stale: Bool?
}

struct BriefingDTO: Decodable {
    struct Section: Decodable {
        let articles: [ArticleDTO]
        let status: String
    }

    let market: Section
    let world: Section
}

struct FinancialsDTO: Decodable {
    struct TrendPoint: Decodable { let value: Double? }
    struct Observation: Decodable {
        let date: String
        let frequency: String
        let metrics: [String: TrendPoint]
    }
    struct Trends: Decodable { let observations: [Observation] }
    struct Info: Decodable {
        let shortName: String?
        let sector: String?
        let industry: String?
        let currency: String?
        let marketCap: Double?
        let longBusinessSummary: String?
        let logo: String?
        let image: String?
    }

    struct QuoteData: Decodable {
        let c: Double?
        let currentPrice: Double?
        let dp: Double?
        let marketCap: Double?
    }

    struct Comparison: Decodable {
        let value: Double?
        let unit: String
        let basis: String
        let period: String?
        let currency: String?
    }

    let symbol: String
    let info: Info?
    let quote: QuoteData?
    let comparisonMetrics: [String: Comparison]?
    let financialTrends: Trends?
}

struct FollowUpBody: Encodable {
    struct Message: Encodable {
        let role: ChatRole
        let content: String
    }

    struct Context: Encodable {
        let strategy: String
        let horizon: String
        let articleTitle: String?
        let articleURL: String?
        let articleSummary: String?
    }

    let symbol: String
    let question: String
    let conversation: [Message]
    let analysis_context: Context?
    let research: Bool
}

struct FollowUpDTO: Decodable {
    let answer: String
    let sources: [AssistantSource]?
}
