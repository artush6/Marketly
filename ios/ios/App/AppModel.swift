import Observation
import SwiftUI

enum ServiceMode: String, CaseIterable, Identifiable {
    case demo = "Demo"
    case live = "Live"
    var id: String { rawValue }
}

struct Services {
    let market: any MarketDataService
    let company: any CompanyService
    let news: any NewsService
    let assistant: any AssistantService
    let watchlist: any WatchlistService
    let auth: any AuthService
    let smallCaps: any SmallCapService
    let calendar: any CalendarService
    let alerts: any AlertService
    let savedResearch: LocalResearchService
    let workspace: SupabaseWorkspaceStore?
    static func make(
        mode: ServiceMode, url: URL, defaults: UserDefaults, supabaseURL: URL?,
        publishableKey: String
    ) -> Services {
        let local = LocalWatchlistService(
            defaults: defaults, key: "marketly.watchlist.\(mode.rawValue)")
        let saved = LocalResearchService(
            defaults: defaults, key: "marketly.saved-research.\(mode.rawValue)")
        if mode == .demo {
            let demo = DemoServices()
            let research = DemoResearchServices()
            return Services(
                market: demo, company: demo, news: demo, assistant: demo, watchlist: local,
                auth: SessionAuthService(isDevelopment: true, tokens: DevelopmentTokenStore()),
                smallCaps: research, calendar: research, alerts: research, savedResearch: saved,
                workspace: nil)
        }

        let tokens = KeychainTokenStore()
        let sessionManager = supabaseURL.map {
            SupabaseSessionManager(projectURL: $0, publishableKey: publishableKey, tokens: tokens)
        }
        let live = LiveServices(
            client: APIClient(baseURL: url, tokenStore: tokens, authSession: sessionManager))
        return Services(
            market: live, company: live, news: live, assistant: live, watchlist: local,
            auth: SessionAuthService(isDevelopment: false, tokens: tokens), smallCaps: live,
            calendar: live, alerts: live, savedResearch: saved,
            workspace: supabaseURL.flatMap { projectURL in
                guard let sessionManager else { return nil }
                return SupabaseWorkspaceStore(
                    projectURL: projectURL, publishableKey: publishableKey, sessions: sessionManager
                )
            })
    }
}

@Observable @MainActor final class AppModel {
    var mode: ServiceMode
    var baseURL: String
    var supabaseURL: String
    var publishableKey: String
    var authenticated = false
    var alertRulePresented = false
    var services: Services
    var generation = UUID()
    var watchlist: [String]
    var recentSearches: [SearchResult] = []
    var selectedTab = 0
    var assistantContext: AssistantContext?
    var settingsPresented = false
    private let defaults: UserDefaults
    init(preview: Bool = false) {
        let testing = ProcessInfo.processInfo.arguments.contains("--ui-testing")
        defaults =
            preview || testing
            ? UserDefaults(suiteName: "marketly.\(UUID().uuidString)")! : .standard

        let storedMode = defaults.string(forKey: "marketly.mode")
        let defaultMode: ServiceMode = testing ? .demo : .live
        let configuredMode = storedMode.flatMap(ServiceMode.init(rawValue:)) ?? defaultMode
        let configuredBackendURL =
            defaults.string(forKey: "marketly.backend") ?? AppConfig.backendURL
        let configuredSupabaseURL =
            defaults.string(forKey: "marketly.supabase-url") ?? AppConfig.supabaseURL
        let configuredPublishableKey =
            defaults.string(forKey: "marketly.supabase-key") ?? AppConfig.publishableKey
        mode = configuredMode
        baseURL = configuredBackendURL
        supabaseURL = configuredSupabaseURL
        publishableKey = configuredPublishableKey
        authenticated = ((try? KeychainTokenStore().read()) ?? nil) != nil

        let backend =
            (try? APIClient.validatedURL(configuredBackendURL)) ?? URL(
                string: "https://marketly-sxn7.onrender.com")!
        let authURL = try? APIClient.validatedURL(configuredSupabaseURL)
        let initialServices = Services.make(
            mode: configuredMode, url: backend, defaults: defaults, supabaseURL: authURL,
            publishableKey: configuredPublishableKey)
        services = initialServices
        watchlist = initialServices.watchlist.load()

        if let data = defaults.data(forKey: "marketly.recents"),
            let items = try? JSONDecoder().decode([SearchResult].self, from: data)
        {
            recentSearches = items
        }

        if authenticated { Task { await hydrateWorkspace() } }
    }

