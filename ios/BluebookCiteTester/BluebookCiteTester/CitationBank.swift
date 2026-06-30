//
//  CitationBank.swift
//  BluebookCiteTester
//
//  The question bank. Every citation here is grounded in the provided text of
//  The Bluebook: A Uniform System of Citation (22nd ed.). Correct forms and the
//  "Not:" (incorrect) counter-examples are taken from the Bluebook's own rule
//  illustrations, so the right/wrong determinations track the source document.
//
//  Covered categories include the rules unique to the 22nd edition:
//  Rule 22 (Tribal Nations) and Rule 23 (Archival Sources).
//

import Foundation

enum CitationBank {

    static let all: [Citation] = cases + constitutions + statutes + legislative
        + administrative + books + periodicals + internet + courtDocs
        + foreign + international + tribal + archival

    // MARK: - Cases (Rule 10)

    static let cases: [Citation] = [
        Citation(category: .cases, rule: "R10.3.1", difficulty: 1, isCorrect: true,
            segments: [t("Lochner v. New York, 198 U.S. 45 (1905).")],
            explanation: "Textbook full citation — case name, volume U.S. page, and year. U.S. Supreme Court opinions are cited to the United States Reports (U.S.). Rule 10.3.1 & T1."),

        Citation(category: .cases, rule: "R10 · B10", difficulty: 1, isCorrect: true,
            segments: [t("Baker v. Carr, 369 U.S. 186, 195 (1962).")],
            explanation: "Pincite to page 195 follows the first page of the case, separated by a comma. Rule 10.1.2 (Bluepages B10)."),

        Citation(category: .cases, rule: "R10.4(b)", difficulty: 2, isCorrect: false,
            segments: [t("People v. Armour, 590 N.W.2d 61 ("),
                       bad("Mich. Sup. Ct.", fix: "Mich."),
                       t(" 1999).")],
            explanation: "When a state's highest court is the deciding court, the court parenthetical is just the jurisdiction abbreviation; do not add \"Sup. Ct.\" The Bluebook gives this exact example: \"(Mich. 1999). Not: (Mich. Sup. Ct. 1999).\" Rule 10.4(b)."),

        Citation(category: .cases, rule: "R10.2.1(f)", difficulty: 2, isCorrect: false,
            segments: [t("Blystone v. "),
                       bad("Commonwealth of Pennsylvania", fix: "Pennsylvania"),
                       t(", 494 U.S. 299 (1990).")],
            explanation: "Omit \"Commonwealth of,\" \"State of,\" and \"People of\" from a party's name (except as the Bluebook specifies). The Bluebook example: \"Blystone v. Pennsylvania ... Not: Blystone v. Commonwealth of Pennsylvania.\" Rule 10.2.1(f)."),

        Citation(category: .cases, rule: "R10.2.1(f)", difficulty: 3, isCorrect: false,
            segments: [t("City of Arlington"),
                       bad(", Texas", fix: ""),
                       t(" v. FCC, 569 U.S. 290 (2013).")],
            explanation: "Omit geographical designations that follow a comma in a party's name. The Bluebook example: \"City of Arlington v. FCC. Not: City of Arlington, Texas v. FCC.\" Rule 10.2.1(f)."),

        Citation(category: .cases, rule: "R10.4(b)", difficulty: 3, isCorrect: false,
            segments: [t("DiLucia v. Mandelker, 493 N.Y.S.2d 769 ("),
                       bad("N.Y. App. Div.", fix: "App. Div."),
                       t(" 1985).")],
            explanation: "Do not repeat jurisdiction information already conveyed by the reporter. N.Y.S.2d already shows New York, so the parenthetical is just \"App. Div.\" The Bluebook example confirms: \"(App. Div. 1985). Not: (N.Y. App. Div. 1985).\" Rule 10.4(b)."),

        Citation(category: .cases, rule: "R10.6.1", difficulty: 3, isCorrect: true,
            segments: [t("Parker v. Randolph, 442 U.S. 62, 84 (1979) (Stevens, J., dissenting).")],
            explanation: "A weight-of-authority parenthetical (here, that the cited page is from a dissent) follows the date parenthetical. Rule 10.6.1."),

        Citation(category: .cases, rule: "R10.3.2", difficulty: 4, isCorrect: false,
            segments: [t("Green v. Biddle, "),
                       bad("21 U.S. 1", fix: "21 U.S. (8 Wheat.) 1"),
                       t(" (1823).")],
            explanation: "Early Supreme Court volumes include the nominative reporter in parentheses. The Bluebook example: \"Green v. Biddle, 21 U.S. (8 Wheat.) 1 (1823).\" Rule 10.3.2 & T1."),

        Citation(category: .cases, rule: "R10.2.1(c) · T6", difficulty: 4, isCorrect: true,
            segments: [t("Nat'l R.R. Passenger Corp. v. Morgan, 536 U.S. 101, 110 (2002).")],
            explanation: "Correctly abbreviated case name: National→Nat'l, Railroad→R.R., Corporation→Corp. (Table T6). The Bluebook uses this exact form. Rule 10.2.1(c) & T6."),

        Citation(category: .cases, rule: "R10.9(a)", difficulty: 5, isCorrect: false,
            segments: [t("(Short form after full citation to Reno v. Bossier Parish School Board:)  "),
                       bad("Reno", fix: "Bossier Parish Sch. Bd."),
                       t(", 520 U.S. at 480.")],
            explanation: "In a short form, avoid using the name of a governmental party or official (here, Attorney General Reno) where another party's name is available. The Bluebook example: \"Reno v. Bossier Parish Sch. Bd. ... becomes: Bossier Parish Sch. Bd., 520 U.S. at 480.\" Rule 10.9(a)."),
    ]

