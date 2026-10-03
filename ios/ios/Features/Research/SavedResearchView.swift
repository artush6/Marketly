import SwiftUI

struct SavedResearchView: View {
    @Environment(AppModel.self) private var app
    @State private var selected: SearchResult?
    @State private var records: [SavedResearchItem] = []

    var body: some View {
        List {
            Section {
                Eyebrow(text: "Your research").padding(.vertical, 8).listRowBackground(
                    MarketTheme.background
                ).listRowSeparator(.hidden)
            }
            if records.isEmpty {
                EmptyState(
                    title: "No saved research yet",
                    message: "Star a company from its research page to save it here.",
                    symbol: "bookmark"
                ).listRowBackground(MarketTheme.background).listRowSeparator(.hidden)
            }
            ForEach(records) { record in
                NavigationLink(value: SearchResult(symbol: record.symbol, name: record.name)) {
                    HStack(spacing: 12) {
                        LogoView(symbol: record.symbol)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(record.symbol).font(.headline)
                            Text(record.name).font(.caption).foregroundStyle(
                                MarketTheme.secondaryText)
                        }
                        Spacer()
                        Text(record.savedAt, style: .date).font(.caption2).foregroundStyle(
                            MarketTheme.tertiaryText)
                    }.padding(.vertical, 6)
                }.swipeActions {
                    Button("Remove", systemImage: "bookmark.slash", role: .destructive) {
                        app.removeResearch(record.symbol)
                        reload()
                    }
                }
            }
        }.listStyle(.plain).scrollContentBackground(.hidden).marketScreen().navigationTitle(
            "Saved research"
        ).onAppear(perform: reload)
    }

    private func reload() { records = app.services.savedResearch.load() }
}
