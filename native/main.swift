import AppKit
import SwiftUI
import ServiceManagement
import WebKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, NSMenuItemValidation {
    private var statusItem: NSStatusItem!
    private let popover = NSPopover()
    private var detail: NSWindow?
    private var webView: WKWebView?
    private let navigation = LocalNavigation()
    private var store: ObservatoryStore!
    private var terminationSignal: DispatchSourceSignal?
    private var panelSize = NSSize.zero
    private var previewRuntime: URL?
    private weak var lifecycleWebView: WKWebView?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        let runtime: URL
        let lifecycleTest = CommandLine.arguments.contains("--test-lifecycle")
        if CommandLine.arguments.contains("--preview") || lifecycleTest {
            // An isolated, empty UI preview never changes installed settings or login state.
            let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("observatory-ui-preview-\(UUID().uuidString)")
            do {
                _ = try CollectorConfiguration.prepare(runtime: temporary)
                try CollectorConfiguration.save(Dictionary(uniqueKeysWithValues: CollectorConfiguration.defaults.keys.map { ($0, false) }), runtime: temporary)
            } catch { NSApp.terminate(nil); return }
            previewRuntime = temporary
            runtime = temporary
        } else {
            runtime = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("Library/Application Support/Workspace Observatory")
        }
        store = ObservatoryStore(runtime: runtime)
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            let image = telescopeImage(template: true)
            button.image = image
            button.toolTip = previewRuntime == nil ? "Workspace Observatory" : "Workspace Observatory (temporary preview)"
            button.target = self
            button.action = #selector(togglePanel)
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
        popover.behavior = .transient
        popover.animates = true
        makeMenu()
        signal(SIGTERM, SIG_IGN)
        let termination = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
        termination.setEventHandler { NSApp.terminate(nil) }
        termination.resume()
        terminationSignal = termination
        // Lifecycle tests use empty private settings and never start collection.
        if lifecycleTest { checkDashboardLifecycle(remaining: 3); return }
        store.start()
        if CommandLine.arguments.contains("--show") { togglePanel() }
    }

    private func makeMenu() {
        let menu = NSMenu()
        let application = NSMenuItem()
        let items = NSMenu()
        items.addItem(withTitle: "Open Observatory", action: #selector(openDefault), keyEquivalent: "o").target = self
        items.addItem(withTitle: "Refresh sources", action: #selector(refresh), keyEquivalent: "r").target = self
        items.addItem(withTitle: "Local source settings…", action: #selector(sourceSettings), keyEquivalent: ",").target = self
        items.addItem(withTitle: "Disconnect paired device…", action: #selector(disconnectPairing), keyEquivalent: "").target = self
        items.addItem(.separator())
        items.addItem(withTitle: "Quit Observatory", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        application.submenu = items
        menu.addItem(application)
        let view = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Zoom In", action: #selector(zoomIn), keyEquivalent: "=").target = self
        viewMenu.addItem(withTitle: "Zoom Out", action: #selector(zoomOut), keyEquivalent: "-").target = self
        viewMenu.addItem(withTitle: "Actual Size", action: #selector(actualSize), keyEquivalent: "0").target = self
        viewMenu.addItem(.separator())
        viewMenu.addItem(withTitle: "200%", action: #selector(doubleSize), keyEquivalent: "").target = self
        view.submenu = viewMenu
        menu.addItem(view)
        let window = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        window.submenu = windowMenu
        menu.addItem(window)
        NSApp.mainMenu = menu
        NSApp.windowsMenu = windowMenu
    }

    @objc private func togglePanel() {
        if NSApp.currentEvent?.type == .rightMouseUp { showMenu(); return }
        if popover.isShown { popover.performClose(nil); return }
        store.reload()
        guard let button = statusItem.button else { return }
        let visible = button.window?.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 800, height: 600)
        let size = NSSize(width: min(370, max(240, visible.width - 32)), height: min(620, max(240, visible.height - 48)))
        if popover.contentViewController == nil || size != panelSize {
            panelSize = size
            let panel = ScrollView(.vertical) {
                ObservatoryPanel(store: store,
                    open: { [weak self] tab in self?.openDashboard(tab) },
                    settings: { [weak self] in self?.showMenu() }, panelWidth: size.width)
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(width: size.width, height: size.height)
            .background(ObservatoryBackdrop())
            .preferredColorScheme(.dark)
            popover.contentViewController = NSHostingController(rootView: panel)
        }
        popover.contentSize = size
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
    }

    private func showMenu() {
        popover.performClose(nil)
        let menu = NSMenu()
        menu.addItem(withTitle: "Open Observatory", action: #selector(openDefault), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Refresh sources", action: #selector(refresh), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Local source settings…", action: #selector(sourceSettings), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Disconnect paired device…", action: #selector(disconnectPairing), keyEquivalent: "").target = self
        menu.addItem(.separator())
        let login = menu.addItem(withTitle: "Launch at login", action: #selector(toggleLogin), keyEquivalent: "")
        login.target = self
        login.isEnabled = previewRuntime == nil
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(withTitle: "Login settings…", action: #selector(loginSettings), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Observatory", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        guard let button = statusItem.button else { return }
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: button.bounds.minY), in: button)
    }

    @objc private func toggleLogin() {
        guard previewRuntime == nil else { return }
        do {
            if SMAppService.mainApp.status == .enabled { try SMAppService.mainApp.unregister() }
            else { try SMAppService.mainApp.register() }
        } catch {
            let alert = NSAlert()
            alert.messageText = "Launch at login needs attention"
            alert.informativeText = "Open Login Items in System Settings to allow Workspace Observatory."
            alert.runModal()
        }
    }
    @objc private func loginSettings() { SMAppService.openSystemSettingsLoginItems() }
    @objc private func sourceSettings() {
        popover.performClose(nil)
        let alert = NSAlert()
        alert.messageText = "Local source settings"
        let local: Bool
        do { local = try CollectorConfiguration.prepare(runtime: store.runtime) }
        catch {
            alert.informativeText = "The local configuration could not be read. Existing settings have been preserved."
            alert.runModal()
            return
        }
        guard local else {
            alert.informativeText = "This preview uses your existing cross-device configuration. It has been preserved. Local-only settings are available for new installations."
            alert.runModal()
            return
        }
        guard !store.refreshing else {
            alert.informativeText = "A collection is running. Try again when it finishes so source changes apply to the next complete snapshot."
            alert.runModal()
            return
        }
        do {
            let config = try CollectorConfiguration.read(runtime: store.runtime)
            let sources = [("activity", "ActivityWatch screen time (must be running)"),
                           ("codex", "Saved Codex usage and settings"),
                           ("wispr", "Wispr Flow statistics"),
                           ("typewhisper", "TypeWhisper statistics")]
            let buttons = sources.map { key, title in
                let button = NSButton(checkboxWithTitle: title, target: nil, action: nil)
                button.state = config[key] == true ? .on : .off
                return button
            }
            let stack = NSStackView(views: buttons)
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 10
            stack.frame = NSRect(x: 0, y: 0, width: 360, height: 115)
            alert.accessoryView = stack
            alert.informativeText = "Read usage metadata from this Mac only. Prompts, window titles, transcripts and audio stay out of Observatory snapshots. Dictation sources are optional."
            alert.addButton(withTitle: "Save")
            alert.addButton(withTitle: "Cancel")
            if alert.runModal() == .alertFirstButtonReturn {
                let updated = Dictionary(uniqueKeysWithValues: zip(sources, buttons).map { ($0.0.0, $0.1.state == .on) })
                try CollectorConfiguration.save(updated, runtime: store.runtime)
                store.refresh()
            }
        } catch {
            let failure = NSAlert()
            failure.messageText = "Source settings unavailable"
            failure.informativeText = "The local settings file could not be read or saved. Existing settings were not intentionally replaced."
            failure.runModal()
        }
    }
    @objc private func refresh() { store.refresh() }
    @objc private func disconnectPairing() {
        popover.performClose(nil)
        let alert = NSAlert()
        alert.messageText = "Disconnect paired device?"
        guard !store.refreshing, !store.pairingMaintenance else {
            alert.informativeText = "A local operation is running. Try again when it finishes."
            alert.runModal()
            return
        }
        guard FileManager.default.fileExists(atPath: store.runtime.appendingPathComponent("private-sync").path) else {
            alert.informativeText = "No private pairing state was found for this installation."
            alert.runModal()
            return
        }
        alert.informativeText = "Disable pairing on this Mac only. Local collection continues and saved data is retained. A transfer already in flight may finish. Disconnect on the other device separately. Reconnection requires explicit repair, which is not available yet."
        alert.addButton(withTitle: "Cancel")
        alert.addButton(withTitle: "Disconnect on this Mac")
        guard alert.runModal() == .alertSecondButtonReturn else { return }
        store.collectionPausedForPairing = true
        guard !store.refreshing, !store.pairingMaintenance else {
            let busy = NSAlert()
            busy.messageText = "Disconnection is waiting"
            busy.informativeText = "An operation started while confirmation was open. It may finish, but further collection is paused for this session. Retry disconnection when it finishes."
            busy.runModal()
            return
        }
        guard let resources = Bundle.main.resourceURL else { return }
        store.pairingMaintenance = true
        Task { @MainActor in
            let result = NSAlert()
            do {
                try await PairingMaintenance.disconnect(runtime: store.runtime, resources: resources)
                result.messageText = "Pairing disabled on this Mac"
                result.informativeText = "Saved data remains. The dashboard will return to local-only data after the next successful collection. Disconnect the other device separately; SSH access is unchanged."
                store.collectionPausedForPairing = false
            } catch {
                result.messageText = "Disconnection could not be verified"
                result.informativeText = "Collection is paused for this session. Private state was not deleted, and pairing may already be disabled. Retry disconnection or quit the app until the pairing state can be inspected."
            }
            store.pairingMaintenance = false
            store.refresh()
            result.runModal()
        }
    }
    @objc private func openDefault() { openDashboard("activity") }

    @objc private func zoomIn() {
        guard let webView else { return }
        webView.pageZoom = CGFloat(DashboardZoom.step(from: Double(webView.pageZoom), increasing: true))
    }
    @objc private func zoomOut() {
        guard let webView else { return }
        webView.pageZoom = CGFloat(DashboardZoom.step(from: Double(webView.pageZoom), increasing: false))
    }
    @objc private func actualSize() { webView?.pageZoom = 1 }
    @objc private func doubleSize() { webView?.pageZoom = 2 }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        let zoom = webView?.pageZoom
        switch item.action {
        case #selector(zoomIn): return zoom.map { $0 < 2 } ?? false
        case #selector(zoomOut): return zoom.map { $0 > 0.75 } ?? false
        case #selector(actualSize):
            item.state = zoom == 1 ? .on : .off
            return zoom != nil
        case #selector(doubleSize):
            item.state = zoom == 2 ? .on : .off
            return zoom != nil
        default: return true
        }
    }

    private func openDashboard(_ tab: String) {
        popover.performClose(nil)
        if detail == nil {
            guard let resources = Bundle.main.resourceURL else { return }
            let web = makeDashboard(runtime: store.runtime, resources: resources)
            web.navigationDelegate = navigation
            web.uiDelegate = navigation
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1150, height: 770),
                                  styleMask: [.titled, .closable, .miniaturizable, .resizable],
                                  backing: .buffered, defer: false)
            window.title = "Workspace Observatory"
            window.titlebarAppearsTransparent = true
            window.minSize = NSSize(width: 800, height: 550)
            window.contentView = web
            window.delegate = self
            window.isReleasedWhenClosed = false
            window.setFrameAutosaveName("ObservatoryDetail")
            window.center()
            detail = window
            webView = web
        }
        let safeTab = ["activity", "tokens", "agents", "dictation", "sources"].contains(tab) ? tab : "activity"
        webView?.load(URLRequest(url: URL(string: "observatory://app/index.html#\(safeTab)")!))
        detail?.deminiaturize(nil)
        detail?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func windowWillClose(_ notification: Notification) {
        webView?.stopLoading()
        webView?.configuration.userContentController.removeAllScriptMessageHandlers()
        detail?.contentView = nil
        webView = nil
        detail = nil
    }

    private func checkDashboardLifecycle(remaining: Int) {
        guard remaining > 0 else {
            print("Native lifecycle passed: three dashboard open/close cycles released their web views; menu-bar app remained running")
            NSApp.terminate(nil)
            return
        }
        openDashboard("activity")
        lifecycleWebView = webView
        guard lifecycleWebView != nil, detail?.isVisible == true else {
            print("Native lifecycle failed: dashboard did not open")
            exit(1)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [self] in
            detail?.performClose(nil)
            // Allow AppKit's close notification and autorelease pool to drain.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [self] in
                guard detail == nil, webView == nil, lifecycleWebView == nil,
                      statusItem.button != nil, NSApp.isRunning else {
                    print("Native lifecycle failed: closed dashboard retained state or menu-bar app stopped")
                    exit(1)
                }
                checkDashboardLifecycle(remaining: remaining - 1)
            }
        }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openDashboard("activity")
        return true
    }
    func applicationWillTerminate(_ notification: Notification) {
        store?.stop()
        // Keep a preview directory if collection is still shutting down. It contains
        // only this preview's settings/snapshots, never installed application state.
        if let temporary = previewRuntime, store?.refreshing == false, store?.pairingMaintenance == false {
            try? FileManager.default.removeItem(at: temporary)
        }
    }
}

if CommandLine.arguments.contains("--self-test") {
    runSelfTests()
} else if CommandLine.arguments.contains("--test-collector") {
    runCollectorSelfTest()
} else if CommandLine.arguments.contains("--test-web") {
    MainActor.assumeIsolated {
        let application = NSApplication.shared
        application.setActivationPolicy(.prohibited)
        let test = WebSmokeTest()
        test.start()
        withExtendedLifetime(test) { application.run() }
    }
} else if CommandLine.arguments.contains("--enable-login") {
    if CommandLine.arguments.contains("--preview") {
        print("Login registration is disabled for previews")
        exit(1)
    }
    do {
        try SMAppService.mainApp.register()
        print(SMAppService.mainApp.status == .enabled ? "enabled" : "approval-required")
    } catch {
        print("registration-failed")
        exit(1)
    }
} else if CommandLine.arguments.contains("--login-status") {
    print(SMAppService.mainApp.status == .enabled ? "enabled" : "not-enabled")
} else {
    MainActor.assumeIsolated {
        let application = NSApplication.shared
        let delegate = AppDelegate()
        application.delegate = delegate
        withExtendedLifetime(delegate) { application.run() }
    }
}