    // MARK: - Constitutions (Rule 11)

    static let constitutions: [Citation] = [
        Citation(category: .constitutions, rule: "R11", difficulty: 1, isCorrect: true,
            segments: [t("U.S. Const. amend. XIV, § 1.")],
            explanation: "A currently effective constitutional provision is cited without a date. Subdivisions: amend. (lowercase), roman numeral, then section. Rule 11."),

        Citation(category: .constitutions, rule: "R11", difficulty: 2, isCorrect: false,
            segments: [t("U.S. Const. amend. XIV, § 1"),
                       bad(" (1868)", fix: ""),
                       t(".")],
            explanation: "Do not give a date for a provision still in force. A year is added only for a provision that has been amended, superseded, or repealed. Rule 11."),

        Citation(category: .constitutions, rule: "R11 · R6", difficulty: 3, isCorrect: false,
            segments: [t("U.S. Const. amend. "),
                       bad("14", fix: "XIV"),
                       t(".")],
            explanation: "Amendments are cited with roman numerals: amend. XIV, not amend. 14. Rule 11."),

        Citation(category: .constitutions, rule: "R11", difficulty: 4, isCorrect: true,
            segments: [t("U.S. Const. art. I, § 3, cl. 1 (amended 1913).")],
            explanation: "When a provision has been amended, indicate the fact and year of amendment parenthetically. The Bluebook gives this exact example. Rule 11."),

        Citation(category: .constitutions, rule: "R11 · R6", difficulty: 4, isCorrect: false,
            segments: [t("U.S. Const. amends. "),
                       bad("5, 14", fix: "V, XIV"),
                       t(".")],
            explanation: "Multiple amendments use roman numerals and a single citation clause: \"amends. V, XIV.\" The Bluebook uses this exact form. Rule 11 & Rule 3.3."),
    ]

    // MARK: - Statutes (Rule 12)

    static let statutes: [Citation] = [
        Citation(category: .statutes, rule: "R12.3", difficulty: 1, isCorrect: true,
            segments: [t("42 U.S.C. § 1983.")],
            explanation: "Citation to the current official U.S. Code: title, U.S.C., and section. The Bluebook gives \"42 U.S.C. § 1983.\" with no date for the current code. Rule 12.3."),

        Citation(category: .statutes, rule: "R12.3 · T1", difficulty: 2, isCorrect: false,
            segments: [t("42 "),
                       bad("USC", fix: "U.S.C."),
                       t(" § 1983.")],
            explanation: "The code is abbreviated with periods: U.S.C. Rule 12.3 & T1."),

        Citation(category: .statutes, rule: "R12.3 · R6.2(c)", difficulty: 2, isCorrect: false,
            segments: [t("42 U.S.C. "),
                       bad("1983", fix: "§ 1983"),
                       t(".")],
            explanation: "A section citation requires the section symbol (§) before the number. Rule 6.2(c) & 12.3."),

        Citation(category: .statutes, rule: "R12.3.1(d)", difficulty: 3, isCorrect: false,
            segments: [t("Cal. Veh. Code § 11509 ("),
                       bad("Cal.", fix: "West"),
                       t(" 2000).")],
            explanation: "The parenthetical names the publisher of the code, not the jurisdiction. The Bluebook example: \"Cal. Veh. Code § 11509 (West 2000). Not: Cal. Veh. Code § 11509 (Cal. 2000).\" Rule 12.3.1(d)."),

        Citation(category: .statutes, rule: "R12.3", difficulty: 3, isCorrect: true,
            segments: [t("Del. Code Ann. tit. 13, § 1301 (1999).")],
            explanation: "A titled state code: name, title number, section, and year. The Bluebook gives this exact example. Rule 12.3."),

        Citation(category: .statutes, rule: "R12.4", difficulty: 4, isCorrect: false,
            segments: [t("Tax Reduction Act of 1975, "),
                       bad("Pub. L. 94-12", fix: "Pub. L. No. 94-12"),
                       t(", 89 Stat. 26.")],
            explanation: "A session-law citation uses \"Pub. L. No.\" — the \"No.\" is required — followed by the Statutes at Large volume and page. The Bluebook example: \"Pub. L. No. 94-12, 89 Stat. 26.\" Rule 12.4."),

        Citation(category: .statutes, rule: "R12.4", difficulty: 5, isCorrect: true,
            segments: [t("Clayton Act, ch. 323, § 7, 38 Stat. 730, 731–32 (1914).")],
            explanation: "A pre-1957 session law cited by chapter, section, Statutes at Large volume/page with a pincite, and year. The Bluebook gives this exact example. Rule 12.4."),
    ]

