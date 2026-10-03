import SwiftUI

enum PlannedFeature: String, CaseIterable, Identifiable {
    case smallCap = "Small CAP"
    case calendar = "Calendar"
    case alerts = "Alerts"
    case research = "Saved research"
    case compare = "Compare"
    case portfolio = "Portfolio"
    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .smallCap: "chart.bar.xaxis"
        case .calendar: "calendar"
        case .alerts: "bell"
        case .research: "bookmark"
        case .compare: "rectangle.split.2x1"
        case .portfolio: "briefcase"
        }
    }
}

struct MoreView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        List {
            Section {
                HStack {
                    Wordmark()
                    Spacer()
                    ModeLabel()
                }.padding(.vertical, 14)
            }.listRowBackground(MarketTheme.background)
            Section("Workspace") {
                NavigationLink(destination: CalendarView()) {
                    Label("Calendar", systemImage: "calendar").padding(.vertical, 6)
                }
                NavigationLink(destination: AlertsView()) {
                    Label("Alerts", systemImage: "bell").padding(.vertical, 6)
                }
                NavigationLink(destination: SavedResearchView()) {
                    Label("Saved research", systemImage: "bookmark").padding(.vertical, 6)
                }
                NavigationLink(destination: CompareView()) {
                    Label("Compare companies", systemImage: "rectangle.split.2x1").padding(
                        .vertical, 6)
                }
                NavigationLink(destination: PortfolioView()) {
                    Label("Portfolio", systemImage: "briefcase").padding(.vertical, 6)
                }
            }.listRowBackground(MarketTheme.surface)
            Section {
                Button {
                    app.settingsPresented = true
                } label: {
                    Label("Settings", systemImage: "gearshape").padding(.vertical, 6)
                }
                Button {
                    app.ask()
                } label: {
                    Label("Marketly assistant", systemImage: "sparkles").padding(.vertical, 6)
                }
            }.listRowBackground(MarketTheme.surface)
        }.scrollContentBackground(.hidden).marketScreen().navigationTitle("Your workspace")
    }
}

struct PortfolioView: View {
    var body: some View {
        EmptyState(
            title: "Portfolio",
            message:
                "A native portfolio screen needs an authenticated positions model. This first native iteration has no portfolio API.",
            symbol: "briefcase"
        ).marketScreen().navigationTitle("Portfolio")
    }
}
