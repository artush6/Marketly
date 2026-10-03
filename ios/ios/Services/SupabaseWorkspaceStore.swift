import Foundation

struct WorkspaceSnapshot: Codable {
    let watchlist: [String]
    let saved: [SavedResearchItem]
}

private struct WorkspaceRow: Decodable {
    let value: String?
    let revision: Int
}

private struct WorkspaceWrite: Encodable {
    let user_id: String
    let key: String
    let value: String
    let revision: Int
    let updated_at: String
}

@MainActor final class SupabaseWorkspaceStore {
    private let projectURL: URL
    private let publishableKey: String
    private let sessions: SupabaseSessionManager
    private let key = "marketly.research.v1"
    private var revision = 0

    init(projectURL: URL, publishableKey: String, sessions: SupabaseSessionManager) {
        self.projectURL = projectURL
        self.publishableKey = publishableKey
        self.sessions = sessions
    }

    func load() async throws -> WorkspaceSnapshot? {
        let token = try await requireToken()
        let userID = try Self.userID(from: token)
        var components = URLComponents(
            url: projectURL.appending(path: "/rest/v1/user_research_state"),
            resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "select", value: "value,revision"),
            URLQueryItem(name: "user_id", value: "eq.\(userID)"),
            URLQueryItem(name: "key", value: "eq.\(key)"),
        ]
        var request = URLRequest(url: components.url!)
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.check(response, data: data)
        let rows = try JSONDecoder().decode([WorkspaceRow].self, from: data)
        guard let row = rows.first else {
            revision = 0
            return nil
        }
        revision = row.revision
        guard let value = row.value else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(WorkspaceSnapshot.self, from: Data(value.utf8))
    }

    func save(_ snapshot: WorkspaceSnapshot) async throws {
        let token = try await requireToken()
        let userID = try Self.userID(from: token)
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let value = String(decoding: try encoder.encode(snapshot), as: UTF8.self)
        let record = WorkspaceWrite(
            user_id: userID, key: key, value: value, revision: revision + 1,
            updated_at: ISO8601DateFormatter().string(from: .now))
        let path = "/rest/v1/user_research_state"
        var request: URLRequest
        if revision == 0 {
            request = URLRequest(url: projectURL.appending(path: path))
            request.httpMethod = "POST"
        } else {
            var components = URLComponents(
                url: projectURL.appending(path: path), resolvingAgainstBaseURL: false)!
            components.queryItems = [
                URLQueryItem(name: "user_id", value: "eq.\(userID)"),
                URLQueryItem(name: "key", value: "eq.\(key)"),
                URLQueryItem(name: "revision", value: "eq.\(revision)"),
            ]
            request = URLRequest(url: components.url!)
            request.httpMethod = "PATCH"
        }
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONEncoder().encode(record)
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.check(response, data: data)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.unavailable("Supabase could not save this workspace.")
        }
        let rows = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]]
        guard let rows, !rows.isEmpty else {
            throw APIError.unavailable(
                "This workspace changed on another device. Reload it before editing.")
        }
        revision = record.revision
    }

    private func requireToken() async throws -> String {
        guard let token = try await sessions.accessToken(), !token.isEmpty else {
            throw APIError.unauthorized
        }
        return token
    }

    private static func userID(from token: String) throws -> String {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { throw APIError.unauthorized }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard let data = Data(base64Encoded: payload),
            let claims = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let id = claims["sub"] as? String
        else { throw APIError.unauthorized }
        return id
    }

    private static func check(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.unavailable("Supabase returned an invalid response.")
        }
        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 { throw APIError.unauthorized }
            let message =
                (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["message"]
                as? String
            throw APIError.unavailable(
                message ?? "Supabase workspace is unavailable (\(http.statusCode)).")
        }
    }
}