    // MARK: - Legislative Materials (Rule 13)

    static let legislative: [Citation] = [
        Citation(category: .legislative, rule: "R13.2", difficulty: 2, isCorrect: true,
            segments: [t("Millennium Copyright Act, H.R. 2281, 105th Cong. § 6 (1997).")],
            explanation: "A federal bill: name, chamber and number, Congress, section, and year. The Bluebook gives this exact example. Rule 13.2."),

        Citation(category: .legislative, rule: "R13.2 · T9", difficulty: 3, isCorrect: false,
            segments: [t("Millennium Copyright Act, H.R. 2281, 105th "),
                       bad("Congress", fix: "Cong."),
                       t(" § 6 (1997).")],
            explanation: "\"Congress\" is abbreviated \"Cong.\" in legislative citations. Rule 13.2 & T9."),
    ]

    // MARK: - Administrative & Regulatory (Rule 14)

    static let administrative: [Citation] = [
        Citation(category: .administrative, rule: "R14.2", difficulty: 2, isCorrect: true,
            segments: [t("29 C.F.R. § 1604.11 (2023).")],
            explanation: "A federal regulation: title, C.F.R., section, and year of the C.F.R. edition. Rule 14.2 & T1.2."),

        Citation(category: .administrative, rule: "R14.2 · T1", difficulty: 2, isCorrect: false,
            segments: [t("29 "),
                       bad("CFR", fix: "C.F.R."),
                       t(" § 1604.11 (2023).")],
            explanation: "The Code of Federal Regulations is abbreviated with periods: C.F.R. Rule 14.2 & T1.2."),
    ]

    // MARK: - Books & Treatises (Rule 15)

    static let books: [Citation] = [
        Citation(category: .books, rule: "R15", difficulty: 2, isCorrect: true,
            segments: [t("Matthew Butterick, "),
                       t("Typography for Lawyers", italic: true),
                       t(" 54 (2010).")],
            explanation: "A book: author, italicized title, pincite page, and year. The Bluebook gives this exact example. Rule 15.1 & 15.4."),

        Citation(category: .books, rule: "R15.1", difficulty: 3, isCorrect: false,
            segments: [t("Ronald E. Mallen "),
                       bad("and", fix: "&"),
                       t(" Jeffrey M. Smith, "),
                       t("Legal Malpractice", italic: true),
                       t(" § 1.1 (2008).")],
            explanation: "Two authors are joined with an ampersand (&), never the word \"and.\" Rule 15.1."),

        Citation(category: .books, rule: "R15.1 · R3.2", difficulty: 4, isCorrect: true,
            segments: [t("15 "),
                       t("Moore's Federal Practice", italic: true),
                       t(" § 100.02 (3d ed. 1997).")],
            explanation: "A multivolume treatise: volume number precedes the italicized title, then the section pincite and (edition year). The Bluebook gives this exact example. Rule 15.1 & 3.2."),
    ]

    // MARK: - Periodicals (Rule 16)

