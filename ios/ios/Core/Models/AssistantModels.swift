import Foundation

enum ChatRole: String, Codable { case user, assistant }

struct ChatMessage: Identifiable, Codable {
    var id = UUID()
    let role: ChatRole
    var content: String
}

struct AssistantContext: Identifiable, Equatable {
    var id: String { symbol + (article?.id ?? "") }

    var symbol: String = "MARKET"
    var name: String = "Market overview"
    var article: Article?
    static let market = AssistantContext()
}

enum ResearchStrategy: String, CaseIterable, Identifiable {
    case balanced = "Balanced"
    case quality = "Quality"
    case growth = "Growth"
    case value = "Value"
    var id: String { rawValue }
}

enum InvestmentHorizon: String, CaseIterable, Identifiable {
    case short = "Near term"
    case medium = "1–3 years"
    case long = "5+ years"
    var id: String { rawValue }
}

enum AssistantChunk {
    case text(String)
    case sources([AssistantSource])
}

struct AssistantSource: Codable, Identifiable {
    var id: String { url }

    let title: String?
    let url: String
}
