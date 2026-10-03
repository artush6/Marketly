import Foundation

struct ScanResult: Decodable { let queued: Bool }
struct CandidateResponse: Decodable { let candidates: [SmallCapCandidate] }
struct RulesResponse: Decodable { let rules: [AlertRule] }
struct RuleResponse: Decodable { let rule: AlertRule? }
struct ReadResponse: Decodable { let read: Bool }
private struct PushRegistrationResponse: Decodable { let saved: Bool }
private struct PushRemovalResponse: Decodable { let deleted: Bool }

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

    func registerDevice(token: String, environment: String) async throws {
        _ = try await client.request(
            Endpoint<PushRegistrationResponse>(
                path: "/notifications/apns-devices", method: .post,
                body: JSONEncoder().encode(
                    APNSDeviceBody(device_token: token, environment: environment))))
    }

    func removeDevice(token: String, environment: String) async throws {
        _ = try await client.request(
            Endpoint<PushRemovalResponse>(
                path: "/notifications/apns-devices", method: .delete,
                body: JSONEncoder().encode(
                    APNSDeviceBody(device_token: token, environment: environment))))
    }

    func sendTest() async throws -> AlertTestResult {
        try await client.request(
            Endpoint<AlertTestResult>(path: "/notifications/test", method: .post))
    }
}

private struct APNSDeviceBody: Encodable {
    let device_token: String
    let environment: String
}