    static let periodicals: [Citation] = [
        Citation(category: .periodicals, rule: "R16.2 · R16.3", difficulty: 2, isCorrect: true,
            segments: [t("Kim Lane Scheppele, "),
                       t("Foreword: Telling Stories", italic: true),
                       t(", 87 Mich. L. Rev. 2073, 2082 (1989).")],
            explanation: "A consecutively paginated journal article: author, italicized title, volume, journal abbreviation, first page, pincite, and year. The Bluebook gives this exact example. Rule 16.2–16.5."),

        Citation(category: .periodicals, rule: "R16.4 · T13", difficulty: 3, isCorrect: false,
            segments: [t("Note, "),
                       t("A Bad Man Is Hard to Find", italic: true),
                       t(", 127 "),
                       bad("Harvard Law Review", fix: "Harv. L. Rev."),
                       t(" 2521 (2014).")],
            explanation: "Periodical names are abbreviated per Table T13: Harvard Law Review → Harv. L. Rev. Rule 16.4 & T13."),

        Citation(category: .periodicals, rule: "R16.6", difficulty: 3, isCorrect: true,
            segments: [t("Cop Shoots Tire, Halts Stolen Car", italic: true),
                       t(", S.F. Chron., Oct. 10, 1975, at 43.")],
            explanation: "A newspaper article: italicized title, abbreviated newspaper, date, and \"at\" page. The Bluebook gives this exact example. Rule 16.6."),

        Citation(category: .periodicals, rule: "R16.5", difficulty: 4, isCorrect: false,
            segments: [t("Kim Lane Scheppele, "),
                       t("Foreword: Telling Stories", italic: true),
                       t(", "),
                       bad("Mich. L. Rev. 87, 2073", fix: "87 Mich. L. Rev. 2073"),
                       t(", 2082 (1989).")],
            explanation: "Order is volume — journal — first page: \"87 Mich. L. Rev. 2073.\" The volume number precedes the journal abbreviation. Rule 16.5."),

        Citation(category: .periodicals, rule: "R16.2", difficulty: 5, isCorrect: true,
            segments: [t("Robert P. Inman & Michael A. Fitts, "),
                       t("Political Institutions and Fiscal Policy: Evidence from the U.S. Historical Record", italic: true),
                       t(", 6 J.L. Econ. & Org. 79, 79–82 (1990).")],
            explanation: "Two authors joined by \"&,\" italicized title, abbreviated journal (J.L. Econ. & Org.), and a pincite range. The Bluebook gives this exact example. Rule 16.2–16.5."),
    ]

    // MARK: - Internet & Electronic (Rule 18)

    static let internet: [Citation] = [
        Citation(category: .internet, rule: "R18.2.2", difficulty: 2, isCorrect: true,
            segments: [t("Yahoo! Home Page, http://www.yahoo.com (last visited Mar. 18, 2024).")],
            explanation: "A web page with no clear publication date uses a \"(last visited …)\" parenthetical after the full URL. The Bluebook gives this exact example. Rule 18.2.2."),

        Citation(category: .internet, rule: "R18.2.2", difficulty: 3, isCorrect: false,
            segments: [t("Yahoo! Home Page, "),
                       bad("www.yahoo.com", fix: "http://www.yahoo.com"),
                       t(" (last visited Mar. 18, 2024).")],
            explanation: "Provide the full URL, including the protocol (http:// or https://). Rule 18.2.2."),
    ]

    // MARK: - Court Documents (Bluepages B17)

    static let courtDocs: [Citation] = [
        Citation(category: .courtDocs, rule: "B17.1.2 · BT1", difficulty: 3, isCorrect: true,
            segments: [t("Hawkins Aff. 6.")],
            explanation: "A court document cited in a brief: abbreviated party name + abbreviated document title (Affidavit → Aff.) + page, with no \"at.\" The Bluebook gives this exact example. Bluepages B17 & BT1."),

        Citation(category: .courtDocs, rule: "B17.1.2 · BT1", difficulty: 3, isCorrect: true,
            segments: [t("Pet'r's Br. 6.")],
            explanation: "Petitioner's Brief → \"Pet'r's Br.\" using Bluepages abbreviations, followed by the page with no \"at.\" Bluepages B17 & BT1."),

        Citation(category: .courtDocs, rule: "B17.1.2 · BT1", difficulty: 4, isCorrect: false,
            segments: [bad("Petitioner's Brief at 6", fix: "Pet'r's Br. 6"),
                       t(".")],
            explanation: "In a court filing, abbreviate the document title and party designation per Table BT1 and omit \"at\" before the page: \"Pet'r's Br. 6.\" Bluepages B17.1.2."),
    ]

    // MARK: - Foreign Materials (Rule 20)

