import SwiftUI
import UIKit
import UserNotifications

@main struct MarketlyApp: App {
    @State private var app = AppModel()
    @UIApplicationDelegateAdaptor(MarketlyAppDelegate.self) private var appDelegate

    var body: some Scene { WindowGroup { RootView().environment(app) } }
}

extension Notification.Name {
    static let marketlyAPNSToken = Notification.Name("marketly.apns.token")
    static let marketlyAPNSError = Notification.Name("marketly.apns.error")
}

final class MarketlyAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus)
            else { return }
            DispatchQueue.main.async { application.registerForRemoteNotifications() }
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: "marketly.apns-token")
        NotificationCenter.default.post(name: .marketlyAPNSToken, object: token)
    }

    func application(
        _ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        UserDefaults.standard.set(error.localizedDescription, forKey: "marketly.apns-error")
        NotificationCenter.default.post(
            name: .marketlyAPNSError, object: error.localizedDescription)
    }
}

extension MarketlyAppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification,
        withCompletionHandler completionHandler:
            @escaping (UNNotificationPresentationOptions) -> Void
    ) { completionHandler([.banner, .badge, .sound]) }
}
