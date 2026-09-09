import AppKit
import SwiftUI
import ServiceManagement
import WebKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var statusItem: NSStatusItem!
    private let popover = NSPopover()
    private var detail: NSWindow?
    private var webView: WKWebView?
    private let navigation = LocalNavigation()
    private var store: ObservatoryStore!
    private var terminationSignal: DispatchSourceSignal?
    private var panelSize = NSSize.zero

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        let runtime = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Workspace Observatory")
        store = ObservatoryStore(runtime: runtime)
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            let image = telescopeImage(template: true)
            button.image = image
            button.toolTip = "Workspace Observatory"
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
        store.start()
        if CommandLine.arguments.contains("--show") { togglePanel() }
    }

    private func makeMenu() {
        let menu = NSMenu()
        let application = NSMenuItem()
        let items = NSMenu()
        items.addItem(withTitle: "Open Observatory", action: #selector(openDefault), keyEquivalent: "o").target = self
        items.addItem(withTitle: "Refresh sources", action: #selector(refresh), keyEquivalent: "r").target = self
        items.addItem(.separator())
        items.addItem(withTitle: "Quit Observatory", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        application.submenu = items
        menu.addItem(application)
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
        menu.addItem(.separator())
        let login = menu.addItem(withTitle: "Launch at login", action: #selector(toggleLogin), keyEquivalent: "")
        login.target = self
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(withTitle: "Login settings…", action: #selector(loginSettings), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Observatory", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        guard let button = statusItem.button else { return }
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: button.bounds.minY), in: button)
    }

    @objc private func toggleLogin() {
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
    @objc private func refresh() { store.refresh() }
    @objc private func openDefault() { openDashboard("activity") }

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
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openDashboard("activity")
        return true
    }
    func applicationWillTerminate(_ notification: Notification) { store?.stop() }
}

if CommandLine.arguments.contains("--self-test") {
    runSelfTests()
} else if CommandLine.arguments.contains("--test-web") {
    MainActor.assumeIsolated {
        let application = NSApplication.shared
        application.setActivationPolicy(.prohibited)
        let test = WebSmokeTest()
        test.start()
        withExtendedLifetime(test) { application.run() }
    }
} else if CommandLine.arguments.contains("--enable-login") {
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
