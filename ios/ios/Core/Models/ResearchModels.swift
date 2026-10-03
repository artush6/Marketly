import Foundation

struct SmallCapCandidate: Identifiable, Decodable {
    enum CodingKeys: String, CodingKey {
        case symbol, sector, industry, payload, confidence
        case name = "company_name"
        case marketCap = "market_cap"
        case potentialScore = "potential_score"
        case riskScore = "risk_score"
        case evidenceCoverage = "evidence_coverage"
        case probability = "estimated_outperformance_probability"
    }
    var id: String { symbol }
    let symbol: String
    let name: String
    let sector: String?
    let marketCap: Double?
    let potentialScore: Double?
    let riskScore: Double?
    let evidenceCoverage: Double?
    let probability: Double?
    var summary: String?

    var companyName: String { name }

    init(
        symbol: String, name: String, sector: String?, marketCap: Double?, potentialScore: Double?,
        riskScore: Double?, evidenceCoverage: Double?, probability: Double?, summary: String?
    ) {
        self.symbol = symbol
        self.name = name
        self.sector = sector
        self.marketCap = marketCap
        self.potentialScore = potentialScore
        self.riskScore = riskScore
        self.evidenceCoverage = evidenceCoverage
        self.probability = probability
        self.summary = summary
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        symbol = try container.decode(String.self, forKey: .symbol)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? symbol
        sector = try container.decodeIfPresent(String.self, forKey: .sector)
        marketCap = try container.decodeIfPresent(Double.self, forKey: .marketCap)
        potentialScore = try container.decodeIfPresent(Double.self, forKey: .potentialScore)
        riskScore = try container.decodeIfPresent(Double.self, forKey: .riskScore)
        evidenceCoverage = try container.decodeIfPresent(Double.self, forKey: .evidenceCoverage)
        probability = try container.decodeIfPresent(Double.self, forKey: .probability)
        let payload = try container.decodeIfPresent(Payload.self, forKey: .payload)
        summary = payload?.summary
    }

    private struct Payload: Decodable { let summary: String? }
}

struct EarningsEvent: Identifiable, Decodable {
    enum CodingKeys: String, CodingKey {
        case id, symbol, date, hour, quarter, year, estimate, currency
    }

    let id: String
    let symbol: String
    let date: String
    let hour: String?
    let quarter: Int?
    let year: Int?
    let estimate: Double?
    let currency: String?
}

struct EarningsCalendar: Decodable {
    enum CodingKeys: String, CodingKey { case events, note, pendingSymbols }
    let events: [EarningsEvent]
    let pendingSymbols: [String]
    let note: String
}

struct AlertRule: Identifiable, Decodable {
    enum CodingKeys: String, CodingKey {
        case id, symbol, enabled, direction, threshold
        case triggerType = "trigger_type"
    }

    let id: String
    let symbol: String
    let triggerType: String
    let direction: String
    let threshold: Double
    let enabled: Bool
}

struct MarketNotification: Identifiable, Decodable {
    enum CodingKeys: String, CodingKey {
        case id, category, symbol, severity, title, body
        case createdAt = "created_at"
        case readAt = "read_at"
    }

    let id: String
    let category: String
    let symbol: String?
    let severity: String?
    let title: String
    let body: String
    let createdAt: String
    let readAt: String?
}

struct AlertInbox: Decodable {
    enum CodingKeys: String, CodingKey {
        case notifications, preferences, followedSymbols, ruleSymbols, deviceCount, pushConfigured
    }

    let notifications: [MarketNotification]
    let preferences: AlertPreferences?
    let followedSymbols: [String]
    let ruleSymbols: [String]
    let deviceCount: Int
    let pushConfigured: Bool
}

struct AlertPreferences: Decodable {
    enum CodingKeys: String, CodingKey {
        case priceDropThresholds = "price_drop_thresholds"
        case importantNewsEnabled = "important_news_enabled"
        case discoveryEnabled = "discovery_enabled"
        case discoveryMinScore = "discovery_min_score"
    }

    let priceDropThresholds: [Int]?
    let importantNewsEnabled: Bool?
    let discoveryEnabled: Bool?
    let discoveryMinScore: Int?
}

struct AlertRuleBody: Encodable {
    let symbol: String
    let trigger_type: String
    let direction: String
    let threshold: Double
}

struct SmallCapScanBody: Encodable {
    let name: String
    let min_market_cap: Int
    let max_market_cap: Int
    let min_average_volume: Int
    let countries: [String]
    let deep_limit: Int
}

struct CompanyCandidateList: Decodable { let candidates: [SmallCapCandidate] }
struct CompanyCompareResult: Identifiable {
    var id: String { detail.quote.symbol }
    let detail: CompanyDetail
}
struct SavedResearchItem: Identifiable, Codable {
    var id: String { symbol }
    let symbol: String
    let name: String
    let savedAt: Date

    private enum CodingKeys: String, CodingKey { case id, symbol, name, savedAt, financials, news }

    init(symbol: String, name: String, savedAt: Date) {
        self.symbol = symbol
        self.name = name
        self.savedAt = savedAt
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        symbol = try values.decode(String.self, forKey: .symbol)
        name = try values.decode(String.self, forKey: .name)
        if let date = try? values.decode(Date.self, forKey: .savedAt) {
            savedAt = date
        } else {
            let text = try values.decode(String.self, forKey: .savedAt)
            guard let date = ISO8601DateFormatter().date(from: text) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .savedAt, in: values, debugDescription: "Invalid save date.")
            }
            savedAt = date
        }
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(id, forKey: .id)
        try values.encode(symbol, forKey: .symbol)
        try values.encode(name, forKey: .name)
        try values.encode(savedAt, forKey: .savedAt)
        try values.encode(FinancialsPlaceholder(symbol: symbol, name: name), forKey: .financials)
        try values.encode([String](), forKey: .news)
    }

    private struct FinancialsPlaceholder: Encodable {
        let symbol: String
        let info: CompanyInfo

        init(symbol: String, name: String) {
            self.symbol = symbol
            info = CompanyInfo(shortName: name)
        }
    }

    private struct CompanyInfo: Encodable { let shortName: String }
}
