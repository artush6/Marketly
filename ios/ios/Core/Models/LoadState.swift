import Foundation
import Observation

@Observable @MainActor final class LoadState<Value> {
    var value: Value?
    var isLoading = false
    var error: String?
    private var requestID = UUID()
    init(value: Value? = nil) { self.value = value }

    func load(_ operation: () async throws -> Value) async {
        let id = UUID()
        requestID = id
        isLoading = true
        error = nil
        do {
            let result = try await operation()
            try Task.checkCancellation()
            if requestID == id { value = result }
        } catch {
            if !Task.isCancelled && requestID == id { self.error = error.localizedDescription }
        }

        if requestID == id { isLoading = false }
    }
}
