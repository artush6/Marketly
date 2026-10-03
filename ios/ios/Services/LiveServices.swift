import Foundation

struct LiveServices: MarketDataService, CompanyService, NewsService, AssistantService {
    let client: APIClient
    static let benchmarks = [
        "SPY": "S&P 500", "QQQ": "Nasdaq 100", "DIA": "Dow Jones", "IWM": "Russell 2000",
        "GLD": "Gold", "SLV": "Silver", "BNO": "Brent crude",
    ]
    func overview(symbols: [String]) async throws -> MarketSnapshot {
        let selected = Array(Set(symbols + ["GLD", "SLV", "BNO"])).sorted().prefix(12)
        let dto = try await client.request(
            Endpoint<OverviewDTO>(
                path: "/market/overview",
                query: [.init(name: "symbols", value: selected.joined(separator: ","))]))
        var metadata: [String: CompanyMetadataDTO] = [:]
        let symbols = dto.quotes.map(\.symbol)
        for batchStart in stride(from: 0, to: symbols.count, by: 12) {
            let batch = Array(symbols.dropFirst(batchStart).prefix(12))
            do {
                let response = try await client.request(
                    Endpoint<MetadataResponseDTO>(
                        path: "/companies/metadata",
                        query: [.init(name: "symbols", value: batch.joined(separator: ","))]))
                for company in response.companies { metadata[company.symbol] = company }
            } catch is CancellationError { throw CancellationError() } catch {
                try Task.checkCancellation()
            }
        }
        let quotes = dto.quotes.map { dto in
            let profile = metadata[dto.symbol]
            var quote = dto.model(name: Self.benchmarks[dto.symbol] ?? profile?.name)
            quote.logoURL = ArticleDTO.safeURL(profile?.logoUrl)
            return quote
        }

        var note = dto.quoteBasis ?? "Quotes may be delayed"
        if dto.quotes.contains(where: { $0.stale == true }) {
            note += " · Some cached quotes are stale"
        }

        if dto.newsStatus == "unavailable" { note += " · Briefing unavailable" }

        return MarketSnapshot(
            quotes: quotes, articles: dto.news.map(\.model),
            fetchedAt: Self.parseDate(dto.fetchedAt), note: note)
    }

    func heatmap(period: MarketPeriod) async throws -> [HeatmapStock] {
        guard period == .day else {
            throw APIError.unavailable(
                "The current market-map API provides daily moves only. Select 1D.")
        }

        let dto = try await client.request(Endpoint<HeatmapDTO>(path: "/market/heatmap"))
        guard dto.stale != true else {
            throw APIError.unavailable(
                "The market-map provider is unavailable and its cached map is stale. Please retry later."
            )
        }

        // Backend explicitly defines marketCap in USD millions.
        return dto.stocks.filter { $0.marketCap > 0 && $0.marketCap.isFinite }

            .map {
                HeatmapStock(
                    symbol: $0.symbol, name: $0.name, sector: $0.sector,
                    marketCap: $0.marketCap * 1_000_000, changePercent: $0.changePercent)
            }
    }

    func search(query: String) async throws -> [SearchResult] {
        try await client.request(
            Endpoint<SearchDTO>(path: "/discovery/search", query: [.init(name: "q", value: query)])
        ).results
    }

