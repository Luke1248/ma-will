//
//  CitationText.swift
//  BluebookCiteTester
//
//  Renders a citation as a single Text view, concatenating its segments. When
//  `revealed` is true, error runs are shown in red with a strikethrough — the
//  requested behavior of putting the incorrect portion in red.
//

import SwiftUI

struct CitationText: View {
    let citation: Citation
    let revealed: Bool

    var body: some View {
        composed
            .font(.system(.title3, design: .serif))
            .lineSpacing(5)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var composed: Text {
        citation.segments.reduce(Text("")) { acc, seg in
            var piece = Text(seg.text)
            if seg.italic { piece = piece.italic() }
            if seg.isError && revealed {
                piece = piece.foregroundColor(Theme.errorRed).strikethrough(true, color: Theme.errorRed)
            }
            return acc + piece
        }
    }
}

/// The corrected Bluebook form, with the fixed text highlighted in green.
struct CorrectedText: View {
    let citation: Citation

    var body: some View {
        composed
            .font(.system(.body, design: .serif))
            .foregroundStyle(Theme.okGreen)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var composed: Text {
        citation.segments.reduce(Text("")) { acc, seg in
            let value = seg.isError ? seg.fix : seg.text
            guard !value.isEmpty else { return acc }
            var piece = Text(value)
            if seg.italic { piece = piece.italic() }
            if seg.isError { piece = piece.bold() }
            return acc + piece
        } + Text("  ✅")
    }
}
