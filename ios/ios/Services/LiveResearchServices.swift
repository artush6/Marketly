import Foundation

struct ScanResult: Decodable { let queued: Bool }
struct CandidateResponse: Decodable { let candidates: [SmallCapCandidate] }
struct RulesResponse: Decodable { let rules: [AlertRule] }
struct RuleResponse: Decodable { let rule: AlertRule? }
struct ReadResponse: Decodable { let read: Bool }

extension LiveServices: SmallCapService {
    func candidates() async throws -> [SmallCapCandidate] {
        try await client.request(Endpoint<CandidateResponse>(path: "/discovery/small-caps"))
            .candidates
    }

    func runScan(_ profile: SmallCapScanBody) async throws {
        let response = try await client.request(
            Endpoint<ScanResult>(
                path: "/discovery/small-caps/scan", method: .post,
                body: JSONEncoder().encode(profile)))
        guard response.queued else {
            throw APIError.unavailable("The small-cap scan could not be queued.")
        }
    }
}

extension LiveServices: CalendarService {
    func earnings(symbols: [String]) async throws -> EarningsCalendar {
        try await client.request(
            Endpoint<EarningsCalendar>(
                path: "/market/earnings",
                query: [.init(name: "symbols", value: symbols.joined(separator: ","))]))
    }
}

extension LiveServices: AlertService {
    func inbox() async throws -> AlertInbox {
        try await client.request(Endpoint<AlertInbox>(path: "/notifications"))
    }

    func rules() async throws -> [AlertRule] {
        try await client.request(Endpoint<RulesResponse>(path: "/notifications/rules")).rules
    }

    func createRule(_ rule: AlertRuleBody) async throws {
        _ = try await client.request(
            Endpoint<RuleResponse>(
                path: "/notifications/rules", method: .post, body: JSONEncoder().encode(rule)))
    }

    func deleteRule(id: String) async throws {
        _ = try await client.request(
            Endpoint<ReadResponse>(path: "/notifications/rules/\(id)", method: .delete))
    }

    func markRead(id: String) async throws {
        _ = try await client.request(
            Endpoint<ReadResponse>(path: "/notifications/\(id)/read", method: .patch))
    }
}

struct DemoResearchServices: SmallCapService, CalendarService, AlertService {
    func candidates() async throws -> [SmallCapCandidate] {
        try await Task.sleep(for: .milliseconds(220))
        return [
            SmallCapCandidate(
                symbol: "PLAB", name: "Photronics", sector: "Technology", marketCap: 1.48e9,
                potentialScore: 76, riskScore: 32, evidenceCoverage: 0.82, probability: 0.58,
                summary: "Illustrative sample based on a fictionalized static fixture."),
            SmallCapCandidate(
                symbol: "HURN", name: "Huron Consulting", sector: "Industrials", marketCap: 1.92e9,
                potentialScore: 69, riskScore: 37, evidenceCoverage: 0.71, probability: 0.54,
                summary: "Illustrative sample based on a fictionalized static fixture."),
        ]
    }

    func runScan(_ profile: SmallCapScanBody) async throws {
        throw APIError.unavailable(
            "Scanning needs the live Marketly service and an authenticated account.")
    }

    func earnings(symbols: [String]) async throws -> EarningsCalendar {
        try await Task.sleep(for: .milliseconds(200))
        return EarningsCalendar(
            events: [], pendingSymbols: symbols,
            note: "Sample calendar. Connect to live Marketly to load announced dates.")
    }

    func inbox() async throws -> AlertInbox {
        try await Task.sleep(for: .milliseconds(200))
        return AlertInbox(
            notifications: [], preferences: nil, followedSymbols: [], ruleSymbols: [],
            deviceCount: 0, pushConfigured: false)
    }

    func rules() async throws -> [AlertRule] { [] }
    func createRule(_ rule: AlertRuleBody) async throws { throw APIError.unauthorized }
    func deleteRule(id: String) async throws { throw APIError.unauthorized }
    func markRead(id: String) async throws { throw APIError.unauthorized }
}
