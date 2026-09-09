import Foundation

func runSelfTests() {
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