    static let foreign: [Citation] = [
        Citation(category: .foreign, rule: "R20.1", difficulty: 3, isCorrect: true,
            segments: [t("Chase v. Campbell, [1962] S.C.R. 425 (Can.).")],
            explanation: "A non-U.S. case ends with the jurisdiction abbreviation in parentheses (Table T10). The Bluebook gives this exact example. Rule 20.1 & 20.3."),

        Citation(category: .foreign, rule: "R20.1", difficulty: 4, isCorrect: false,
            segments: [t("Chase v. Campbell, [1962] S.C.R. "),
                       bad("425.", fix: "425 (Can.)."),
                       t("")],
            explanation: "When citing any non-U.S. source, indicate the issuing jurisdiction parenthetically (here, Can.). The Bluebook example includes \"(Can.).\" Rule 20.1."),
    ]

    // MARK: - International Materials (Rule 21)

    static let international: [Citation] = [
        Citation(category: .international, rule: "R21.8", difficulty: 3, isCorrect: true,
            segments: [t("U.N. Charter art. 94, ¶ 1.")],
            explanation: "The U.N. Charter is cited by article and paragraph (¶). The Bluebook gives this exact example. Rule 21.8."),

        Citation(category: .international, rule: "R21.8", difficulty: 4, isCorrect: true,
            segments: [t("League of Nations Covenant art. 16.")],
            explanation: "The League of Nations Covenant is cited by article, with no date. The Bluebook gives this exact example. Rule 21.8."),
    ]

    // MARK: - Tribal Nations (Rule 22 — new in the 22nd edition)

    static let tribal: [Citation] = [
        Citation(category: .tribal, rule: "R22.1", difficulty: 2, isCorrect: true,
            segments: [t("Const. of the Comanche Nation art. II, § 1.")],
            explanation: "Rule 22 (new in the 22nd edition) governs Tribal Nation materials. A Tribal constitution is cited much like Rule 11: \"Const.\" + the Nation + article/section. The Bluebook gives this exact example. Rule 22.1."),

        Citation(category: .tribal, rule: "R22.2.3", difficulty: 3, isCorrect: true,
            segments: [t("Pueblo de San Ildefonso Code § 4.1.1.010 (2023).")],
            explanation: "A Tribal code is cited by the Nation's code name, section, and year. The Bluebook gives this exact example. Rule 22.2.3."),

        Citation(category: .tribal, rule: "R22.1 · R11", difficulty: 4, isCorrect: false,
            segments: [bad("Constitution of the Comanche Nation", fix: "Const. of the Comanche Nation"),
                       t(" art. II, § 1.")],
            explanation: "Abbreviate \"Constitution\" to \"Const.\" The Bluebook's Tribal Nation example is \"Const. of the Comanche Nation art. II, § 1.\" Rule 22.1 (following Rule 11)."),

        Citation(category: .tribal, rule: "R22.1", difficulty: 4, isCorrect: true,
            segments: [t("Const. of the Cherokee Nation of Oklahoma of 1976 art. XVI.")],
            explanation: "When a Tribal constitution carries a year of adoption, include it before the subdivision. The Bluebook gives this exact example. Rule 22.1."),
    ]

    // MARK: - Archival Sources (Rule 23 — new in the 22nd edition)

    static let archival: [Citation] = [
        Citation(category: .archival, rule: "R23.1", difficulty: 3, isCorrect: true,
            segments: [t("Letter from William Prosser to Robert Hudec (Apr. 27, 1960) (on file with author).")],
            explanation: "Rule 23 (new in the 22nd edition) governs archival sources. A letter: \"Letter from [author] to [recipient] (date) (location).\" The Bluebook gives this example. Rule 23.1 & 23.6."),

        Citation(category: .archival, rule: "R23.5", difficulty: 4, isCorrect: true,
            segments: [t("Thomas Jefferson, "),
                       t("Ice Cream Recipe", italic: true),
                       t(" (n.d.) (on file with Libr. of Cong.).")],
            explanation: "When an archival item has no determinable date, use \"(n.d.).\" The Bluebook gives this exact example. Rule 23.5."),

        Citation(category: .archival, rule: "R23.5 · T12", difficulty: 4, isCorrect: false,
            segments: [t("Letter from William Prosser to Robert Hudec"),
                       bad(", April 27, 1960", fix: " (Apr. 27, 1960)"),
                       t(" (on file with author).")],
            explanation: "The date of an archival source is given in parentheses, with the month abbreviated per Table T12 (April → Apr.). Rule 23.5 & T12."),
    ]
}
