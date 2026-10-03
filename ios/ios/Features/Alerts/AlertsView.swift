import SwiftUI

struct AlertsView: View {
    @Environment(AppModel.self) private var app
    @State private var rules = LoadState<[AlertRule]>()
    @State private var inbox = LoadState<AlertInbox>()
    @State private var symbol = ""
    @State private var threshold = ""
    @State private var direction = "above"
    @State private var triggerType = "price"
    @State private var saving = false
    @State private var notice: String?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 9) {
                    Eyebrow(text: "Background market watch")
                    Text("Alerts").font(.largeTitle.weight(.semibold))
                    Text(
                        "Rules are checked by the existing Marketly worker. Native push delivery needs APNs registration."
                    ).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                }.padding(.vertical, 10)
            }.listRowBackground(MarketTheme.background).listRowSeparator(.hidden)

            Section("Create a rule") {
                TextField("Ticker", text: $symbol).textInputAutocapitalization(.characters)
                    .accessibilityIdentifier("alert-symbol")
                Picker("Trigger", selection: $triggerType) {
                    Text("Price").tag("price")
                    Text("Daily move %").tag("percent_change")
                }
                Picker("When", selection: $direction) {
                    Text("Above").tag("above")
                    Text("Below").tag("below")
                }
                HStack {
                    TextField(
                        triggerType == "price" ? "Price threshold" : "Percent threshold",
                        text: $threshold
                    ).keyboardType(.decimalPad)
                    Text(triggerType == "price" ? "USD" : "%").foregroundStyle(
                        MarketTheme.secondaryText)
                }
                Button {
                    Task { await addRule() }
                } label: {
                    HStack {
                        if saving { ProgressView() }
                        Text("Save alert")
                    }
                }.disabled(saving || symbol.isEmpty || Double(threshold) == nil)
                    .accessibilityIdentifier("alert-save")
                if let notice {
                    Text(notice).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                }
            }.listRowBackground(MarketTheme.surface)

            Section("Your rules") {
                if let error = rules.error {
                    Text(error).font(.caption).foregroundStyle(MarketTheme.warning)
                } else if rules.isLoading && rules.value == nil {
                    LoadingRows()
                } else if let items = rules.value, items.isEmpty {
                    Text("No ticker alerts yet.").foregroundStyle(MarketTheme.secondaryText)
                } else {
                    ForEach(rules.value ?? []) { rule in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(rule.symbol).font(.headline)
                                Text(
                                    "\(rule.triggerType == "price" ? "Price" : "Daily move") \(rule.direction) \(rule.threshold.formatted())\(rule.triggerType == "price" ? " USD" : "%")"
                                ).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                            }
                            Spacer()
                            Text(rule.enabled ? "ACTIVE" : "PAUSED").font(
                                .system(size: 9, design: .monospaced)
                            ).foregroundStyle(
                                rule.enabled ? MarketTheme.positive : MarketTheme.secondaryText)
                        }.swipeActions {
                            Button("Delete", systemImage: "trash", role: .destructive) {
                                Task { await delete(rule) }
                            }
                        }
                    }
                }
            }.listRowBackground(MarketTheme.surface)

            Section("Recent notifications") {
                if let error = inbox.error {
                    Text(error).font(.caption).foregroundStyle(MarketTheme.warning)
                } else if let items = inbox.value?.notifications, items.isEmpty {
                    Text("No notifications yet.").foregroundStyle(MarketTheme.secondaryText)
                } else {
                    ForEach(inbox.value?.notifications ?? []) { item in
                        Button {
                            guard item.readAt == nil else { return }
                            Task {
                                do {
                                    try await app.services.alerts.markRead(id: item.id)
                                    await refreshInbox()
                                } catch { notice = error.localizedDescription }
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 5) {
                                HStack {
                                    Text(item.title).font(.subheadline.weight(.medium))
                                    Spacer()
                                    if item.readAt == nil {
                                        Circle().fill(MarketTheme.accentMint).frame(
                                            width: 6, height: 6)
                                    }
                                }
                                Text(item.body).font(.caption).foregroundStyle(
                                    MarketTheme.secondaryText)
                                Text(item.createdAt).font(.system(size: 9, design: .monospaced))
                                    .foregroundStyle(MarketTheme.tertiaryText)
                            }.foregroundStyle(MarketTheme.primaryText)
                        }.buttonStyle(.plain)
                    }
                }
                if let inboxValue = inbox.value {
                    LabeledContent("Registered devices", value: "\(inboxValue.deviceCount)")
                    Text(
                        "\(inboxValue.pushConfigured ? "Web push is configured." : "Push provider credentials are not configured.") This native app has not registered APNs device tokens."
                    ).font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
                }
            }.listRowBackground(MarketTheme.surface)
        }.listStyle(.insetGrouped).scrollContentBackground(.hidden).marketScreen().navigationTitle(
            "Alerts"
        ).navigationBarTitleDisplayMode(.inline).task { await refresh() }.refreshable {
            await refresh()
        }
    }

    private func refresh() async {
        async let loadRules: Void = rules.load { try await app.services.alerts.rules() }
        async let loadInbox: Void = refreshInbox()
        _ = await (loadRules, loadInbox)
    }

    private func refreshInbox() async { await inbox.load { try await app.services.alerts.inbox() } }

    private func addRule() async {
        guard let value = Double(threshold), value > 0, triggerType == "price" || value <= 100
        else {
            notice = "Enter a positive price or a percentage below 100."
            return
        }
        saving = true
        defer { saving = false }
        do {
            try await app.services.alerts.createRule(
                AlertRuleBody(
                    symbol: String(symbol.uppercased().prefix(20)), trigger_type: triggerType,
                    direction: direction, threshold: value))
            symbol = ""
            threshold = ""
            notice = "Alert saved. Marketly will check it during background quote refreshes."
            await refresh()
        } catch { notice = error.localizedDescription }
    }

    private func delete(_ rule: AlertRule) async {
        do {
            try await app.services.alerts.deleteRule(id: rule.id)
            await refresh()
        } catch { notice = error.localizedDescription }
    }
}
