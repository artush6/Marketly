import SwiftUI

struct CalendarView: View {
    @Environment(AppModel.self) private var app
    @State private var state = LoadState<EarningsCalendar>()
    @State private var month = Calendar.current.dateInterval(of: .month, for: .now)?.start ?? .now
    @State private var filter = "All"

    private var symbols: [String] { filter == "All" ? app.watchlist : [filter] }
    private var monthEvents: [EarningsEvent] {
        (state.value?.events ?? []).filter { event in
            guard let date = Self.date(event.date) else { return false }
            return Calendar.current.isDate(date, equalTo: month, toGranularity: .month)
        }.sorted { $0.date < $1.date }
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 9) {
                    Eyebrow(text: "Company events")
                    Text("Earnings calendar").font(.largeTitle.weight(.semibold))
                    Text("Provider dates can move. Check the original release before acting.").font(
                        .caption
                    ).foregroundStyle(MarketTheme.secondaryText)
                }.padding(.vertical, 10)
            }.listRowBackground(MarketTheme.background).listRowSeparator(.hidden)

            Section {
                HStack(spacing: 12) {
                    Button {
                        month =
                            Calendar.current.date(byAdding: .month, value: -1, to: month) ?? month
                    } label: {
                        Image(systemName: "chevron.left").frame(width: 44, height: 44)
                    }.accessibilityLabel("Previous month")
                    Spacer()
                    Text(month.formatted(.dateTime.month(.wide).year())).font(.headline)
                    Spacer()
                    Button {
                        month =
                            Calendar.current.date(byAdding: .month, value: 1, to: month) ?? month
                    } label: {
                        Image(systemName: "chevron.right").frame(width: 44, height: 44)
                    }.accessibilityLabel("Next month")
                }
                Menu {
                    Button("Entire watchlist") { filter = "All" }
                    ForEach(app.watchlist, id: \.self) { symbol in
                        Button(symbol) { filter = symbol }
                    }
                } label: {
                    Label(
                        filter == "All" ? "Entire watchlist" : filter,
                        systemImage: "line.3.horizontal.decrease")
                }
            }.listRowBackground(MarketTheme.surface)

            if let error = state.error {
                FailureState(message: error) { Task { await refresh() } }.listRowBackground(
                    MarketTheme.background
                ).listRowSeparator(.hidden)
            } else if state.isLoading && state.value == nil {
                LoadingRows().listRowBackground(MarketTheme.background)
            } else if monthEvents.isEmpty {
                EmptyState(
                    title: "No watchlist earnings this month",
                    message: state.value?.pendingSymbols.isEmpty == false
                        ? "Marketly is still collecting dates for some tickers. Pull to refresh later."
                        : state.value?.note
                            ?? "Only announced or estimated earnings dates are shown.",
                    symbol: "calendar"
                ).listRowBackground(MarketTheme.background).listRowSeparator(.hidden)
            }

            ForEach(monthEvents) { event in
                HStack(spacing: 14) {
                    VStack(spacing: 2) {
                        Text(
                            Self.date(event.date)?.formatted(.dateTime.month(.abbreviated).day())
                                ?? "—"
                        ).font(.caption.weight(.semibold).monospacedDigit())
                        Text("EST.").font(.system(size: 8)).foregroundStyle(
                            MarketTheme.tertiaryText)
                    }.frame(width: 50, height: 48).background(
                        MarketTheme.elevatedSurface, in: RoundedRectangle(cornerRadius: 10))
                    LogoView(symbol: event.symbol, size: 40)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(event.symbol).font(.headline)
                        Text(
                            "\(event.quarter.map { "Q\($0) " } ?? "")\(event.year.map(String.init) ?? "") earnings · \(event.hour ?? "Time not supplied")"
                        ).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                    }
                    Spacer()
                    if let estimate = event.estimate {
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(estimate.formatted(.number.precision(.fractionLength(2))))
                            Text("EPS estimate").font(.system(size: 9)).foregroundStyle(
                                MarketTheme.tertiaryText)
                        }.font(.caption.monospacedDigit())
                    }
                }.padding(.vertical, 6).listRowBackground(MarketTheme.surface)
            }
            if let note = state.value?.note {
                Text(note).font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
                    .listRowBackground(MarketTheme.background).listRowSeparator(.hidden)
            }
        }.listStyle(.plain).scrollContentBackground(.hidden).marketScreen().navigationTitle(
            "Calendar"
        ).navigationBarTitleDisplayMode(.inline).task(id: "\(app.watchlist.joined())-\(month)") {
            await refresh()
        }.refreshable { await refresh() }
    }

    private func refresh() async {
        await state.load { try await app.services.calendar.earnings(symbols: symbols) }
    }

    private static func date(_ string: String) -> Date? {
        let format = Date.ISO8601FormatStyle().year().month().day().time(
            includingFractionalSeconds: false)
        return try? format.parse(string)
    }
}
