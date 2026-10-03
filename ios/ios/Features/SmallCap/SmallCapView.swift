import SwiftUI

struct SmallCapView: View {
    @Environment(AppModel.self) private var app
    @State private var state = LoadState<[SmallCapCandidate]>()
    @State private var minimumScore = 50.0
    @State private var scanning = false
    @State private var notice: String?
    @State private var selected: SearchResult?

    private var candidates: [SmallCapCandidate] {
        (state.value ?? []).filter { ($0.potentialScore ?? 0) >= minimumScore }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Eyebrow(text: "Marketly / Discovery")
                    Spacer()
                    ModeLabel()
                }
                Text("Small companies.\nSerious questions.").font(.largeTitle.weight(.semibold))
                    .tracking(-1)
                Text(
                    "Explore the persisted Marketly shortlist. Scores summarize observed evidence, not forecasts."
                ).font(.subheadline).foregroundStyle(MarketTheme.secondaryText)
                HStack(spacing: 12) {
                    Text("Minimum score").font(.caption).foregroundStyle(MarketTheme.secondaryText)
                    Slider(value: $minimumScore, in: 0...90, step: 5).tint(MarketTheme.accentMint)
                    Text("\(Int(minimumScore))+").font(.caption.monospacedDigit())
                }.marketPanel()
                if let error = state.error {
                    FailureState(message: error) { Task { await refresh() } }
                }
                if let notice {
                    Text(notice).font(.caption).foregroundStyle(MarketTheme.secondaryText).padding(
                        12
                    ).background(MarketTheme.surface, in: RoundedRectangle(cornerRadius: 8))
                }
                if state.isLoading && state.value == nil { LoadingRows() }
                if let rows = state.value, rows.isEmpty {
                    EmptyState(
                        title: "No saved scan yet",
                        message:
                            "Marketly’s discovery worker has not saved any candidates. Request a bounded scan below.",
                        symbol: "chart.bar.xaxis")
                    scanButton
                } else {
                    ForEach(candidates) { candidate in
                        SmallCapRow(candidate: candidate) {
                            selected = SearchResult(symbol: candidate.symbol, name: candidate.name)
                        } save: {
                            app.toggleWatchlist(candidate.symbol)
                            notice = "\(candidate.symbol) saved to your watchlist."
                        }
                    }
                    if !candidates.isEmpty { scanButton }
                }
            }.padding(20).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }.marketScreen().navigationTitle("Small CAP").navigationBarTitleDisplayMode(.inline)
            .navigationDestination(item: $selected) { CompanyDetailView(symbol: $0.symbol) }.task {
                if state.value == nil { await refresh() }
            }.refreshable { await refresh() }
    }

    private var scanButton: some View {
        Button {
            Task {
                scanning = true
                defer { scanning = false }
                do {
                    try await app.services.smallCaps.runScan(
                        SmallCapScanBody(
                            name: "small", min_market_cap: 300_000_000,
                            max_market_cap: 2_000_000_000, min_average_volume: 100_000,
                            countries: ["US"], deep_limit: 10))
                    notice = "The scan is queued. Refresh after the discovery worker completes it."
                } catch { notice = error.localizedDescription }
            }
        } label: {
            HStack {
                if scanning { ProgressView() }
                Text(scanning ? "Queueing scan…" : "Queue a bounded small-cap scan")
                Spacer()
                Image(systemName: "arrow.clockwise")
            }.frame(minHeight: 44)
        }.buttonStyle(.bordered).tint(MarketTheme.accentMint).disabled(scanning)
            .accessibilityIdentifier("small-cap-scan")
    }

    private func refresh() async {
        await state.load { try await app.services.smallCaps.candidates() }
    }
}

private struct SmallCapRow: View {
    let candidate: SmallCapCandidate
    let open: () -> Void
    let save: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            Button(action: open) {
                HStack(spacing: 12) {
                    LogoView(symbol: candidate.symbol)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(candidate.symbol).font(.headline)
                        Text(candidate.name).font(.caption).foregroundStyle(
                            MarketTheme.secondaryText
                        ).lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    VStack(alignment: .trailing, spacing: 5) {
                        Text(candidate.potentialScore.map { "\(Int($0))" } ?? "—").font(
                            .title2.weight(.semibold).monospacedDigit())
                        Text("Evidence score").font(.system(size: 9)).foregroundStyle(
                            MarketTheme.secondaryText)
                    }
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(
                        MarketTheme.tertiaryText)
                }.contentShape(Rectangle())
            }.buttonStyle(.plain)
            HStack(spacing: 16) {
                Label(MarketFormat.compact(candidate.marketCap), systemImage: "building.2")
                Label(
                    "Risk \(Int(candidate.riskScore ?? 0))", systemImage: "exclamationmark.shield")
                Spacer(minLength: 0)
                Button(action: save) { Image(systemName: "star").frame(width: 44, height: 44) }
                    .accessibilityLabel("Add \(candidate.symbol) to watchlist")
            }.font(.caption).foregroundStyle(MarketTheme.secondaryText)
            if let coverage = candidate.evidenceCoverage {
                HStack {
                    Text("Evidence coverage")
                    Spacer()
                    Text("\(Int(coverage * 100))%")
                }.font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
                ProgressView(value: min(max(coverage, 0), 1)).tint(MarketTheme.accentMint)
            }
            Text(candidate.summary ?? "Coverage, risks, and financial evidence vary by company.")
                .font(.caption).foregroundStyle(MarketTheme.secondaryText).lineLimit(3)
            Text("Past screen score; not a predicted return.").font(.system(size: 9))
                .foregroundStyle(MarketTheme.tertiaryText)
        }.marketPanel()
    }
}
