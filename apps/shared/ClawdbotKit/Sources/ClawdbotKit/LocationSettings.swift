import Foundation

public enum crocbotLocationMode: String, Codable, Sendable, CaseIterable {
    case off
    case whileUsing
    case always
}
