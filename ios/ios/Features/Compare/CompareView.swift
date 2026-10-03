import SwiftUI

struct CompareView: View {
    @Environment(AppModel.self) private var app
    @State private var symbolsText = "AAPL, MSFT"
    @State private var state = LoadState<[CompanyDetail]>()
    private var symbols: [String] {
        Array(
            Set(
                symbolsText.uppercased().split(separator: ",").map {
                    String($0).trimmingCharacters(in: .whitespaces)
                }.prefix(4)))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Eyebrow(text: "Side by side")
                Text("Compare companies.").font(.largeTitle.weight(.semibold))
                Text("Compare reported values with their period and currency visible.").font(
                    .subheadline
                ).foregroundStyle(MarketTheme.secondaryText)
                HStack {
                    TextField("AAPL, MSFT, NVDA", text: $symbolsText).textInputAutocapitalization(
                        .characters
                    ).autocorrectionDisabled()
                    Button("Compare") { Task { await refresh() } }.buttonStyle(.borderedProminent)
                        .tint(MarketTheme.accentMint)
                }.padding(12).background(
                    MarketTheme.surface, in: RoundedRectangle(cornerRadius: 10))
                if let error = state.error {
                    FailureState(message: error) { Task { await refresh() } }
                }
                if state.isLoading && state.value == nil { LoadingRows() }
                if let companies = state.value, !companies.isEmpty {
                    ScrollView(.horizontal) {
                        VStack(alignment: .leading, spacing: 0) {
                            HStack(alignment: .top) {
                                Text("Company").frame(width: 120, alignment: .leading)
                                ForEach(companies, id: \.quote.symbol) { company in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(company.quote.symbol).font(.headline)
                                        Text(company.quote.name).font(.caption).foregroundStyle(
                                            MarketTheme.secondaryText
                                        ).lineLimit(2)
                                    }.frame(width: 132, alignment: .leading)
                                }
                            }.padding(.vertical, 14)
                            Divider().overlay(MarketTheme.border)
                            ForEach(
                                Array(
                                    zip(
                                        0..<6,
                                        [
                                            "Price", "Market cap", "Revenue", "Net margin",
                                            "Revenue growth", "Free cash flow",
                                        ])), id: \.0
                            ) { index, title in
                                HStack {
                                    Text(title).font(.caption).foregroundStyle(
                                        MarketTheme.secondaryText
                                    ).frame(width: 120, alignment: .leading)
                                    ForEach(companies, id: \.quote.symbol) { company in
                                        let metric = company.metrics.first { $0.label == title }
                                        let formattedValue = metric?.formatted ?? "—"
                                        let displayValue =
                                            title == "Price"
                                            ? MarketFormat.price(company.quote.price)
                                            : formattedValue
                                        Text(displayValue).font(.caption.monospacedDigit()).frame(
                                            width: 132, alignment: .leading)
                                    }
                                }.padding(.vertical, 15)
                                Divider().overlay(MarketTheme.border)
                            }
                        }
                    }
                    Text(
                        "Each figure retains its provider period and basis on the company screen. Missing values stay blank."
                    ).font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
                }
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
        }.marketScreen().navigationTitle("Compare").navigationBarTitleDisplayMode(.inline).task {
            if state.value == nil { await refresh() }
        }
    }

    private func refresh() async {
        guard (2...4).contains(symbols.count) else {
            state.error = "Enter between two and four ticker symbols."
            return
        }
        await state.load {
            try await withThrowingTaskGroup(of: CompanyDetail.self) { group in
                for symbol in symbols {
                    group.addTask { try await app.services.company.company(symbol: symbol) }
                }
                var results: [CompanyDetail] = []
                for try await result in group { results.append(result) }
                return results.sorted {
                    symbols.firstIndex(of: $0.quote.symbol) ?? 99 < symbols.firstIndex(
                        of: $1.quote.symbol) ?? 99
                }
            }
        }
    }
}
