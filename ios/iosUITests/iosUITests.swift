import XCTest

final class MarketlyUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor func testMarketsSearchCompanyAssistant() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()

        let search = app.buttons["market-search"]
        XCTAssertTrue(search.waitForExistence(timeout: 15))
        saveScreenshot("01 Markets", app: app)
        search.tap()

        let input = app.searchFields.firstMatch
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        input.tap()
        input.typeText("AAPL")
        let result = app.buttons["search-result-AAPL"]
        XCTAssertTrue(result.waitForExistence(timeout: 8))
        result.tap()

        XCTAssertTrue(app.navigationBars["AAPL"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Apple"].waitForExistence(timeout: 8))
        saveScreenshot("02 Company", app: app)
        app.buttons["ask-ai"].tap()
        XCTAssertTrue(app.navigationBars["Marketly assistant"].waitForExistence(timeout: 5))
        saveScreenshot("03 Assistant sheet", app: app)

        let prompt = app.textFields["assistant-input"]
        XCTAssertTrue(prompt.waitForExistence(timeout: 5))
        prompt.tap()
        prompt.typeText("What drives Apple's revenue?")
        app.buttons["assistant-send"].tap()
        let answer = app.staticTexts["assistant-response"].firstMatch
        XCTAssertTrue(answer.waitForExistence(timeout: 10))
        saveScreenshot("04 Assistant conversation", app: app)
        app.buttons["assistant-done"].tap()
        XCTAssertTrue(app.navigationBars["AAPL"].waitForExistence(timeout: 5))
    }

    @MainActor func testNewsWatchlistAndLiveError() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        app.tabBars.buttons["News"].tap()
        XCTAssertTrue(app.staticTexts["Beyond the ticker."].waitForExistence(timeout: 8))
        saveScreenshot("05 News", app: app)
        app.tabBars.buttons["Watchlist"].tap()
        XCTAssertTrue(app.staticTexts["AAPL"].waitForExistence(timeout: 8))
        saveScreenshot("06 Watchlist", app: app)

        app.tabBars.buttons["More"].tap()
        app.buttons["Settings"].tap()
        XCTAssertTrue(app.buttons["Live"].waitForExistence(timeout: 5))
        app.buttons["Live"].tap()
        let url = app.textFields["backend-url"]
        XCTAssertTrue(url.waitForExistence(timeout: 5))
        url.tap()
        url.press(forDuration: 1.2)
        if app.menuItems["Select All"].waitForExistence(timeout: 2) {
            app.menuItems["Select All"].tap()
            url.typeText("http://127.0.0.1:1")
        }
        app.buttons["apply-connection"].tap()
        app.tabBars.buttons["Markets"].tap()
        XCTAssertTrue(app.staticTexts["Unable to load"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["$573.76"].exists)
        saveScreenshot("07 Live connection error", app: app)
    }

    @MainActor private func saveScreenshot(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
