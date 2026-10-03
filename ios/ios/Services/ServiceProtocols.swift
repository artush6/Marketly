import Foundation
import UserNotifications

protocol MarketDataService {
    func overview(symbols: [String]) async throws -> MarketSnapshot
    func heatmap(period: MarketPeriod) async throws -> [HeatmapStock]
}

protocol CompanyService {
    func search(query: String) async throws -> [SearchResult]
    func company(symbol: String) async throws -> CompanyDetail
}

protocol NewsService {
    func news(symbol: String?) async throws -> [Article]
    func groupedNews(symbols: [String]) async throws -> [Article]
}

protocol WatchlistService {
    func load() -> [String]
    func save(_ symbols: [String])
}

protocol AssistantService {
    func send(
        messages: [ChatMessage], context: AssistantContext, strategy: ResearchStrategy,
        horizon: InvestmentHorizon, searchWeb: Bool
    ) async throws -> AsyncThrowingStream<AssistantChunk, Error>
}

protocol AuthService {
    var isDevelopment: Bool { get }
    func signInWithGoogle(supabaseURL: URL, publishableKey: String) async throws

    func saveAccessToken(_ token: String) throws
    func signOut() throws
}

struct SessionAuthService: AuthService {
    var isDevelopment: Bool
    let tokens: any TokenStore
    func signInWithGoogle(supabaseURL: URL, publishableKey: String) async throws {
        try await GoogleSignInService(tokens: tokens as? KeychainTokenStore ?? KeychainTokenStore())
            .signIn(projectURL: supabaseURL, publishableKey: publishableKey)
    }

    func saveAccessToken(_ token: String) throws { try tokens.save(token) }

    func signOut() throws { try tokens.clear() }
}

struct LocalWatchlistService: WatchlistService {
    let defaults: UserDefaults
    let key: String
    func load() -> [String] {
        defaults.stringArray(forKey: key) ?? ["AAPL", "MSFT", "NVDA", "GOOGL"]
    }

    func save(_ symbols: [String]) { defaults.set(symbols, forKey: key) }
}

protocol NotificationService { func requestPermission() async throws -> Bool }

struct AppleNotificationService: NotificationService {
    func requestPermission() async throws -> Bool {
        try await UNUserNotificationCenter.current().requestAuthorization(options: [
            .alert, .badge, .sound,
        ])
    }
}

protocol SmallCapService {
    func candidates() async throws -> [SmallCapCandidate]
    func runScan(_ profile: SmallCapScanBody) async throws
}

protocol CalendarService { func earnings(symbols: [String]) async throws -> EarningsCalendar }

protocol AlertService {
    func inbox() async throws -> AlertInbox
    func rules() async throws -> [AlertRule]
    func createRule(_ rule: AlertRuleBody) async throws
    func deleteRule(id: String) async throws
    func markRead(id: String) async throws
}
