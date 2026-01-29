import Testing
@testable import crocbot

@Suite(.serialized)
@MainActor
struct OnboardingCoverageTests {
    @Test func exerciseOnboardingPages() {
        OnboardingView.exerciseForTesting()
    }
}
