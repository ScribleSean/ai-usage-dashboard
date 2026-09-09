import Foundation

func runSelfTests() {
    let pairingRequest = PairingSetupRequest(transport: PairingTransport(kind: "ssh-windows", hostAlias: "fixture-host",
        remoteNode: "C:/Fixture/Runtime/node.exe", remoteScript: "C:/Fixture/Collector/peer-exchange.mjs", remoteRuntime: "C:/Fixture/Data"), includeUbuntu: false)
    precondition((try? pairingRequest.validate()) != nil)
    let invalidPairingRequest = PairingSetupRequest(transport: PairingTransport(kind: "ssh-windows", hostAlias: "-oBad",
        remoteNode: "C:/Fixture/Runtime/node.exe", remoteScript: "C:/Fixture/Collector/peer-exchange.mjs", remoteRuntime: "C:/Fixture/Data"), includeUbuntu: false)
    precondition((try? invalidPairingRequest.validate()) == nil)
    for (index, level) in DashboardZoom.levels.enumerated() {
        precondition(DashboardZoom.step(from: level, increasing: true) == DashboardZoom.levels[min(index + 1, DashboardZoom.levels.count - 1)])
        precondition(DashboardZoom.step(from: level, increasing: false) == DashboardZoom.levels[max(index - 1, 0)])
    }
    precondition(DashboardZoom.step(from: .nan, increasing: true) == 1)
    precondition(DashboardZoom.step(from: .infinity, increasing: false) == 1)
    precondition(DashboardZoom.step(from: 1.3, increasing: true) == 1.5)
    precondition(DashboardZoom.step(from: 1.3, increasing: false) == 1.25)
    precondition(DashboardZoom.shortcut("=", from: 1) == 1.25)
    precondition(DashboardZoom.shortcut("+", from: 1) == 1.25)
    precondition(DashboardZoom.shortcut("-", from: 1) == 0.75)
    precondition(DashboardZoom.shortcut("0", from: 2) == 1)
    precondition(DashboardZoom.shortcut("c", from: 1) == nil)
    precondition((try? CollectorConfiguration.validate([:])) == CollectorConfiguration.defaults)
    precondition((try? CollectorConfiguration.validate(["wispr": true]))?["wispr"] == true)
    precondition((try? CollectorConfiguration.validate(["codex": 1])) == nil)
    precondition((try? CollectorConfiguration.validate(["remote": true])) == nil)
    precondition((try? CollectorConfiguration.validate(["wispr": "true"])) == nil)
    do {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("observatory-config-test-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }
        let prepared = try CollectorConfiguration.prepare(runtime: directory)
        let initial = try CollectorConfiguration.read(runtime: directory)
        precondition(prepared && initial == CollectorConfiguration.defaults)
        try CollectorConfiguration.save(["activity": false, "codex": false, "wispr": true, "typewhisper": false], runtime: directory)
        let updated = try CollectorConfiguration.read(runtime: directory)
        precondition(updated["wispr"] == true)
        let config = directory.appendingPathComponent("collector.config.json")
        try Data("{\"codex\":1}".utf8).write(to: config)
        precondition((try? CollectorConfiguration.prepare(runtime: directory)) == nil)
        try FileManager.default.removeItem(at: config)
        try Data("{}".utf8).write(to: directory.appendingPathComponent("local.config.json"))
        let legacy = try CollectorConfiguration.prepare(runtime: directory)
        precondition(legacy == false)
        precondition(!FileManager.default.fileExists(atPath: config.path))
    } catch { preconditionFailure("Collector configuration self-test failed") }
    precondition(number(true) == nil)
    precondition(number(-1) == nil)
    precondition(number(Double.infinity) == nil)
    precondition(number(0) == 0)
    precondition(formatted(nil) == "Unknown")
    precondition(parseDate("2026-09-08T20:00:00.123Z") != nil)
    precondition(parseDate("2026-09-08T20:00:00Z") != nil)
    let source: JSONObject = ["host": "Mac", "status": "ok", "source": "Wispr Flow", "days": [
        ["date": "2026-09-08", "audioSeconds": 60], ["date": "2026-09-07", "audioSeconds": 20]]]
    let snapshot = Snapshot(object: ["dictation": [source], "activity": [["host": "Windows", "status": "unavailable"]]])
    precondition(number(snapshot.latest("dictation", host: "Mac", source: "Wispr Flow")?["audioSeconds"]) == 60)
    precondition(snapshot.latest("dictation", host: "Windows", source: "Wispr Flow") == nil)
    precondition(snapshot.latest("dictation", host: "Mac", source: "TypeWhisper") == nil)
    precondition(snapshot.sourceCounts.read == 1 && snapshot.sourceCounts.total == 2)
    let combined = Snapshot(object: [
        "combined": ["status": "ok", "days": [["date": "2026-09-08", "seconds": 90]]],
        "combinedTokens": ["status": "ok", "verification": ["status": "verified"],
                           "days": [["date": "2026-09-08", "totalTokens": 600]]],
        "dictation": [source]])
    precondition(number(combined.latest("activity", host: "All")?["seconds"]) == 90)
    precondition(number(combined.latest("tokens", host: "All")?["totalTokens"]) == 600)
    precondition(combined.latest("dictation", host: "All", source: "Wispr Flow") == nil)
    let unverified = Snapshot(object: ["combinedTokens": ["status": "ok",
        "days": [["date": "2026-09-08", "totalTokens": 600]]]])
    precondition(unverified.latest("tokens", host: "All") == nil)
    precondition(snapshot.latest("activity", host: "All") == nil)
    let unavailable = Snapshot(object: ["combined": ["status": "unavailable",
        "days": [["date": "2026-09-08", "seconds": 90]]]])
    precondition(unavailable.latest("activity", host: "All") == nil)
    let resolver = AssetResolver(root: URL(fileURLWithPath: "/tmp/observatory-test-assets"))
    precondition(resolver.resolve(URL(string: "observatory://app/index.html")!) != nil)
    precondition(resolver.resolve(URL(string: "observatory://app/assets/app.js")!) != nil)
    for url in ["https://app/index.html", "observatory://other/index.html", "observatory://app/../secret.json",
                "observatory://app/%2e%2e/secret.json", "observatory://app/local/usage.json",
                "observatory://app/.env", "observatory://app/native-runtime.json/../../secret.json",
                "observatory://user@app/index.html", "observatory://app:80/index.html"] {
        precondition(resolver.resolve(URL(string: url)!) == nil, "Unsafe asset URL accepted")
    }
    print("Native self-tests passed")
}

func runCollectorSelfTest() {
    do {
        guard let resources = Bundle.main.resourceURL else { throw CocoaError(.fileReadNoSuchFile) }
        let runtime = FileManager.default.temporaryDirectory.appendingPathComponent("observatory-collector-test-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: runtime) }
        _ = try CollectorConfiguration.prepare(runtime: runtime)
        try CollectorConfiguration.save(Dictionary(uniqueKeysWithValues: CollectorConfiguration.defaults.keys.map { ($0, false) }), runtime: runtime)
        let launch = try CollectorConfiguration.launch(runtime: runtime, resources: resources, local: true)
        let task = Process()
        task.executableURL = launch.executable
        task.arguments = launch.arguments
        task.currentDirectoryURL = runtime
        task.environment = ["PATH": "/usr/bin:/bin", "HOME": runtime.path]
        try task.run()
        task.waitUntilExit()
        precondition(task.terminationStatus == 0)
        let object = readObject(runtime.appendingPathComponent("public/local/usage.json"))
        precondition(number(object?["schema"]) == 2)
        let status = readObject(runtime.appendingPathComponent("public/local/collector.json"))
        precondition(number(status?["sourcesConfigured"]) == 0)
        let configFile = runtime.appendingPathComponent("collector.config.json")
        let originalConfig = try Data(contentsOf: configFile)
        let setupStatus = try PairingSetup.readStatus(runtime: runtime, resources: resources)
        precondition(setupStatus.status == .unpaired && setupStatus.request == nil)
        precondition(!FileManager.default.fileExists(atPath: runtime.appendingPathComponent("private-sync").path))
        try PairingMaintenance.runDisconnect(runtime: runtime, resources: resources)
        try PairingMaintenance.runDisconnect(runtime: runtime, resources: resources)
        precondition(FileManager.default.fileExists(atPath: runtime.appendingPathComponent("private-sync/revoked").path))
        let retainedConfig = try Data(contentsOf: configFile)
        precondition(retainedConfig == originalConfig)
        let disabledStatus = try PairingSetup.readStatus(runtime: runtime, resources: resources)
        precondition(disabledStatus.status == .needsRepair && disabledStatus.request == nil)
        print("Packaged pairing status self-test passed without exposing private credentials")
        print("Packaged pairing revocation self-test passed with temporary data")
        print("Packaged collector self-test passed with all sources disabled")
    } catch {
        FileHandle.standardError.write(Data("Packaged collector self-test error code: \((error as NSError).code)\n".utf8))
        preconditionFailure("Packaged collector self-test failed")
    }
}
