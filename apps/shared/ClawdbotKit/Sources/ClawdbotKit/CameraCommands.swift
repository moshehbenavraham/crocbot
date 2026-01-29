import Foundation

public enum crocbotCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum crocbotCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum crocbotCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum crocbotCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct crocbotCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: crocbotCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: crocbotCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: crocbotCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: crocbotCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct crocbotCameraClipParams: Codable, Sendable, Equatable {
    public var facing: crocbotCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: crocbotCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: crocbotCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: crocbotCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
