//
//  QuizViewModel.swift
//  BluebookCiteTester
//
//  Holds the filtered deck, the current position, reveal state, and the score.
//

import SwiftUI

@MainActor
final class QuizViewModel: ObservableObject {
    @Published private(set) var deck: [Citation] = []
    @Published private(set) var index = 0
    @Published private(set) var revealed = false
    @Published private(set) var lastAnswerCorrect: Bool? = nil

    @Published private(set) var answered = 0
    @Published private(set) var score = 0

    let category: SourceCategory?      // nil == all categories
    let difficulty: Int?               // nil == all difficulties

    init(category: SourceCategory?, difficulty: Int?) {
        self.category = category
        self.difficulty = difficulty
        self.deck = QuizViewModel.buildDeck(category: category, difficulty: difficulty)
    }

    static func buildDeck(category: SourceCategory?, difficulty: Int?) -> [Citation] {
        CitationBank.all.filter { c in
            (category == nil || c.category == category) &&
            (difficulty == nil || c.difficulty == difficulty)
        }
    }

    var current: Citation? {
        guard deck.indices.contains(index) else { return nil }
        return deck[index]
    }

    var progressText: String {
        deck.isEmpty ? "0 of 0" : "\(index + 1) of \(deck.count)"
    }

    var accuracyText: String {
        answered == 0 ? "—" : "\(Int((Double(score) / Double(answered) * 100).rounded()))%"
    }

    /// Records the user's answer and reveals the result.
    func answer(saysCorrect: Bool) {
        guard let current, !revealed else { return }
        revealed = true
        let right = (saysCorrect == current.isCorrect)
        lastAnswerCorrect = right
        answered += 1
        if right { score += 1 }
    }

    func next() {
        guard !deck.isEmpty else { return }
        index = (index + 1) % deck.count
        revealed = false
        lastAnswerCorrect = nil
    }

    func previous() {
        guard !deck.isEmpty else { return }
        index = (index - 1 + deck.count) % deck.count
        revealed = false
        lastAnswerCorrect = nil
    }
}
