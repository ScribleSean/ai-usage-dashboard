import Foundation
import CoreFoundation

typealias JSONObject = [String: Any]

func number(_ value: Any?) -> Double? {
    guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID() else { return nil }
    let result = value.doubleValue
    return result.isFinite && result >= 0 ? result : nil
}

func rows(_ value: Any?) -> [JSONObject] { value as? [JSONObject] ?? [] }
func text(_ value: Any?, fallback: String = "Unknown") -> String { value as? String ?? fallback }

func readObject(_ url: URL) -> JSONObject? {
    guard let size = try? url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey]),
          size.isRegularFile == true, let count = size.fileSize, count <= 16_000_000,
          let data = try? Data(contentsOf: url),
          let value = try? JSONSerialization.jsonObject(with: data) as? JSONObject else { return nil }
    return value
}

func parseDate(_ value: Any?) -> Date? {
    guard let value = value as? String else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: value)
}

func formatted(_ value: Double?, compact: Bool = false) -> String {
    guard let value else { return "Unknown" }
    if compact && value >= 1_000_000 { return String(format: "%.1fM", value / 1_000_000) }
    if compact && value >= 1_000 { return String(format: "%.1fK", value / 1_000) }
    return value.formatted(.number.precision(.fractionLength(0...1)))
}

struct Snapshot {
    let object: JSONObject
    var collectedAt: Date? { parseDate(object["collectedAt"]) }
    var quotaWindows: [JSONObject] {
        guard let quota = object["quota"] as? JSONObject, text(quota["status"]) == "ok" else { return [] }
        return rows(quota["windows"])
    }
    var sourceCounts: (read: Int, total: Int) {
        var sources = ["activity", "tokens", "settings", "dictation"].flatMap { rows(object[$0]) }
        sources += ["quota", "localModel", "agentSource"].compactMap { object[$0] as? JSONObject }
        sources = sources.filter { text($0["status"]) != "not-connected" }
        return (sources.filter { text($0["status"]) == "ok" }.count, sources.count)
    }
    func latest(_ key: String, host: String, source: String? = nil) -> JSONObject? {
        let selected: JSONObject?
        if host == "All" {
            // Reuse collector-verified aggregates. Never sum device snapshots here.
            if key == "activity" { selected = object["combined"] as? JSONObject }
            else if key == "tokens" {
                let combined = object["combinedTokens"] as? JSONObject
                guard let verification = combined?["verification"] as? JSONObject,
                      text(verification["status"]) == "verified" else { return nil }
                selected = combined
            } else { return nil }
        } else {
            selected = rows(object[key]).first(where: {
                text($0["host"]) == host && (source == nil || text($0["source"]) == source)
            })
        }
        guard let item = selected, text(item["status"]) == "ok" else { return nil }
        return rows(item["days"]).sorted { text($0["date"]) < text($1["date"]) }.last
    }
}

struct AssetResolver {
    let root: URL
    func resolve(_ url: URL) -> URL? {
        guard url.scheme == "observatory", url.host == "app", url.user == nil, url.password == nil,
              url.port == nil else { return nil }
        let path = url.path == "/" || url.path.isEmpty ? "index.html" : String(url.path.dropFirst())
        guard !path.split(separator: "/").contains(".."), !path.contains("\\"),
              !path.contains("\0"), !path.hasPrefix("local/"), !path.hasPrefix(".") else { return nil }
        let base = root.standardizedFileURL.resolvingSymlinksInPath()
        let file = base.appendingPathComponent(path).standardizedFileURL.resolvingSymlinksInPath()
        guard file.path.hasPrefix(base.path + "/"),
              ["html", "js", "css", "svg", "png", "ico", "woff2", "woff", "json"].contains(file.pathExtension) else { return nil }
        return file
    }
}
