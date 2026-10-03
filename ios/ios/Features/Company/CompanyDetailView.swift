import SwiftUI

struct CompanyDetailView: View {
    @Environment(AppModel.self) private var app
    let symbol: String
    @State private var state = LoadState<CompanyDetail>()
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let error = state.error {
                    FailureState(message: error) { Task { await refresh() } }
                }

                if let detail = state.value {
                    content(detail)
                } else if state.isLoading {
                    LoadingRows()
                    LoadingRows()
                }
            }

            .padding(20).frame(maxWidth: 900).frame(maxWidth: .infinity)
        }

        .marketScreen().navigationTitle(symbol).navigationBarTitleDisplayMode(.inline).toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let detail = state.value {
                    Button {
                        app.saveResearch(detail.quote)
                    } label: {
                        Image(systemName: "bookmark").frame(width: 44, height: 44)
                    }.accessibilityLabel("Save \(symbol) research")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { app.toggleWatchlist(symbol) }
                } label: {
                    Image(systemName: app.watchlist.contains(symbol) ? "star.fill" : "star").frame(
                        width: 44, height: 44)
                }

                .accessibilityLabel(
                    app.watchlist.contains(symbol) ? "Remove from watchlist" : "Add to watchlist"
                ).accessibilityIdentifier("company-watchlist")
            }
        }

        .safeAreaInset(edge: .bottom, alignment: .trailing, spacing: 0) {
            AssistantPill {
                app.ask(AssistantContext(symbol: symbol, name: state.value?.quote.name ?? symbol))
            }

            .padding(.trailing, 20).padding(.vertical, 8)
        }

        .task(id: symbol) {
            await refresh()
            if let detail = state.value {
                app.remember(SearchResult(symbol: symbol, name: detail.quote.name))
            }
        }

        .refreshable { await refresh() }
    }

    private func content(_ detail: CompanyDetail) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Eyebrow(text: detail.quote.sector)
                    Spacer()
                    ModeLabel()
                }

                HStack(spacing: 14) {
                    LogoView(symbol: symbol, url: detail.quote.logoURL, size: 56)
                    Text(detail.quote.name).font(.largeTitle.weight(.semibold)).tracking(-1)
                }
                HStack(alignment: .firstTextBaseline, spacing: 14) {
                    Text(MarketFormat.price(detail.quote.price, currency: detail.quote.currency))
                        .font(.system(.largeTitle, weight: .medium)).monospacedDigit()
                        .contentTransition(.numericText())
                    ChangeLabel(value: detail.quote.changePercent).font(.headline)
                }

                Text("\(detail.quote.currency) · Quotes may be delayed").font(.caption)
                    .foregroundStyle(MarketTheme.tertiaryText)
            }

            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Price performance").font(.headline)
                    Spacer()
                    Text(app.mode == .demo ? "SAMPLE" : "HISTORY").font(
                        .system(.caption2, design: .monospaced)
                    ).foregroundStyle(MarketTheme.secondaryText)
                }

                PriceChart(
                    points: detail.quote.history, positive: (detail.quote.changePercent ?? 0) >= 0)
                if let notice = detail.notice {
                    Text(notice).font(.caption2).foregroundStyle(MarketTheme.secondaryText)
                }
            }

            .marketPanel()
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(number: "01", title: "The business")
                Text(detail.summary).font(.subheadline).foregroundStyle(MarketTheme.secondaryText)
                    .lineSpacing(5)
            }

            VStack(alignment: .leading, spacing: 16) {
                SectionTitle(number: "02", title: "Financial snapshot")
                LazyVGrid(
                    columns: Array(
                        repeating: GridItem(.flexible(), alignment: .leading),
                        count: typeSize.isAccessibilitySize ? 1 : 2), alignment: .leading,
                    spacing: 20
                ) {
                    ForEach(detail.metrics) { metric in
                        VStack(alignment: .leading, spacing: 7) {
                            Text(metric.label).font(.caption).foregroundStyle(
                                MarketTheme.secondaryText)
                            Text(metric.formatted).font(.title3.weight(.semibold)).monospacedDigit()
                            Text(metric.basis.isEmpty ? "Not available" : metric.basis).font(
                                .caption2
                            ).foregroundStyle(MarketTheme.tertiaryText)
                        }
                    }
                }
            }

            .marketPanel()
            DisclosureGroup {
                FinancialHistoryChart(points: detail.financialHistory).padding(.top, 12)
            } label: {
                Label("Expand financials & charts", systemImage: "chart.bar.xaxis").font(
                    .subheadline.weight(.medium)
                ).foregroundStyle(MarketTheme.accentMint).frame(minHeight: 48)
            }.padding(.horizontal, 16).background(
                MarketTheme.surface, in: RoundedRectangle(cornerRadius: 12)
            ).accessibilityIdentifier("financial-history")

            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(number: "03", title: "Research lens")
                Text("Go beyond the price.").font(.title2.weight(.semibold))
                Text("Explore growth, valuation, and what could change the thesis.").font(
                    .subheadline
                ).foregroundStyle(MarketTheme.secondaryText)
                Button {
                    app.ask(AssistantContext(symbol: symbol, name: detail.quote.name))
                } label: {
                    Label("Ask Marketly about \(symbol)", systemImage: "sparkles").font(
                        .subheadline.weight(.medium)
                    ).frame(maxWidth: .infinity, minHeight: 44)
                }

                .buttonStyle(.bordered).tint(MarketTheme.accentMint).accessibilityIdentifier(
                    "company-ask")
            }

            .marketPanel()
            VStack(alignment: .leading, spacing: 8) {
                SectionTitle(number: "04", title: "Related stories")
                if detail.articles.isEmpty {
                    Text("No related stories are available.").font(.subheadline).foregroundStyle(
                        MarketTheme.secondaryText)
                }

                ForEach(Array(detail.articles.prefix(5))) { article in
                    NavigationLink(value: article) { StoryRow(article: article) }

                        .buttonStyle(.plain)
                    Divider().overlay(MarketTheme.border)
                }
            }
        }
    }

    private func refresh() async {
        await state.load { try await app.services.company.company(symbol: symbol) }
    }
}
