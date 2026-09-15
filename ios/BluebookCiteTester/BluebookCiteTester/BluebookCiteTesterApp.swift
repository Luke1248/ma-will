//
//  BluebookCiteTesterApp.swift
//  BluebookCiteTester
//
//  App entry point.
//

import SwiftUI

@main
struct BluebookCiteTesterApp: App {
    var body: some Scene {
        WindowGroup {
            HomeView()
                .tint(Theme.navy)
        }
    }
}
