import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var mode = ServiceMode.live
    @State private var backendURL = AppConfig.backendURL
    @State private var supabaseURL = AppConfig.supabaseURL
    @State private var publishableKey = AppConfig.publishableKey
    @State private var error: String?
    @State private var signingIn = false
    @State private var savedMessage: String?
    @State private var notificationStatus: String?

    var body: some View {
        Form {
            Section {
                HStack {
                    Wordmark()
                    Spacer()
                    ModeLabel()
                }.padding(.vertical, 8)
                Text("The existing Marketly API powers this client.").font(.subheadline)
                    .foregroundStyle(MarketTheme.secondaryText)
            }.listRowBackground(MarketTheme.surface)

            Section("Services") {
                TextField("FastAPI base URL", text: $backendURL).keyboardType(.URL)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Supabase project URL", text: $supabaseURL).keyboardType(.URL)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                Text("Publishable key · used only to initialize Supabase Auth").font(.caption)
                    .foregroundStyle(MarketTheme.secondaryText)
                SecureField("Supabase publishable key", text: $publishableKey)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .accessibilityIdentifier("supabase-publishable-key")
                Text(
                    "The API base URL defaults to Marketly’s Render service. Google sign-in uses the same Supabase project as the web app."
                ).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                Button("Save connection") { save(mode: app.mode) }.accessibilityIdentifier(
                    "apply-connection")
                if let savedMessage {
                    Text(savedMessage).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                }
            }.listRowBackground(MarketTheme.surface)

            Section("Marketly account") {
                if app.authenticated {
                    Label("Signed in with Google", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(MarketTheme.positive)
                    Button("Sign out", role: .destructive) {
                        do {
                            try app.signOut()
                            error = nil
                        } catch { self.error = error.localizedDescription }
                    }
                } else {
                    Button {
                        Task { await signIn() }
                    } label: {
                        HStack(spacing: 10) {
                            if signingIn { ProgressView() } else { GoogleMark() }
                            Text(signingIn ? "Connecting to Google…" : "Continue with Google")
                            Spacer()
                        }.frame(minHeight: 48)
                    }.disabled(signingIn).accessibilityIdentifier("google-sign-in")
                    Text(
                        "Google OAuth is enabled in the web app. Supabase must allow the native callback URL marketly://auth/callback."
                    ).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                }
                if let error { Text(error).font(.caption).foregroundStyle(MarketTheme.warning) }
                Text("Sign-in tokens are stored in Keychain and refreshed through Supabase Auth.")
                    .font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
            }.listRowBackground(MarketTheme.surface)

            Section("Data source") {
                Picker("Market data", selection: $mode) {
                    ForEach(ServiceMode.allCases) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented).onChange(of: mode) { _, value in
                    if value == .demo {
                        do {
                            try app.configure(
                                mode: .demo, baseURL: backendURL, token: "",
                                supabaseURL: supabaseURL, publishableKey: publishableKey)
                        } catch { self.error = error.localizedDescription }
                    }
                }
                Text(
                    mode == .demo
                        ? "Demo mode uses clearly labeled, fixed illustrative fixtures."
                        : "Live mode calls FastAPI. Quotes may be delayed and require sign-in."
                ).font(.caption).foregroundStyle(MarketTheme.secondaryText)
            }.listRowBackground(MarketTheme.surface)

            Section("Notifications") {
                Button("Enable notification permissions") {
                    Task {
                        do {
                            let granted = try await AppleNotificationService().requestPermission()
                            notificationStatus =
                                granted
                                ? "Permission enabled. APNs device registration still needs the Marketly alert backend."
                                : "Notifications are disabled in iOS Settings."
                        } catch { notificationStatus = error.localizedDescription }
                    }
                }
                if let notificationStatus {
                    Text(notificationStatus).font(.caption).foregroundStyle(
                        MarketTheme.secondaryText)
                }
                Text(
                    "This app can manage alert rules, but native remote push requires APNs setup on the server."
                ).font(.caption2).foregroundStyle(MarketTheme.tertiaryText)
            }.listRowBackground(MarketTheme.surface)

            Section("On this device") {
                LabeledContent(
                    "Watchlist and saved research",
                    value: app.authenticated ? "Supabase sync" : "Local storage")
                Button("Clear recent searches") { app.clearRecents() }
                Text(
                    "Sign in with the same Google account to sync your private watchlist and saved research through Supabase."
                ).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                if let message = UserDefaults.standard.string(
                    forKey: "marketly.workspace-sync-error")
                {
                    Text("Sync pending: \(message)").font(.caption2).foregroundStyle(
                        MarketTheme.warning)
                }
            }.listRowBackground(MarketTheme.surface)
        }.scrollContentBackground(.hidden).marketScreen().navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline).toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }.onAppear {
                mode = app.mode
                backendURL = app.baseURL
                supabaseURL = app.supabaseURL.isEmpty ? AppConfig.supabaseURL : app.supabaseURL
                publishableKey =
                    app.publishableKey.isEmpty ? AppConfig.publishableKey : app.publishableKey
            }
    }

    private func save(mode: ServiceMode) {
        do {
            try app.configure(
                mode: mode, baseURL: backendURL, token: "", supabaseURL: supabaseURL,
                publishableKey: publishableKey)
            savedMessage = "Connection saved."
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func signIn() async {
        signingIn = true
        defer { signingIn = false }
        do {
            try app.configure(
                mode: .live, baseURL: backendURL, token: "", supabaseURL: supabaseURL,
                publishableKey: publishableKey)
            mode = .live
            try await app.signInWithGoogle()
            savedMessage = "Signed in. Marketly’s live API is ready."
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

private struct GoogleMark: View {
    var body: some View {
        Text("G").font(.headline.weight(.bold)).foregroundStyle(.white).frame(width: 24, height: 24)
            .background(Color(red: 0.22, green: 0.45, blue: 0.82), in: Circle())
    }
}
