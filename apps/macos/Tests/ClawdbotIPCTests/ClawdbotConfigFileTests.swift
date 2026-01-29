import Foundation
import Testing
@testable import crocbot

@Suite(.serialized)
struct crocbotConfigFileTests {
    @Test
    func configPathRespectsEnvOverride() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("crocbot-config-\(UUID().uuidString)")
            .appendingPathComponent("crocbot.json")
            .path

        await TestIsolation.withEnvValues(["CLAWDBOT_CONFIG_PATH": override]) {
            #expect(crocbotConfigFile.url().path == override)
        }
    }

    @MainActor
    @Test
    func remoteGatewayPortParsesAndMatchesHost() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("crocbot-config-\(UUID().uuidString)")
            .appendingPathComponent("crocbot.json")
            .path

        await TestIsolation.withEnvValues(["CLAWDBOT_CONFIG_PATH": override]) {
            crocbotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "ws://gateway.ts.net:19999",
                    ],
                ],
            ])
            #expect(crocbotConfigFile.remoteGatewayPort() == 19999)
            #expect(crocbotConfigFile.remoteGatewayPort(matchingHost: "gateway.ts.net") == 19999)
            #expect(crocbotConfigFile.remoteGatewayPort(matchingHost: "gateway") == 19999)
            #expect(crocbotConfigFile.remoteGatewayPort(matchingHost: "other.ts.net") == nil)
        }
    }

    @MainActor
    @Test
    func setRemoteGatewayUrlPreservesScheme() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("crocbot-config-\(UUID().uuidString)")
            .appendingPathComponent("crocbot.json")
            .path

        await TestIsolation.withEnvValues(["CLAWDBOT_CONFIG_PATH": override]) {
            crocbotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "wss://old-host:111",
                    ],
                ],
            ])
            crocbotConfigFile.setRemoteGatewayUrl(host: "new-host", port: 2222)
            let root = crocbotConfigFile.loadDict()
            let url = ((root["gateway"] as? [String: Any])?["remote"] as? [String: Any])?["url"] as? String
            #expect(url == "wss://new-host:2222")
        }
    }

    @Test
    func stateDirOverrideSetsConfigPath() async {
        let dir = FileManager().temporaryDirectory
            .appendingPathComponent("crocbot-state-\(UUID().uuidString)", isDirectory: true)
            .path

        await TestIsolation.withEnvValues([
            "CLAWDBOT_CONFIG_PATH": nil,
            "CLAWDBOT_STATE_DIR": dir,
        ]) {
            #expect(crocbotConfigFile.stateDirURL().path == dir)
            #expect(crocbotConfigFile.url().path == "\(dir)/crocbot.json")
        }
    }
}