    func company(symbol: String) async throws -> CompanyDetail {
        let dto = try await client.request(Endpoint<FinancialsDTO>(path: "/financials/\(symbol)"))
        var notice = "Price history is not exposed by the current API."
        let articles: [Article]
        do { articles = try await news(symbol: symbol) } catch is CancellationError {
            throw CancellationError()
        } catch {
            try Task.checkCancellation()
            articles = []
            notice += " Related news could not be loaded."
        }

        let quote = Quote(
            symbol: symbol, name: dto.info?.shortName ?? symbol,
            price: dto.quote?.c ?? dto.quote?.currentPrice, changePercent: dto.quote?.dp,
            marketCap: dto.info?.marketCap ?? dto.quote?.marketCap,
            sector: dto.info?.sector ?? dto.info?.industry ?? "Sector unavailable",
            currency: dto.info?.currency ?? "USD",
            logoURL: ArticleDTO.safeURL(dto.info?.logo ?? dto.info?.image))
        let keys = [
            ("marketCap", "Market cap"), ("trailingPE", "P/E ratio"), ("revenue", "Revenue"),
            ("netMargin", "Net margin"), ("revenueGrowth", "Revenue growth"),
            ("freeCashFlow", "Free cash flow"),
        ]
        let metrics = keys.map { key, label in
            let m = dto.comparisonMetrics?[key]
            return Metric(
                label: label, value: m?.value, unit: m?.unit ?? "number",
                basis: [m?.basis, m?.period].compactMap { $0 }.joined(separator: " · "),
                currency: m?.currency ?? quote.currency)
        }

        let annualHistory = (dto.financialTrends?.observations ?? []).filter {
            $0.frequency == "annual"
        }.compactMap { observation -> FinancialPoint? in
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withFullDate]
            guard let date = formatter.date(from: observation.date) else { return nil }
            return FinancialPoint(
                symbol: symbol, date: date, period: String(observation.date.prefix(4)),
                revenue: observation.metrics["revenue"]?.value,
                netIncome: observation.metrics["netIncome"]?.value,
                freeCashFlow: observation.metrics["freeCashFlow"]?.value)
        }.sorted { $0.date < $1.date }
        return CompanyDetail(
            quote: quote,
            summary: dto.info?.longBusinessSummary
                ?? "Business description is unavailable from the current provider.",
            metrics: metrics, articles: articles, notice: notice, financialHistory: annualHistory)
    }

    func groupedNews(symbols: [String]) async throws -> [Article] {
        guard !symbols.isEmpty else { return [] }
        let grouped = try await client.request(
            Endpoint<[String: [ArticleDTO]]>(
                path: "/news/grouped",
                query: [.init(name: "symbols", value: symbols.joined(separator: ","))]))
        return symbols.flatMap { symbol in
            (grouped[symbol] ?? []).map { dto in
                var article = dto.model
                article.relatedSymbols = [symbol]
                return article
            }
        }
    }

    func news(symbol: String?) async throws -> [Article] {
        if let symbol {
            return try await client.request(Endpoint<[ArticleDTO]>(path: "/news/\(symbol)")).map(
                \.model)
        }

        let dto = try await client.request(Endpoint<BriefingDTO>(path: "/news/briefing"))
        guard dto.market.status != "unavailable" || dto.world.status != "unavailable" else {
            throw APIError.unavailable("News providers are temporarily unavailable.")
        }

        var seen = Set<String>()
        return (dto.market.articles + dto.world.articles).map(\.model).filter {
            seen.insert($0.id).inserted
        }
    }

    func send(
        messages: [ChatMessage], context: AssistantContext, strategy: ResearchStrategy,
        horizon: InvestmentHorizon, searchWeb: Bool
    ) async throws -> AsyncThrowingStream<AssistantChunk, Error> {
        guard let question = messages.last(where: { $0.role == .user })?.content else {
            throw APIError.unavailable("Enter a question first.")
        }

        // Preserve the backend's financial fetch for company questions by omitting
        // analysis_context unless article context or research mode actually needs it.
        let articleContext = FollowUpBody.Context(
            strategy: strategy.rawValue, horizon: horizon.rawValue,
            articleTitle: context.article?.headline,
            articleURL: context.article?.url?.absoluteString,
            articleSummary: context.article?.summary)
        let body = FollowUpBody(
            symbol: context.symbol,
            question:
                "Research lens: \(strategy.rawValue). Horizon: \(horizon.rawValue).\n\n\(question)",
            conversation: messages.dropLast().suffix(12).map {
                .init(role: $0.role, content: String($0.content.prefix(6000)))
            }, analysis_context: context.article != nil || searchWeb ? articleContext : nil,
            research: searchWeb)
        let response = try await client.request(
            Endpoint<FollowUpDTO>(
                path: "/assistant/follow-up", method: .post, body: JSONEncoder().encode(body)))
        // Existing route returns one JSON answer. Do not simulate live token streaming.
        return AsyncThrowingStream { continuation in
            continuation.yield(.text(response.answer))
            continuation.yield(.sources(response.sources ?? []))
            continuation.finish()
        }
    }

    static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}
