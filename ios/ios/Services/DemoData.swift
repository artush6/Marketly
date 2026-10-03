import Foundation

/// Deliberately fixed fixtures. The app labels this entire service mode as Demo.
enum DemoData {
    static let date = Date(timeIntervalSince1970: 1_759_507_200)
    static func history(price: Double, seed: Int, count: Int = 48) -> [PricePoint] {
        (0..<count).map { i in
            let trend = Double(i) / Double(count) * 0.025
            let wave = sin(Double(i + seed) * 0.72) * 0.0025 + sin(Double(i * 3 + seed)) * 0.0016
            return PricePoint(
                date: date.addingTimeInterval(Double(i - count) * 1800),
                close: price * (0.975 + trend + wave))
        }
    }

    static func quote(
        _ symbol: String, _ name: String, _ price: Double, _ move: Double, _ cap: Double,
        _ sector: String, _ seed: Int
    ) -> Quote {
        Quote(
            symbol: symbol, name: name, price: price, changePercent: move, marketCap: cap,
            sector: sector, history: history(price: price, seed: seed))
    }

    static let indices: [Quote] = [
        quote("SPY", "S&P 500", 573.76, 0.72, 0, "Index-tracking ETF", 1),
        quote("QQQ", "Nasdaq 100", 488.42, 1.08, 0, "Index-tracking ETF", 4),
        quote("DIA", "Dow Jones", 421.58, 0.46, 0, "Index-tracking ETF", 8),
        quote("IWM", "Russell 2000", 219.83, -0.31, 0, "Index-tracking ETF", 12),
        quote("GLD", "Gold", 243.72, 0.28, 0, "Commodity ETF", 7),
        quote("SLV", "Silver", 28.91, -0.42, 0, "Commodity ETF", 9),
        quote("BNO", "Brent crude", 29.17, -1.14, 0, "Commodity ETF", 11),
    ]
    static let companies: [Quote] = [
        quote("NVDA", "NVIDIA", 127.72, 1.34, 3.13e12, "Technology", 2),
        quote("MSFT", "Microsoft", 428.02, 0.92, 3.18e12, "Technology", 5),
        quote("AAPL", "Apple", 227.52, 1.03, 3.46e12, "Consumer electronics", 8),
        quote("GOOGL", "Alphabet", 165.85, 1.61, 2.04e12, "Communication", 11),
        quote("AMZN", "Amazon", 186.51, 0.78, 1.96e12, "Consumer discretionary", 4),
        quote("META", "Meta Platforms", 567.36, -0.62, 1.43e12, "Communication", 7),
        quote("AVGO", "Broadcom", 172.69, 0.81, 0.80e12, "Technology", 9),
        quote("JPM", "JPMorgan Chase", 210.50, -0.24, 0.59e12, "Financials", 13),
        quote("V", "Visa", 275.17, 0.48, 0.54e12, "Financials", 16),
        quote("XOM", "Exxon Mobil", 117.13, -1.02, 0.52e12, "Energy", 17),
        quote("LLY", "Eli Lilly", 885.00, 0.37, 0.84e12, "Healthcare", 19),
        quote("UNH", "UnitedHealth", 581.42, -0.71, 0.53e12, "Healthcare", 22),
        quote("CAT", "Caterpillar", 389.71, 0.41, 0.19e12, "Industrials", 23),
        quote("COST", "Costco", 891.22, 0.64, 0.40e12, "Consumer staples", 24),
        quote("PLAB", "Photronics", 24.14, 2.12, 1.48e9, "Technology", 25),
        quote("HURN", "Huron Consulting", 107.21, -0.53, 1.92e9, "Industrials", 27),
    ]
    static let articles: [Article] = [
        story(
            "The next chapter of the AI infrastructure buildout", "Technology",
            "Capital spending is only half the story. Power, networking and the economics of inference are becoming the next constraints to watch.",
            "photo-1518770660439-4636190af475", 2),
        story(
            "Oil markets weigh supply discipline against softer demand", "Energy",
            "A closer look at the balance between production, inventories and industrial demand—and what it means for energy businesses.",
            "photo-1516937941344-00b4e0337589", 4),
        story(
            "What a changing rate path means for industrial companies", "Industrials",
            "Order books, financing costs and pricing power offer different signals across the industrial economy.",
            "photo-1486406146926-c627a92ad1ab", 6),
        story(
            "Looking beyond the largest names in the index", "Markets",
            "Market breadth provides a different lens on a rally. Compare participation with the performance of the largest constituents.",
            "photo-1444653614773-995cb1ef9efa", 8),
    ]
    private static func story(
        _ title: String, _ category: String, _ summary: String, _ photo: String, _ hours: Double
    ) -> Article {
        Article(
            headline: title, summary: summary, source: "Marketly · Sample story",
            category: category, publishedAt: date.addingTimeInterval(-hours * 3600),
            imageURL: URL(
                string: "https://images.unsplash.com/\(photo)?auto=format&fit=crop&w=900&q=80"),
            url: nil, isDemo: true)
    }

    static var stocks: [HeatmapStock] {
        companies.map {
            HeatmapStock(
                symbol: $0.symbol, name: $0.name, sector: $0.sector, marketCap: $0.marketCap ?? 0,
                changePercent: $0.changePercent)
        }
    }

    static func detail(_ quote: Quote) -> CompanyDetail {
        let descriptions = [
            "AAPL":
                "Apple designs consumer devices, software and services. Its ecosystem connects iPhone, Mac, iPad and a growing installed base of services customers.",
            "NVDA":
                "NVIDIA builds accelerated computing platforms for data centers, visualization and AI. Its research story spans compute demand, software and the pace of infrastructure investment.",
            "MSFT":
                "Microsoft develops enterprise software, cloud infrastructure and productivity tools. Azure and the Microsoft 365 ecosystem sit at the center of its business.",
        ]
        let isApple = quote.symbol == "AAPL"
        return CompanyDetail(
            quote: quote,
            summary: descriptions[quote.symbol]
                ?? "Explore \(quote.name)'s business, financial performance and the evidence behind its market valuation.",
            metrics: [
                Metric(
                    label: "Market cap", value: quote.marketCap, unit: "money",
                    basis: "Sample snapshot"),
                Metric(
                    label: "P/E ratio", value: isApple ? 34.6 : 38.2, unit: "multiple",
                    basis: "Sample trailing"),
                Metric(
                    label: "Revenue", value: isApple ? 391e9 : 96.3e9, unit: "money",
                    basis: "Sample fiscal year"),
                Metric(
                    label: "Net margin", value: isApple ? 24.0 : 31.4, unit: "percent",
                    basis: "Sample fiscal year"),
                Metric(
                    label: "Revenue growth", value: isApple ? 2.0 : 18.6, unit: "percent",
                    basis: "Sample YoY"),
                Metric(
                    label: "Free cash flow", value: isApple ? 108.8e9 : 28.4e9, unit: "money",
                    basis: "Sample fiscal year"),
            ], articles: articles, notice: "Illustrative financials and price history · Demo data")
    }
}
