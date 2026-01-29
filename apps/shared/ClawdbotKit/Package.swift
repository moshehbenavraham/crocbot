// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "crocbotKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "crocbotProtocol", targets: ["crocbotProtocol"]),
        .library(name: "crocbotKit", targets: ["crocbotKit"]),
        .library(name: "crocbotChatUI", targets: ["crocbotChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "crocbotProtocol",
            path: "Sources/ClawdbotProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "crocbotKit",
            path: "Sources/ClawdbotKit",
            dependencies: [
                "crocbotProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "crocbotChatUI",
            path: "Sources/ClawdbotChatUI",
            dependencies: [
                "crocbotKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "crocbotKitTests",
            dependencies: ["crocbotKit", "crocbotChatUI"],
            path: "Tests/ClawdbotKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
