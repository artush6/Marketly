import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case delete = "DELETE"
}

struct Endpoint<Response: Decodable> {
    let path: String
    var method: HTTPMethod = .get
    var query: [URLQueryItem] = []
    var body: Data?
}

enum APIError: LocalizedError {
    case invalidURL, unauthorized
    case http(Int, String)
    case decoding
    case unavailable(String)
    var errorDescription: String? {
        switch self {
        case .invalidURL: "Enter a valid HTTPS backend URL in Settings."
        case .unauthorized:
            "Your session is missing or expired. Update your access token in Settings."
        case let .http(status, message): "\(message) (\(status))"
        case .decoding: "Marketly received an unexpected response. Please try again."
        case let .unavailable(message): message
        }
    }
}

/// URLSession propagates task cancellation. Only idempotent GETs retry once on 502/503/504.
struct APIClient {
    let baseURL: URL
    let tokenStore: any TokenStore
    var session: URLSession = .shared
    var authSession: SupabaseSessionManager? = nil
    private struct Detail: Decodable { let detail: String? }

    func request<T>(_ endpoint: Endpoint<T>) async throws -> T {
        guard var url = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }

        let basePath = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        url.path = basePath.isEmpty ? endpoint.path : "/" + basePath + endpoint.path
        url.queryItems = endpoint.query.isEmpty ? nil : endpoint.query
        guard let target = url.url else { throw APIError.invalidURL }

        for attempt in 0...1 {
            var request = URLRequest(url: target)
            request.httpMethod = endpoint.method.rawValue
            request.httpBody = endpoint.body
            request.timeoutInterval = endpoint.method == .post ? 120 : 45
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            if endpoint.body != nil {
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            }
            let token = try await authSession?.accessToken() ?? tokenStore.read()
            if let token, !token.isEmpty {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            try Task.checkCancellation()
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.http(0, "Invalid server response")
            }

            if http.statusCode == 401, attempt == 0, let authSession {
                _ = try await authSession.accessToken(forceRefresh: true)
                continue
            }
            if http.statusCode == 401 || http.statusCode == 403 { throw APIError.unauthorized }
            if [502, 503, 504].contains(http.statusCode), endpoint.method == .get, attempt == 0 {
                try await Task.sleep(for: .milliseconds(400))
                continue
            }

            guard (200...299).contains(http.statusCode) else {
                let message =
                    (try? JSONDecoder().decode(Detail.self, from: data).detail)
                    ?? "Request failed. Please retry."
                throw APIError.http(http.statusCode, message)
            }

            do { return try JSONDecoder().decode(T.self, from: data) } catch {
                throw APIError.decoding
            }
        }
        throw APIError.unavailable("The service is temporarily unavailable.")
    }
    static func validatedURL(_ text: String) throws -> URL {
        guard let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
            let host = url.host, !host.isEmpty, url.user == nil, url.password == nil,
            url.query == nil, url.fragment == nil,
            url.scheme == "https"
                || (url.scheme == "http" && ["localhost", "127.0.0.1"].contains(host))
        else { throw APIError.invalidURL }

        return url
    }
}
