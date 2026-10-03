import Foundation
import Observation

@Observable @MainActor final class AssistantViewModel {
    var messages: [ChatMessage] = []
    var sources: [AssistantSource] = []
    var prompt = ""
    var strategy = ResearchStrategy.balanced
    var horizon = InvestmentHorizon.medium
    var searchWeb = false
    var isSending = false
    var error: String?
    private var requestTask: Task<Void, Never>?

    func send(context: AssistantContext, service: any AssistantService) {
        let question = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, question.count <= 3_500, !isSending else { return }

        prompt = ""
        error = nil
        sources = []
        messages.append(ChatMessage(role: .user, content: question))
        let conversation = messages
        let answer = ChatMessage(role: .assistant, content: "")
        messages.append(answer)
        isSending = true

        requestTask = Task {
            defer { isSending = false }

            do {
                let stream = try await service.send(
                    messages: conversation, context: context, strategy: strategy, horizon: horizon,
                    searchWeb: searchWeb)
                for try await chunk in stream {
                    try Task.checkCancellation()
                    switch chunk {
                    case .text(let text):
                        if let index = messages.firstIndex(where: { $0.id == answer.id }) {
                            messages[index].content += text
                        }

                    case .sources(let references): sources = references
                    }
                }
            } catch {
                if !Task.isCancelled {
                    self.error = error.localizedDescription
                    // Keep the question available to retry after a transport failure.
                    prompt = question
                }

                messages.removeAll { $0.id == answer.id && $0.content.isEmpty }
            }
        }
    }

    func cancel() {
        requestTask?.cancel()
        requestTask = nil
    }
}
