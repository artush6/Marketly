import SwiftUI

@main struct MarketlyApp: App {
    @State private var app = AppModel()

    var body: some Scene { WindowGroup { RootView().environment(app) } }
}
