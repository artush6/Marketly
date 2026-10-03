import Foundation

struct LocalResearchService {
    let defaults: UserDefaults
    let key: String

    func load() -> [SavedResearchItem] {
        guard let data = defaults.data(forKey: key),
            let saved = try? JSONDecoder().decode([SavedResearchItem].self, from: data)
        else { return [] }
        return saved.sorted { $0.savedAt > $1.savedAt }
    }

    func save(_ item: SavedResearchItem) {
        var saved = load().filter { $0.symbol != item.symbol }
        saved.insert(item, at: 0)
        defaults.set(try? JSONEncoder().encode(saved), forKey: key)
    }

    func remove(symbol: String) {
        let saved = load().filter { $0.symbol != symbol }
        defaults.set(try? JSONEncoder().encode(saved), forKey: key)
    }

    func replace(with items: [SavedResearchItem]) {
        defaults.set(try? JSONEncoder().encode(items), forKey: key)
    }
}
