import SwiftUI
import UIKit

struct AlertsView: View {
    @Environment(AppModel.self) private var app
    @State private var rules = LoadState<[AlertRule]>()
    @State private var inbox = LoadState<AlertInbox>()
    @State private var symbol = ""
    @State private var threshold = ""
    @State private var direction = "above"
    @State private var triggerType = "price"
    @State private var saving = false
    @State private var requestingPush = false
    @State private var sendingTest = false
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

            Section("This device") {
                Button {
                    Task { await enablePushOnThisDevice() }
                } label: {
                    HStack {
                        if requestingPush { ProgressView() }
                        Label("Enable push notifications", systemImage: "bell.badge")
                        Spacer()
                    }
                }.disabled(requestingPush)
                if let pushStatus = app.pushStatus {
                    Text(pushStatus).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                } else {
                    Text(
                        app.authenticated
                            ? "Allow notifications to connect this device to your Marketly alerts."
                            : "Allow notifications, then sign in to connect this device to your alerts."
                    ).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                }
            }.listRowBackground(MarketTheme.surface)

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
                if let inboxValue = inbox.value {
                    Button {
                        Task { await sendTestNotification() }
                    } label: {
                        HStack {
                            if sendingTest { ProgressView() }
                            Label("Send test notification", systemImage: "paperplane")
                            Spacer()
                        }
                    }.disabled(
                        sendingTest || inboxValue.deviceCount == 0 || !inboxValue.pushConfigured)
                }
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
                        inboxValue.pushConfigured
                            ? "Push delivery is configured for registered devices."
                            : "Push provider credentials are not configured on the Marketly server."
                    ).font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
                }
            }.listRowBackground(MarketTheme.surface)
        }.listStyle(.insetGrouped).scrollContentBackground(.hidden).marketScreen().navigationTitle(
            "Alerts"
        ).navigationBarTitleDisplayMode(.inline).task { await refresh() }.refreshable {
            await refresh()
        }.onChange(of: app.pushStatus) { _, status in
            guard status?.contains("registered for Marketly alerts") == true else { return }
            Task { await refreshInbox() }
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

    private func sendTestNotification() async {
        sendingTest = true
        defer { sendingTest = false }
        do {
            let result = try await app.services.alerts.sendTest()
            notice =
                result.sent
                ? "Test notification sent. Check this device."
                : "Test alert was saved, but the push provider did not confirm delivery."
            await refreshInbox()
        } catch { notice = error.localizedDescription }
    }

    private func enablePushOnThisDevice() async {
        requestingPush = true
        defer { requestingPush = false }
        do {
            guard try await AppleNotificationService().requestPermission() else {
                notice = "Notifications are disabled in iOS Settings."
                return
            }
            UIApplication.shared.registerForRemoteNotifications()
            notice =
                app.authenticated
                ? "Permission granted. Registering this device with Marketly…"
                : "Permission granted. Sign in to attach this device to your alerts."
        } catch { notice = error.localizedDescription }
    }
}
