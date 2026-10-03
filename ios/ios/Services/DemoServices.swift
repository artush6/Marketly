import Foundation

struct DemoServices: MarketDataService, CompanyService, NewsService, AssistantService {
    var delay: Duration = .milliseconds(250)
    func overview(symbols: [String]) async throws -> MarketSnapshot {
        try await Task.sleep(for: delay)
        return MarketSnapshot(
            quotes: DemoData.indices + DemoData.companies.filter { symbols.contains($0.symbol) },
            articles: DemoData.articles, fetchedAt: DemoData.date,
            note: "Illustrative snapshot · ETF proxies · USD")
    }

    func heatmap(period: MarketPeriod) async throws -> [HeatmapStock] {
        try await Task.sleep(for: delay)
        let factor: Double =
            switch period {
            case .day: 1
            case .week: 2.2
            case .month: 4.7
            case .year: 12.3
            }

        return DemoData.stocks.map {
            HeatmapStock(
                symbol: $0.symbol, name: $0.name, sector: $0.sector, marketCap: $0.marketCap,
                changePercent: $0.changePercent.map { $0 * factor })
        }
    }

    func search(query: String) async throws -> [SearchResult] {
        try await Task.sleep(for: delay)
        return (DemoData.companies + DemoData.indices).filter {
            $0.name.localizedCaseInsensitiveContains(query)
                || $0.symbol.localizedCaseInsensitiveContains(query)
        }

        .map { SearchResult(symbol: $0.symbol, name: $0.name) }
    }

    func company(symbol: String) async throws -> CompanyDetail {
        try await Task.sleep(for: delay)
        guard
            let quote = (DemoData.companies + DemoData.indices).first(where: { $0.symbol == symbol }
            )
        else {
            throw APIError.unavailable(
                "This company is not included in the demo. Switch to live services to research it.")
        }

        return DemoData.detail(quote)
    }

    func news(symbol: String?) async throws -> [Article] {
        try await Task.sleep(for: delay)
        return DemoData.articles
    }
    func groupedNews(symbols: [String]) async throws -> [Article] {
        try await Task.sleep(for: delay)
        guard let symbol = symbols.first else { return [] }
        return DemoData.articles.map { article in
            var article = article
            article.relatedSymbols = [symbol]
            return article
        }
    }

    func send(
        messages: [ChatMessage], context: AssistantContext, strategy: ResearchStrategy,
        horizon: InvestmentHorizon, searchWeb: Bool
    ) async throws -> AsyncThrowingStream<AssistantChunk, Error> {
        let answer =
            "**Demo response · no live research performed**\n\nFor \(context.name), I would begin with three questions:\n\n**1. What changed?** Separate the latest price move from changes in business fundamentals.\n\n**2. What is already priced in?** Compare growth expectations with margins, free cash flow and valuation.\n\n**3. What would change the thesis?** Identify the next earnings release, demand indicators and balance-sheet risks.\n\nYour lens is **\(strategy.rawValue.lowercased())**, over **\(horizon.rawValue.lowercased())**. This is a sample conversation to demonstrate the native research experience. Connect live services for an evidence-based answer to your question."
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for word in answer.split(separator: " ", omittingEmptySubsequences: false) {
                        try await Task.sleep(for: .milliseconds(22))
                        continuation.yield(.text(String(word) + " "))
                    }

                    continuation.finish()
                } catch { continuation.finish(throwing: error) }
            }

            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
