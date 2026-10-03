import Foundation
import Testing

@testable import ios

@MainActor struct MarketlyTests {
    @Test func treemapPreservesAreaAndDoesNotOverlap() {
        let bounds = CGRect(x: 0, y: 0, width: 350, height: 260)
        let weights = [("A", 55.0), ("B", 25.0), ("C", 12.0), ("D", 8.0)]
        let tiles = TreemapLayout.tiles(weights: weights, in: bounds)
        #expect(tiles.count == 4)
        let area = tiles.reduce(0.0) { $0 + $1.rect.width * $1.rect.height }
        #expect(abs(area - bounds.width * bounds.height) < 0.001)
        for (index, tile) in tiles.enumerated() {
            let expected = weights.first { $0.0 == tile.id }!.1 / 100
            #expect(abs(tile.rect.width * tile.rect.height / area - expected) < 0.0001)
            for other in tiles.dropFirst(index + 1) {
                let overlap = tile.rect.intersection(other.rect)
                #expect(overlap.isNull || overlap.width * overlap.height < 0.001)
            }
        }
    }

    @Test func treemapRejectsInvalidWeights() {
        let tiles = TreemapLayout.tiles(
            weights: [("zero", 0), ("negative", -1), ("nan", .nan), ("valid", 2)],
            in: CGRect(x: 0, y: 0, width: 100, height: 100))
        #expect(tiles.map(\.id) == ["valid"])
    }

    @Test func breadthExcludesMissingChanges() {
        let stocks = [
            HeatmapStock(symbol: "A", name: "A", sector: "Tech", marketCap: 3, changePercent: 2),
            HeatmapStock(symbol: "B", name: "B", sector: "Tech", marketCap: 1, changePercent: -2),
            HeatmapStock(
                symbol: "C", name: "C", sector: "Tech", marketCap: 100, changePercent: nil),
        ]
        let breadth = Breadth(stocks: stocks)
        #expect(breadth.advancing == 1)
        #expect(breadth.declining == 1)
        #expect(breadth.equalWeight == 0)
        #expect(breadth.capWeight == 1)
    }

    @Test func watchlistPersistsAnIntentionallyEmptyList() {
        let suite = "marketly.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = LocalWatchlistService(defaults: defaults, key: "watchlist")
        store.save([])
        #expect(store.load().isEmpty)
        store.save(["NVDA"])
        #expect(store.load() == ["NVDA"])
    }

    @Test func backendURLValidation() throws {
        #expect(try APIClient.validatedURL("https://api.example.com").host == "api.example.com")
        #expect(try APIClient.validatedURL("http://127.0.0.1:8000").port == 8000)
        #expect(throws: APIError.self) { try APIClient.validatedURL("http://api.example.com") }
        #expect(throws: APIError.self) { try APIClient.validatedURL("https://token@example.com") }
    }

    @Test func nullableBackendQuoteIsNotZero() throws {
        let data = Data(#"{"symbol":"AAPL","price":null,"changePercent":null}"#.utf8)
        let quote = try JSONDecoder().decode(QuoteDTO.self, from: data).model()
        #expect(quote.price == nil)
        #expect(quote.changePercent == nil)
        #expect(MarketFormat.price(quote.price) == "—")
    }

    @Test func appAlwaysUsesLiveServices() throws {
        let app = AppModel(preview: true)
        let initialGeneration = app.generation
        app.toggleWatchlist("NVDA")
        try app.configure(
            baseURL: "https://api.example.com", token: "",
            supabaseURL: "https://marketly.supabase.co", publishableKey: "test-key")
        #expect(app.generation != initialGeneration)
        #expect(app.services.market is LiveServices)
        #expect(app.watchlist.contains("NVDA"))
    }
}
