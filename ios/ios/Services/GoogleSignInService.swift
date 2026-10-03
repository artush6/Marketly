import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

struct SupabaseSession: Decodable {
    let access_token: String
    let refresh_token: String
    let expires_in: Int
    let token_type: String
}

@MainActor
final class GoogleSignInService: NSObject, ASWebAuthenticationPresentationContextProviding {
    private let tokens: KeychainTokenStore
    private var webSession: ASWebAuthenticationSession?

    init(tokens: KeychainTokenStore? = nil) { self.tokens = tokens ?? KeychainTokenStore() }

    func signIn(projectURL: URL, publishableKey: String) async throws {
        let verifier = Self.randomVerifier()
        let challenge = Self.challenge(for: verifier)
        let redirect = "marketly://auth/callback"
        var components = URLComponents(
            url: projectURL.appending(path: "/auth/v1/authorize"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: redirect),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "s256"),
            URLQueryItem(name: "apikey", value: publishableKey),
        ]
        guard let url = components?.url else { throw APIError.invalidURL }
        let callbackURL = try await authenticate(url: url)
        guard
            let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?.queryItems?
                .first(where: { $0.name == "code" })?.value
        else {
            throw APIError.unavailable(
                "Google sign-in was cancelled or returned an invalid response.")
        }

        var request = URLRequest(url: projectURL.appending(path: "/auth/v1/token"))
        var tokenComponents = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
        tokenComponents?.queryItems = [URLQueryItem(name: "grant_type", value: "pkce")]
        request.url = tokenComponents?.url
        request.httpMethod = "POST"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "auth_code": code, "code_verifier": verifier,
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.unavailable(
                "Supabase could not finish the Google sign-in. Check the OAuth provider and callback URL settings."
            )
        }
        let session = try JSONDecoder().decode(SupabaseSession.self, from: data)
        try tokens.saveSession(
            accessToken: session.access_token, refreshToken: session.refresh_token,
            expiresIn: session.expires_in)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? UIWindow()
    }

    private func authenticate(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "marketly") {
                callback, error in
                self.webSession = nil
                if let error {
                    continuation.resume(throwing: error)
                } else if let callback {
                    continuation.resume(returning: callback)
                } else {
                    continuation.resume(throwing: APIError.unauthorized)
                }
            }
            webSession = session
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            guard session.start() else {
                continuation.resume(
                    throwing: APIError.unavailable(
                        "Google sign-in could not open a secure browser session."))
                return
            }
        }
    }

    private static func randomVerifier() -> String {
        let bytes = (0..<32).map { _ in UInt8.random(in: 0...255) }
        return Data(bytes).base64URLEncodedString()
    }

    private static func challenge(for verifier: String) -> String {
        Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncodedString()
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(
            of: "/", with: "_"
        ).replacingOccurrences(of: "=", with: "")
    }
}

@MainActor final class SupabaseSessionManager {
    let projectURL: URL
    let publishableKey: String
    let tokens: KeychainTokenStore

    init(projectURL: URL, publishableKey: String, tokens: KeychainTokenStore) {
        self.projectURL = projectURL
        self.publishableKey = publishableKey
        self.tokens = tokens
    }

    func accessToken(forceRefresh: Bool = false) async throws -> String? {
        guard let current = try tokens.read() else { return nil }
        if !forceRefresh, let expiry = try tokens.readExpiry(), expiry.timeIntervalSinceNow > 60 {
            return current
        }
        guard let refreshToken = try tokens.readRefreshToken() else { return current }
        var request = URLRequest(
            url: projectURL.appending(path: "/auth/v1/token?grant_type=refresh_token"))
        request.httpMethod = "POST"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "refresh_token": refreshToken
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            try tokens.clear()
            throw APIError.unauthorized
        }
        let refreshed = try JSONDecoder().decode(SupabaseSession.self, from: data)
        try tokens.saveSession(
            accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token,
            expiresIn: refreshed.expires_in)
        return refreshed.access_token
    }
}
