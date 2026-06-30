//
//  QuizView.swift
//  BluebookCiteTester
//
//  The drill screen: shows one citation, takes the user's correct/incorrect
//  judgment, then reveals the verdict — incorrect portions in red, correct
//  citations marked with a check, plus the governing rule.
//

import SwiftUI

struct QuizView: View {
    @StateObject var viewModel: QuizViewModel

    var body: some View {
        ZStack {
            Theme.parchment.ignoresSafeArea()
            if let citation = viewModel.current {
                ScrollView {
                    VStack(spacing: 18) {
                        scoreBar
                        card(for: citation)
                    }
                    .padding()
                }
            } else {
                ContentUnavailableView("No citations match",
                                       systemImage: "magnifyingglass",
                                       description: Text("Try a different category or difficulty."))
            }
        }
        .navigationTitle("Drill")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Score bar

    private var scoreBar: some View {
        HStack {
            stat(value: "\(viewModel.score)", label: "Correct")
            Divider().frame(height: 28)
            stat(value: "\(viewModel.answered)", label: "Answered")
            Divider().frame(height: 28)
            stat(value: viewModel.accuracyText, label: "Accuracy")
            Spacer()
            Text(viewModel.progressText)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
    }

    private func stat(value: String, label: String) -> some View {
        VStack(spacing: 1) {
            Text(value).font(.headline).foregroundStyle(Theme.navy)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }

    // MARK: Card

    private func card(for citation: Citation) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Chip(text: citation.category.rawValue, systemImage: citation.category.symbol)
                Chip(text: citation.rule,
                     background: Theme.gold.opacity(0.18),
                     foreground: Color(red: 0.42, green: 0.34, blue: 0.20))
                Spacer()
                StarRating(level: citation.difficulty)
            }

            Text("Is this citation correct under The Bluebook (22nd ed.)?")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            CitationText(citation: citation, revealed: viewModel.revealed)
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.parchment, in: RoundedRectangle(cornerRadius: 10))
                .overlay(alignment: .topTrailing) {
                    if viewModel.revealed && citation.isCorrect {
                        Text("✅").font(.title3).padding(8)
                    }
                }

            if !viewModel.revealed {
                answerButtons
            } else {
                feedback(for: citation)
            }

            navButtons
        }
        .padding(18)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Theme.gold.opacity(0.5), lineWidth: 1)
        )
    }

    private var answerButtons: some View {
        HStack(spacing: 12) {
            Button { viewModel.answer(saysCorrect: true) } label: {
                Label("Correct", systemImage: "checkmark")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
            }
            .tint(Theme.okGreen)
            Button { viewModel.answer(saysCorrect: false) } label: {
                Label("Has an error", systemImage: "xmark")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
            }
            .tint(Theme.errorRed)
        }
        .buttonStyle(.bordered)
    }

    private func feedback(for citation: Citation) -> some View {
        let right = viewModel.lastAnswerCorrect == true
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: right ? "checkmark.circle.fill" : "xmark.circle.fill")
                Text(right ? "Correct — you got it." : "Not quite.")
                    + Text("  This citation is \(citation.isCorrect ? "properly formatted." : "incorrect.")")
                    .foregroundColor(.primary)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(right ? Theme.okGreen : Theme.errorRed)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background((right ? Theme.okGreen : Theme.errorRed).opacity(0.10),
                        in: RoundedRectangle(cornerRadius: 8))

            if !citation.isCorrect {
                VStack(alignment: .leading, spacing: 4) {
                    Text("CORRECTED BLUEBOOK FORM")
                        .font(.caption2.weight(.bold)).tracking(1)
                        .foregroundStyle(.secondary)
                    CorrectedText(citation: citation)
                }
            }

            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "book.closed").foregroundStyle(Theme.gold)
                Text(citation.explanation).font(.footnote)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.gold.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private var navButtons: some View {
        HStack {
            Button { viewModel.previous() } label: {
                Label("Prev", systemImage: "chevron.left")
            }
            .buttonStyle(.bordered)
            .tint(.secondary)

            Spacer()

            Button { viewModel.next() } label: {
                Label("Next", systemImage: "chevron.right")
                    .fontWeight(.semibold)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.navy)
        }
    }
}
