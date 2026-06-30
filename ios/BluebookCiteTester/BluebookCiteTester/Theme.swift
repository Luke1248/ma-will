//
//  Theme.swift
//  BluebookCiteTester
//
//  Shared colors and small view helpers, echoing the Bluebook's navy/gold look.
//

import SwiftUI

enum Theme {
    static let navy   = Color(red: 0.043, green: 0.145, blue: 0.271) // #0b2545
    static let navy2  = Color(red: 0.075, green: 0.192, blue: 0.361) // #13315c
    static let gold   = Color(red: 0.690, green: 0.553, blue: 0.341) // #b08d57
    static let parchment = Color(red: 0.957, green: 0.945, blue: 0.918) // #f4f1ea
    static let errorRed  = Color(red: 0.753, green: 0.094, blue: 0.169) // #c0182b
    static let okGreen   = Color(red: 0.102, green: 0.490, blue: 0.235) // #1a7d3c
}

/// Difficulty rendered as filled/empty stars.
struct StarRating: View {
    let level: Int
    var body: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { i in
                Image(systemName: i <= level ? "star.fill" : "star")
                    .font(.caption2)
                    .foregroundStyle(i <= level ? Theme.gold : Color.gray.opacity(0.35))
            }
        }
        .accessibilityLabel("Difficulty \(level) of 5")
    }
}

/// A small rounded chip used for category and rule labels.
struct Chip: View {
    let text: String
    var systemImage: String? = nil
    var background: Color = Theme.navy.opacity(0.08)
    var foreground: Color = Theme.navy2
    var body: some View {
        HStack(spacing: 4) {
            if let systemImage { Image(systemName: systemImage).font(.caption2) }
            Text(text).font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(background, in: Capsule())
        .foregroundStyle(foreground)
    }
}
