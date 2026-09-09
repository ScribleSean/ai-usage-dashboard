import Foundation

enum DashboardZoom {
    static let levels: [Double] = [0.75, 1, 1.25, 1.5, 1.75, 2]

    static func step(from current: Double, increasing: Bool) -> Double {
        guard current.isFinite else { return 1 }
        if increasing { return levels.first(where: { $0 > current + 0.001 }) ?? 2 }
        return levels.last(where: { $0 < current - 0.001 }) ?? 0.75
    }
}
