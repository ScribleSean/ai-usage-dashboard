import AppKit
import Combine
import Foundation

@MainActor
final class ObservatoryStore: ObservableObject {
    @Published var snapshot: Snapshot?
    @Published var refreshing = false
    @Published var lastAttempt = ""
    @Published var now = Date()
    let runtime: URL
    private var process: Process?
    private var pollTimer: Timer?
    private var refreshTimer: Timer?
    var onSnapshot: (() -> Void)?

    init(runtime: URL) {
        self.runtime = runtime
        reload()
    }

    func start() {
        pollTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.reload() }
        }
        pollTimer?.tolerance = 5
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.refresh() }
        }
        refreshTimer?.tolerance = 30
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didWakeNotification,
            object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.refresh() }
        }
        if snapshot?.collectedAt.map({ Date().timeIntervalSince($0) < 300 }) != true { refresh() }
    }

    var freshness: String {
        guard let date = snapshot?.collectedAt else { return "Waiting for first snapshot" }
        let minutes = max(0, Int(now.timeIntervalSince(date) / 60))
        if minutes < 1 { return "Updated just now" }
        if minutes < 60 { return "Updated \(minutes)m ago" }
        return "Updated \(minutes / 60)h ago"
    }
    var stale: Bool { snapshot?.collectedAt.map { now.timeIntervalSince($0) > 900 } ?? true }

    func reload() {
        now = Date()
        if let object = readObject(runtime.appendingPathComponent("public/local/usage.json")),
           number(object["schema"]) == 2, parseDate(object["collectedAt"]) != nil {
            snapshot = Snapshot(object: object)
            onSnapshot?()
        }
        let status = readObject(runtime.appendingPathComponent("public/local/collector.json"))
        lastAttempt = text(status?["state"], fallback: "not-started")
    }

    func refresh() {
        guard process == nil else { return }
        guard let config = readObject(runtime.appendingPathComponent("native-runtime.json")),
              let python = config["python"] as? String, let node = config["node"] as? String,
              python.hasPrefix("/"), node.hasPrefix("/"),
              FileManager.default.isExecutableFile(atPath: python),
              FileManager.default.isExecutableFile(atPath: node) else {
            lastAttempt = "runtime-unavailable"
            return
        }
        let task = Process()
        task.executableURL = URL(fileURLWithPath: python)
        task.arguments = [runtime.appendingPathComponent("scripts/run-collector.py").path,
                          "--node", node, "--interval", "300"]
        task.currentDirectoryURL = runtime
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        task.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                self?.process = nil
                self?.refreshing = false
                self?.reload()
            }
        }
        do {
            try task.run()
            process = task
            refreshing = true
        } catch { lastAttempt = "failed" }
    }

    func stop() {
        pollTimer?.invalidate()
        refreshTimer?.invalidate()
        // The runner catches termination and stops only its own collection process group.
        process?.terminate()
    }
}
