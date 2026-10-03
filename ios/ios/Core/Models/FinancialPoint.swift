import Foundation

struct FinancialPoint: Identifiable {
    let symbol: String
    let date: Date
    let period: String
    let revenue: Double?
    let netIncome: Double?
    let freeCashFlow: Double?
    var id: String { "\(symbol)-\(period)-\(date.timeIntervalSince1970)" }
}

enum FinancialSeries: String, CaseIterable, Identifiable {
    case revenue = "Revenue"
    case netIncome = "Net income"
    case freeCashFlow = "Free cash flow"
    var id: String { rawValue }
    func value(from point: FinancialPoint) -> Double? {
        switch self {
        case .revenue: point.revenue
        case .netIncome: point.netIncome
        case .freeCashFlow: point.freeCashFlow
        }
    }
}
