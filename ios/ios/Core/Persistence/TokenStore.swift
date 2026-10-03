import Foundation
import Security

protocol TokenStore {
    func read() throws -> String?
    func save(_ token: String) throws
    func clear() throws
}

struct KeychainTokenStore: TokenStore {
    private let service = "com.marketly.native.session"
    private var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
            kSecAttrAccount as String: "access-token",
        ]
    }

    func read() throws -> String? {
        var lookup = query
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(lookup as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }

        guard status == errSecSuccess, let data = result as? Data else {
            throw KeychainError(status: status)
        }

        return String(data: data, encoding: .utf8)
    }

    func save(_ token: String) throws { try write(token, account: "access-token") }

    func clear() throws {
        var allTokens = query
        allTokens.removeValue(forKey: kSecAttrAccount as String)
        let status = SecItemDelete(allTokens as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError(status: status)
        }
    }

    func saveSession(accessToken: String, refreshToken: String, expiresIn: Int) throws {
        try write(accessToken, account: "access-token")
        try write(refreshToken, account: "refresh-token")
        try write(
            String(Date().addingTimeInterval(TimeInterval(expiresIn)).timeIntervalSince1970),
            account: "expires-at")
    }

    func readRefreshToken() throws -> String? { try read(account: "refresh-token") }

    func readExpiry() throws -> Date? {
        guard let value = try read(account: "expires-at"), let timestamp = Double(value) else {
            return nil
        }
        return Date(timeIntervalSince1970: timestamp)
    }

    private func read(account: String) throws -> String? {
        var lookup = query
        lookup[kSecAttrAccount as String] = account
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(lookup as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw KeychainError(status: status)
        }
        return String(data: data, encoding: .utf8)
    }

    private func write(_ value: String, account: String) throws {
        var item = query
        item[kSecAttrAccount as String] = account
        let update = [kSecValueData as String: Data(value.utf8)]
        let status = SecItemUpdate(item as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var insert = item.merging(update) { _, new in new }
            insert[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            let inserted = SecItemAdd(insert as CFDictionary, nil)
            guard inserted == errSecSuccess else { throw KeychainError(status: inserted) }
        } else if status != errSecSuccess {
            throw KeychainError(status: status)
        }
    }

    struct KeychainError: LocalizedError {
        let status: OSStatus
        var errorDescription: String? { "Secure session storage is unavailable (\(status))." }
    }
}
