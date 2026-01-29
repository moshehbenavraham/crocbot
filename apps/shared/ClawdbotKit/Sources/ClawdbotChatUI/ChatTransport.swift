import Foundation

public enum crocbotChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(crocbotChatEventPayload)
    case agent(crocbotAgentEventPayload)
    case seqGap
}

public protocol crocbotChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> crocbotChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [crocbotChatAttachmentPayload]) async throws -> crocbotChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> crocbotChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<crocbotChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension crocbotChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "crocbotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> crocbotChatSessionsListResponse {
        throw NSError(
            domain: "crocbotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
