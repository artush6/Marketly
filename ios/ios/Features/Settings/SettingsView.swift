import SwiftUI
import UIKit
import UserNotifications

struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
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
                Button("Save connection") { saveConnection() }.accessibilityIdentifier(
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
                        Task {
                            do {
                                try await app.signOut()
                                error = nil
                            } catch { self.error = error.localizedDescription }
                        }
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

            Section("Live market data") {
                Label(
                    "FastAPI · live service only", systemImage: "antenna.radiowaves.left.and.right"
                ).foregroundStyle(MarketTheme.positive)
                Text(
                    "Market data, research, and alerts always use the configured FastAPI service. No demo market data is shown."
                ).font(.caption).foregroundStyle(MarketTheme.secondaryText)
            }.listRowBackground(MarketTheme.surface)

            Section("Notifications") {
                Button("Enable push notifications") { Task { await enableNotifications() } }
                if let pushStatus = app.pushStatus {
                    Text(pushStatus).font(.caption).foregroundStyle(MarketTheme.secondaryText)
                } else if let notificationStatus {
                    Text(notificationStatus).font(.caption).foregroundStyle(
                        MarketTheme.secondaryText)
                }
                Text(
                    "Marketly will ask iOS for permission, register this device with your account, and send alerts through Apple Push Notification service."
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
                backendURL = app.baseURL
                supabaseURL = app.supabaseURL.isEmpty ? AppConfig.supabaseURL : app.supabaseURL
                publishableKey =
                    app.publishableKey.isEmpty ? AppConfig.publishableKey : app.publishableKey
            }
    }

    private func saveConnection() {
        do {
            try app.configure(
                baseURL: backendURL, token: "", supabaseURL: supabaseURL,
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
                baseURL: backendURL, token: "", supabaseURL: supabaseURL,
                publishableKey: publishableKey)
            try await app.signInWithGoogle()
            savedMessage = "Signed in. Marketly’s live API is ready."
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func enableNotifications() async {
        do {
            let granted = try await AppleNotificationService().requestPermission()
            guard granted else {
                notificationStatus = "Notifications are disabled in iOS Settings."
                return
            }
            UIApplication.shared.registerForRemoteNotifications()
            notificationStatus =
                app.authenticated
                ? "Permission granted. Registering this device with Marketly…"
                : "Permission granted. Sign in to attach this device to your alerts."
        } catch { notificationStatus = error.localizedDescription }
    }
}

private struct GoogleMark: View {
    var body: some View {
        Text("G").font(.headline.weight(.bold)).foregroundStyle(.white).frame(width: 24, height: 24)
            .background(Color(red: 0.22, green: 0.45, blue: 0.82), in: Circle())
    }
}
