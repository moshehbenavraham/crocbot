// swift-tools-version: 6.2
// Package manifest for the crocbot macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "crocbot",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "crocbotIPC", targets: ["crocbotIPC"]),
        .library(name: "crocbotDiscovery", targets: ["crocbotDiscovery"]),
        .executable(name: "crocbot", targets: ["crocbot"]),
        .executable(name: "crocbot-mac", targets: ["crocbotMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/ClawdbotKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "crocbotIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "crocbotDiscovery",
            dependencies: [
                .product(name: "crocbotKit", package: "crocbotKit"),
            ],
            path: "Sources/crocbotDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "crocbot",
            dependencies: [
                "crocbotIPC",
                "crocbotDiscovery",
                .product(name: "crocbotKit", package: "crocbotKit"),
                .product(name: "crocbotChatUI", package: "crocbotKit"),
                .product(name: "crocbotProtocol", package: "crocbotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/crocbot.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "crocbotMacCLI",
            dependencies: [
                "crocbotDiscovery",
                .product(name: "crocbotKit", package: "crocbotKit"),
                .product(name: "crocbotProtocol", package: "crocbotKit"),
            ],
            path: "Sources/crocbotMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "crocbotIPCTests",
            dependencies: [
                "crocbotIPC",
                "crocbot",
                "crocbotDiscovery",
                .product(name: "crocbotProtocol", package: "crocbotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
