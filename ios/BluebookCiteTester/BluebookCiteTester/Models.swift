//
//  Models.swift
//  BluebookCiteTester
//
//  Core data types for the citation accuracy tester. A citation is stored as an
//  ordered list of segments so the UI can render the *incorrect* portion of a
//  flawed citation in red, and reconstruct the corrected Bluebook form.
//

import Foundation

/// One run of text inside a citation.
struct CiteSegment: Identifiable, Hashable {
    let id = UUID()
    let text: String
    /// True if this run is the part of the citation that violates a Bluebook rule.
    var isError: Bool = false
    /// The corrected text for an error run ("" means the run should be deleted).
    var fix: String = ""
    /// True for runs that should be italicized (e.g., titles of books/articles).
    var italic: Bool = false
}

/// Convenience builders for the citation bank.
func t(_ s: String, italic: Bool = false) -> CiteSegment {
    CiteSegment(text: s, italic: italic)
}
func bad(_ s: String, fix: String) -> CiteSegment {
    CiteSegment(text: s, isError: true, fix: fix)
}

/// The categories of authority tested, mirroring the rule areas in
/// The Bluebook (22nd ed.). Includes the rules unique to the 22nd edition:
/// Rule 22 (Tribal Nations) and Rule 23 (Archival Sources).
enum SourceCategory: String, CaseIterable, Identifiable {
    case cases          = "Cases"
    case constitutions  = "Constitutions"
    case statutes       = "Statutes"
    case legislative    = "Legislative Materials"
    case administrative = "Administrative & Regulatory"
    case books          = "Books & Treatises"
    case periodicals    = "Periodicals"
    case internet       = "Internet & Electronic"
    case courtDocs      = "Court Documents"
    case foreign        = "Foreign Materials"
    case international  = "International Materials"
    case tribal         = "Tribal Nations"
    case archival       = "Archival Sources"

    var id: String { rawValue }

    /// Governing Bluebook rule, shown as a chip.
    var ruleArea: String {
        switch self {
        case .cases:          return "Rule 10"
        case .constitutions:  return "Rule 11"
        case .statutes:       return "Rule 12"
        case .legislative:    return "Rule 13"
        case .administrative: return "Rule 14"
        case .books:          return "Rule 15"
        case .periodicals:    return "Rule 16"
        case .internet:       return "Rule 18"
        case .courtDocs:      return "Bluepages B17"
        case .foreign:        return "Rule 20"
        case .international:  return "Rule 21"
        case .tribal:         return "Rule 22"
        case .archival:       return "Rule 23"
        }
    }

    /// SF Symbol used in the category picker and chips.
    var symbol: String {
        switch self {
        case .cases:          return "building.columns"
        case .constitutions:  return "scroll"
        case .statutes:       return "text.book.closed"
        case .legislative:    return "doc.text"
        case .administrative: return "checkmark.seal"
        case .books:          return "books.vertical"
        case .periodicals:    return "newspaper"
        case .internet:       return "globe"
        case .courtDocs:      return "folder"
        case .foreign:        return "globe.europe.africa"
        case .international:  return "network"
        case .tribal:         return "sun.max"
        case .archival:       return "archivebox"
        }
    }
}

/// A single citation question.
struct Citation: Identifiable, Hashable {
    let id = UUID()
    let category: SourceCategory
    /// Specific rule reference (e.g., "R10.2.1 · T6").
    let rule: String
    /// Difficulty on a 1...5 scale.
    let difficulty: Int
    /// True when the displayed citation is already correct Bluebook form.
    let isCorrect: Bool
    let segments: [CiteSegment]
    /// Explanation referencing the governing Bluebook rule.
    let explanation: String

    /// The displayed citation as plain text.
    var displayText: String {
        segments.map(\.text).joined()
    }

    /// The corrected Bluebook form (replaces error runs with their fix).
    var correctedText: String {
        let joined = segments.map { $0.isError ? $0.fix : $0.text }.joined()
        // Collapse any double spaces left by deleted runs.
        return joined.replacingOccurrences(of: "  ", with: " ")
                     .replacingOccurrences(of: " .", with: ".")
    }
}