    func configure(
        mode: ServiceMode, baseURL: String, token: String, supabaseURL: String,
        publishableKey: String
    ) throws {
        let url = try APIClient.validatedURL(baseURL)
        if mode == .live, !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            try KeychainTokenStore().save(token.trimmingCharacters(in: .whitespacesAndNewlines))
        }

        let authURL = supabaseURL.isEmpty ? nil : try APIClient.validatedURL(supabaseURL)
        guard mode == .demo || (authURL != nil && !publishableKey.isEmpty) else {
            throw APIError.unavailable(
                "Add the Supabase project URL and publishable key in Settings before continuing.")
        }
        self.mode = mode
        self.baseURL = baseURL
        self.supabaseURL = supabaseURL
        self.publishableKey = publishableKey
        defaults.set(mode.rawValue, forKey: "marketly.mode")
        defaults.set(baseURL, forKey: "marketly.backend")
        defaults.set(supabaseURL, forKey: "marketly.supabase-url")
        defaults.set(publishableKey, forKey: "marketly.supabase-key")
        services = Services.make(
            mode: mode, url: url, defaults: defaults, supabaseURL: authURL,
            publishableKey: publishableKey)
        watchlist = services.watchlist.load()
        authenticated = ((try? KeychainTokenStore().read()) ?? nil) != nil
        assistantContext = nil
        generation = UUID()
    }

    func signInWithGoogle() async throws {
        guard let url = try? APIClient.validatedURL(supabaseURL), !publishableKey.isEmpty else {
            throw APIError.unavailable(
                "Add the Supabase project URL and publishable key in Settings.")
        }
        try await services.auth.signInWithGoogle(supabaseURL: url, publishableKey: publishableKey)
        authenticated = true
        await hydrateWorkspace()
        generation = UUID()
    }

    func signOut() throws {
        try services.auth.signOut()
        authenticated = false
        generation = UUID()
    }

    func saveResearch(_ quote: Quote) {
        services.savedResearch.save(
            SavedResearchItem(symbol: quote.symbol, name: quote.name, savedAt: .now))
        Task { await syncWorkspace() }
    }

    func removeResearch(_ symbol: String) {
        services.savedResearch.remove(symbol: symbol)
        Task { await syncWorkspace() }
    }

    func toggleWatchlist(_ symbol: String) {
        if watchlist.contains(symbol) {
            watchlist.removeAll { $0 == symbol }
        } else {
            watchlist.append(symbol)
        }

        services.watchlist.save(watchlist)
        Task { await syncWorkspace() }
    }

    private func syncWorkspace() async {
        guard authenticated, let workspace = services.workspace else { return }
        do {
            try await workspace.save(
                WorkspaceSnapshot(watchlist: watchlist, saved: services.savedResearch.load()))
        } catch {
            defaults.set(error.localizedDescription, forKey: "marketly.workspace-sync-error")
        }
    }

    private func hydrateWorkspace() async {
        guard authenticated, let workspace = services.workspace else { return }
        do {
            guard let snapshot = try await workspace.load() else {
                await syncWorkspace()
                return
            }
            watchlist = snapshot.watchlist
            services.watchlist.save(snapshot.watchlist)
            services.savedResearch.replace(with: snapshot.saved)
            defaults.removeObject(forKey: "marketly.workspace-sync-error")
        } catch {
            defaults.set(error.localizedDescription, forKey: "marketly.workspace-sync-error")
        }
    }

    func remember(_ result: SearchResult) {
        recentSearches.removeAll { $0.symbol == result.symbol }

        recentSearches.insert(result, at: 0)
        recentSearches = Array(recentSearches.prefix(8))
        defaults.set(try? JSONEncoder().encode(recentSearches), forKey: "marketly.recents")
    }

    func clearRecents() {
        recentSearches = []
        defaults.removeObject(forKey: "marketly.recents")
    }

    func ask(_ context: AssistantContext? = nil) { assistantContext = context ?? .market }
}
