//
//  HomeView.swift
//  BluebookCiteTester
//
//  Landing screen: pick a source category and difficulty, then start a drill.
//

import SwiftUI

struct HomeView: View {
    @State private var category: SourceCategory? = nil
    @State private var difficulty: Int? = nil

    private var matchCount: Int {
        QuizViewModel.buildDeck(category: category, difficulty: difficulty).count
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    header

                    section(title: "Source category") {
                        FlowLayout(spacing: 8) {
                            selectChip(title: "All", icon: "square.grid.2x2",
                                       selected: category == nil) { category = nil }
                            ForEach(SourceCategory.allCases) { cat in
                                selectChip(title: cat.rawValue, icon: cat.symbol,
                                           selected: category == cat) { category = cat }
                            }
                        }
                    }

                    section(title: "Difficulty") {
                        FlowLayout(spacing: 8) {
                            selectChip(title: "All", icon: "infinity",
                                       selected: difficulty == nil) { difficulty = nil }
                            ForEach(1...5, id: \.self) { d in
                                selectChip(title: stars(d), icon: nil,
                                           selected: difficulty == d) { difficulty = d }
                            }
                        }
                    }

                    NavigationLink {
                        QuizView(viewModel: QuizViewModel(category: category, difficulty: difficulty))
                    } label: {
                        Text(matchCount == 0 ? "No citations match" : "Start drill  ·  \(matchCount) citations")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.navy)
                    .disabled(matchCount == 0)

                    Text("\(CitationBank.all.count) real citations from The Bluebook (22nd ed.), across \(SourceCategory.allCases.count) categories of authority — including the 22nd edition's new Rule 22 (Tribal Nations) and Rule 23 (Archival Sources).")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)
                }
                .padding()
            }
            .background(Theme.parchment.ignoresSafeArea())
            .navigationTitle("Bluebook Tester")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var header: some View {
        VStack(spacing: 6) {
            Image(systemName: "books.vertical.fill")
                .font(.system(size: 38))
                .foregroundStyle(Theme.gold)
            Text("Citation Accuracy Tester")
                .font(.system(.title, design: .serif).weight(.bold))
                .foregroundStyle(Theme.navy)
                .multilineTextAlignment(.center)
            Text("The Bluebook · 22nd Edition")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    private func section<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.caption.weight(.bold))
                .tracking(1)
                .foregroundStyle(.secondary)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
    }

    private func selectChip(title: String, icon: String?, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let icon { Image(systemName: icon).font(.caption2) }
                Text(title).font(.subheadline.weight(.medium))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(selected ? Theme.navy : Color.gray.opacity(0.12),
                        in: Capsule())
            .foregroundStyle(selected ? .white : Theme.navy2)
        }
        .buttonStyle(.plain)
    }

    private func stars(_ n: Int) -> String {
        String(repeating: "★", count: n)
    }
}

/// A simple wrapping HStack so chips flow onto multiple lines.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rows: [[LayoutSubviews.Element]] = [[]]
        var x: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0
        for sv in subviews {
            let size = sv.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, !rows[rows.count - 1].isEmpty {
                rows.append([])
                totalHeight += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            rows[rows.count - 1].append(sv)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for sv in subviews {
            let size = sv.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sv.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
