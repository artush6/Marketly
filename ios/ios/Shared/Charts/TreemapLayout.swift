import CoreGraphics
import Foundation

/// Squarified treemap: rows are added while their worst aspect ratio improves.
/// Output rectangles preserve weight proportions and fill the available bounds.
enum TreemapLayout {
    struct Tile: Identifiable {
        let id: String
        let rect: CGRect
    }

    static func tiles(weights: [(String, Double)], in bounds: CGRect) -> [Tile] {
        let valid = weights.filter { $0.1.isFinite && $0.1 > 0 }.sorted { $0.1 > $1.1 }

        let total = valid.reduce(0) { $0 + $1.1 }

        guard total > 0, bounds.width > 0, bounds.height > 0 else { return [] }

        var remaining = valid.map { ($0.0, $0.1 / total * bounds.width * bounds.height) }

        var rect = bounds
        var output: [Tile] = []
        func worst(_ row: [(String, Double)], _ side: Double) -> Double {
            let sum = row.reduce(0) { $0 + $1.1 }

            guard let min = row.map(\.1).min(), let max = row.map(\.1).max(), min > 0, sum > 0,
                side > 0
            else { return .infinity }

            return Swift.max(side * side * max / (sum * sum), sum * sum / (side * side * min))
        }

        while !remaining.isEmpty {
            var row = [remaining.removeFirst()]
            let side = min(rect.width, rect.height)
            while let next = remaining.first, worst(row + [next], side) <= worst(row, side) {
                row.append(remaining.removeFirst())
            }

            let area = row.reduce(0) { $0 + $1.1 }

            if rect.width >= rect.height {
                let width = area / max(rect.height, 0.0001)
                var y = rect.minY
                for item in row {
                    let height = item.1 / max(width, 0.0001)
                    output.append(
                        Tile(
                            id: item.0,
                            rect: CGRect(x: rect.minX, y: y, width: width, height: height)))
                    y += height
                }

                rect.origin.x += width
                rect.size.width = max(0, rect.width - width)
            } else {
                let height = area / max(rect.width, 0.0001)
                var x = rect.minX
                for item in row {
                    let width = item.1 / max(height, 0.0001)
                    output.append(
                        Tile(
                            id: item.0,
                            rect: CGRect(x: x, y: rect.minY, width: width, height: height)))
                    x += width
                }

                rect.origin.y += height
                rect.size.height = max(0, rect.height - height)
            }
        }

        return output
    }
}
