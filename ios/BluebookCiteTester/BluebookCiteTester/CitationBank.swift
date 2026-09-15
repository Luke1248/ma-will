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
        + foreign + international + tribal + archival + additional

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

    // MARK: - Additional sources (expanded bank)

    static let additional: [Citation] = [
        Citation(category: .cases, rule: "R10.1.2", difficulty: 2, isCorrect: true,
            segments: [t("Kleppe v. New Mexico, 426 U.S. 529, 531, 546 (1976).")],
            explanation: "Multiple pincites are separated by commas after the first page. The Bluebook gives this exact example. Rule 10.1.2."),
        Citation(category: .cases, rule: "R10.3.2", difficulty: 4, isCorrect: true,
            segments: [t("Hall v. Bell, 47 Mass. (6 Met.) 431 (1843).")],
            explanation: "A state case in an early nominative reporter: the nominative (Met.) appears in parentheses after the official volume. The Bluebook gives this example. Rule 10.3.2."),
        Citation(category: .cases, rule: "R10.2.1(f)", difficulty: 3, isCorrect: false,
            segments: [t("Mayor of "), bad("the City of ", fix: ""), t("New York v. Clinton.")],
            explanation: "Omit 'the City of' from a governmental party's name. The Bluebook example: 'Mayor of New York v. Clinton. Not: Mayor of the City of New York v. Clinton.' Rule 10.2.1(f)."),
        Citation(category: .cases, rule: "R10.2.1(f)", difficulty: 4, isCorrect: false,
            segments: [t("Surrick v. Board of Wardens"), bad(" of the Port of Philadelphia", fix: ""), t(".")],
            explanation: "Omit descriptive prepositional phrases identifying a governmental body's location. The Bluebook example: 'Surrick v. Board of Wardens. Not: Surrick v. Board of Wardens of the Port of Philadelphia.' Rule 10.2.1(f)."),
        Citation(category: .cases, rule: "R10.2.1(h)", difficulty: 4, isCorrect: false,
            segments: [t("Wisconsin Packing Co."), bad(", Inc.", fix: ""), t(" v. Indiana Refrigerator Lines, Inc.")],
            explanation: "Omit 'Inc.,' 'Ltd.,' etc. when the party's name already contains a word (here, 'Co.') that shows it is a business firm. The other party keeps 'Inc.' because 'Lines' does not. Rule 10.2.1(h)."),
        Citation(category: .cases, rule: "R10.2.1", difficulty: 5, isCorrect: false,
            segments: [t("NLRB v. Radio & Television Broadcast Engineers Local 1212"), bad(", IBEW, AFL-CIO", fix: ""), t(".")],
            explanation: "Omit trailing union affiliations and similar descriptive strings from a party's name. The Bluebook example ends at 'Local 1212.' Rule 10.2.1."),
        Citation(category: .cases, rule: "R10.4 · T7", difficulty: 3, isCorrect: true,
            segments: [t("United States v. Bruno, 144 F. Supp. 593 (N.D. Ill. 1955).")],
            explanation: "A federal district-court decision: the parenthetical gives the district (N.D. Ill.) and year. The Bluebook gives this example. Rule 10.4 & T7."),
        Citation(category: .cases, rule: "R10.6.1", difficulty: 4, isCorrect: true,
            segments: [t("Maryland v. King, 567 U.S. 1301 (2012) (Roberts, C.J., in chambers).")],
            explanation: "An in-chambers opinion is noted in a weight-of-authority parenthetical. The Bluebook gives this example. Rule 10.6.1."),
        Citation(category: .cases, rule: "R10.4(b)", difficulty: 3, isCorrect: false,
            segments: [t("Dubreuil v. Witt, 80 Conn. App. 410 ("), bad("App. Ct. ", fix: ""), t("2003).")],
            explanation: "The reporter (Conn. App.) already identifies the court, so the parenthetical needs only the year. The Bluebook example: '(2003). Not: (App. Ct. 2003).' Rule 10.4(b)."),
        Citation(category: .cases, rule: "R10.2.1", difficulty: 5, isCorrect: false,
            segments: [t("United States v. "), bad("Parcel of Real Property Known as 6109 Grubb Road, Millcreek Township, Erie County, Pennsylvania", fix: "6109 Grubb Road"), t(".")],
            explanation: "Shorten a lengthy in rem property description to a manageable name. The Bluebook example: 'United States v. 6109 Grubb Road.' Rule 10.2.1."),
        Citation(category: .constitutions, rule: "R11 · R3.5", difficulty: 2, isCorrect: true,
            segments: [t("U.S. Const. art. I, § 8; id. art. II, § 2.")],
            explanation: "Consecutive constitutional provisions may share one citation clause, using 'id.' for the second reference to the same constitution. The Bluebook gives this example. Rule 11 & 3.5."),
        Citation(category: .constitutions, rule: "R11", difficulty: 4, isCorrect: true,
            segments: [t("Wash. Const. art. I, § 2 (West, Westlaw through Nov. 2024 amendments).")],
            explanation: "A constitution from an electronic database names the publisher/database and its currentness. The Bluebook gives this example. Rule 11."),
        Citation(category: .constitutions, rule: "R11", difficulty: 5, isCorrect: true,
            segments: [t("U.S. Const. art. I, § 3, cl. 1, amended by U.S. Const. amend. XVII.")],
            explanation: "An amended provision may be cited followed by 'amended by' and the amending provision in full. The Bluebook gives this example. Rule 11."),
        Citation(category: .statutes, rule: "R12.3", difficulty: 2, isCorrect: true,
            segments: [t("N.C. Gen. Stat. § 1-181 (2003).")],
            explanation: "A state code: abbreviated code name, section, and year. The Bluebook gives this example. Rule 12.3 & T1.3."),
        Citation(category: .statutes, rule: "R12.3.1(d)", difficulty: 3, isCorrect: true,
            segments: [t("Tex. Fam. Code Ann. § 5.01 (Vernon 2002 & Supp. 2004–2005).")],
            explanation: "An annotated state code names the publisher (Vernon) and includes the supplement. The Bluebook gives this example. Rule 12.3.1(d)."),
        Citation(category: .statutes, rule: "R12.3.1(d)", difficulty: 4, isCorrect: true,
            segments: [t("42 U.S.C.A. § 300a-7 (West 2001).")],
            explanation: "The annotated U.S. Code (U.S.C.A.) names its publisher (West) in the parenthetical. The Bluebook gives this example. Rule 12.3.1(d)."),
        Citation(category: .statutes, rule: "R12.4 · T1", difficulty: 4, isCorrect: false,
            segments: [bad("1878 Laws of Minn.", fix: "1878 Minn. Laws")],
            explanation: "Session laws are cited '[year] [State] Laws.' The Bluebook example: '1878 Minn. Laws. Not: 1878 Laws of Minn.' Rule 12.4 & T1.3."),
        Citation(category: .statutes, rule: "R12.3", difficulty: 3, isCorrect: true,
            segments: [t("Ga. Code Ann. § 21-2-16 (2003).")],
            explanation: "A state code cited by name, section, and year. The Bluebook gives this example. Rule 12.3."),
        Citation(category: .statutes, rule: "R12.4", difficulty: 3, isCorrect: true,
            segments: [t("Foreign Assistance Act of 1961, Pub. L. No. 87-195, 75 Stat. 424.")],
            explanation: "A session law: act name, 'Pub. L. No.,' and Statutes at Large volume/page. The Bluebook gives this example. Rule 12.4."),
        Citation(category: .legislative, rule: "R12.4 · R13", difficulty: 4, isCorrect: true,
            segments: [t("Voting Rights Act of 1965, Pub. L. No. 89-110, 79 Stat. 445.")],
            explanation: "A named public law cited by its public-law number and Statutes at Large page. The Bluebook gives this example. Rule 12.4."),
        Citation(category: .periodicals, rule: "R16.2", difficulty: 3, isCorrect: true,
            segments: [t("Kenneth W. Tsang et al., "), t("A Cluster of Cases of Severe Acute Respiratory Syndrome in Hong Kong", italic: true), t(", 348 New Eng. J. Med. 1977, 1977 (2003).")],
            explanation: "Three or more authors may be given as the first author + 'et al.' The Bluebook gives this example. Rule 16.2."),
        Citation(category: .periodicals, rule: "R16.7.1", difficulty: 4, isCorrect: true,
            segments: [t("Recent Case, 24 Vand. L. Rev. 148, 151–52 (1970).")],
            explanation: "An unsigned student-written 'Recent Case' is cited by that designation, then volume, journal, and pages. The Bluebook gives this example. Rule 16.7.1."),
        Citation(category: .periodicals, rule: "R16.7", difficulty: 3, isCorrect: true,
            segments: [t("Howard C. Westwood, Book Review, 45 U. Chi. L. Rev. 255 (1977).")],
            explanation: "A signed but untitled book review uses the 'Book Review' designation. The Bluebook gives this example. Rule 16.7."),
        Citation(category: .periodicals, rule: "R16.6", difficulty: 3, isCorrect: true,
            segments: [t("Editorial, "), t("Pricing Drugs", italic: true), t(", Wash. Post, Feb. 17, 2004, at A18.")],
            explanation: "A newspaper editorial: 'Editorial' designation, italicized title, newspaper, date, and page. The Bluebook gives this example. Rule 16.6."),
        Citation(category: .periodicals, rule: "R16.6 · T13", difficulty: 4, isCorrect: false,
            segments: [t("Recent Case, 24 "), bad("Vanderbilt Law Review", fix: "Vand. L. Rev."), t(" 148, 151–52 (1970).")],
            explanation: "Periodical names are abbreviated per Table T13: Vanderbilt Law Review → Vand. L. Rev. Rule 16.6 & T13."),
        Citation(category: .periodicals, rule: "R16.2", difficulty: 5, isCorrect: true,
            segments: [t("Pauline M. Ippolito & Alan D. Mathios, "), t("New Food Labeling Regulations and the Flow of Nutrition Information to Consumers", italic: true), t(", 12 J. Pub. Pol'y & Mktg. 188 (1993).")],
            explanation: "Two authors joined by '&,' italicized title, and an abbreviated interdisciplinary journal. The Bluebook gives this example. Rule 16.2–16.5."),
        Citation(category: .books, rule: "R15.4 · R3.2", difficulty: 4, isCorrect: false,
            segments: [t("Matthew Butterick, "), t("Typography for Lawyers", italic: true), bad(", 54", fix: " 54"), t(" (2010).")],
            explanation: "No comma separates a book's title from the page cited — the pincite follows the title directly. Rule 15.4 & 3.2."),
        Citation(category: .foreign, rule: "R20.3", difficulty: 3, isCorrect: true,
            segments: [t("R v. Lockwood (1782) 99 Eng. Rep. 379 (KB).")],
            explanation: "An English Reports case: party names, year in round brackets, reporter, page, and court. The Bluebook gives this example. Rule 20.3."),
        Citation(category: .foreign, rule: "R20.3", difficulty: 4, isCorrect: true,
            segments: [t("Berry v Dorsey (1975) 101 ALR 35 (Austl.).")],
            explanation: "An Australian case ends with the jurisdiction (Austl.). The Bluebook gives this example. Rule 20.3."),
        Citation(category: .foreign, rule: "R20.2", difficulty: 4, isCorrect: true,
            segments: [t("Code civil [C. civ.] [Civil Code] art. 1112 (Fr.).")],
            explanation: "A non-English code: original name, abbreviation, a bracketed English translation, article, and jurisdiction. The Bluebook gives this example. Rule 20.2."),
        Citation(category: .services, rule: "R19.1", difficulty: 4, isCorrect: true,
            segments: [t("4 Lab. L. Rep. (CCH) ¶ 9046.")],
            explanation: "A looseleaf service: volume, abbreviated service name, publisher (CCH) in parentheses, and paragraph (¶). Rule 19.1."),
        Citation(category: .services, rule: "R19.1", difficulty: 5, isCorrect: true,
            segments: [t("In re Looney, [1987–1989 Transfer Binder] Bankr. L. Rep. (CCH) ¶ 72,447, at 93,590 (Bankr. W.D. Va. Sept. 9, 1988).")],
            explanation: "A case reported in a service, with the transfer-binder designation, paragraph, 'at' page, and court/date parenthetical. Rule 19.1."),
        Citation(category: .courtDocs, rule: "R10.8.3", difficulty: 4, isCorrect: true,
            segments: [t("Complaint at 17, Kelly v. Wyman, 294 F. Supp. 893 (S.D.N.Y. 1968).")],
            explanation: "An academic-format citation to a court document: document name, 'at' page, then the case citation. The Bluebook gives this example. Rule 10.8.3."),
        Citation(category: .courtDocs, rule: "R10.8.3", difficulty: 5, isCorrect: true,
            segments: [t("Transcript of Record at 16–17, Johnson v. Eisentrager, 339 U.S. 763 (1950).")],
            explanation: "A record on appeal cited with a page range and the full case citation. The Bluebook gives this example. Rule 10.8.3."),
        Citation(category: .tribal, rule: "R22.2.3", difficulty: 3, isCorrect: true,
            segments: [t("Colorado River Indian Tribes Land Code § 1-101.5 (1988).")],
            explanation: "A Tribal code cited by the Nation's code name, section, and year. The Bluebook gives this example. Rule 22.2.3."),
        Citation(category: .archival, rule: "R23.1", difficulty: 5, isCorrect: true,
            segments: [t("James Madison, "), t("For the National Gazette", italic: true), t(" (Dec. 19, 1791).")],
            explanation: "An archival manuscript: author, italicized title/description, and date in parentheses. The Bluebook gives this example. Rule 23.1."),
        Citation(category: .internet, rule: "R18.2.1(d)", difficulty: 4, isCorrect: true,
            segments: [t("Macy's, http://www.macys.com [https://perma.cc/S2LQ-CSYS] (last visited Apr. 5, 2024).")],
            explanation: "An archived source gives the live URL followed by the archive URL (perma.cc) in brackets. The Bluebook gives this example form. Rule 18.2.1(d)."),
        Citation(category: .signals, rule: "R1.2", difficulty: 2, isCorrect: true,
            segments: [t("See ", italic: true), t("Flanagan v. United States, 465 U.S. 259, 264 (1984).")],
            explanation: "The signal 'See' (italicized) shows that the cited authority clearly supports the proposition. Rule 1.2."),
        Citation(category: .signals, rule: "R1.2 · R1.3", difficulty: 3, isCorrect: true,
            segments: [t("See, e.g., ", italic: true), t("S. Pac. Co. v. Jensen, 244 U.S. 205, 225–26 (1917) (Pitney, J., dissenting).")],
            explanation: "The combined signal 'See, e.g.,' indicates the cited case is one of several that support the point. Rule 1.2 & 1.3."),
        Citation(category: .signals, rule: "R1.2", difficulty: 4, isCorrect: true,
            segments: [t("Contra ", italic: true), t("Blake v. Kline, 612 F.2d 718, 723–24 (3d Cir. 1979).")],
            explanation: "'Contra' signals authority that directly contradicts the proposition. Rule 1.2."),
        Citation(category: .signals, rule: "R1.2 · R1.3", difficulty: 4, isCorrect: true,
            segments: [t("See also ", italic: true), t("Revlon, Inc. v. MacAndrews & Forbes Holdings, Inc., 506 A.2d 173 (Del. 1986).")],
            explanation: "'See also' adds further authority that supports the proposition. Signals are ordered per Rule 1.3."),
        Citation(category: .signals, rule: "R1.2", difficulty: 3, isCorrect: false,
            segments: [CiteSegment(text: "See e.g.,", isError: true, fix: "See, e.g.,", italic: true), t(" State v. Caryl, 543 P.2d 389, 390 (Mont. 1975).")],
            explanation: "When 'e.g.' is combined with another signal, a comma precedes it: 'See, e.g.,' Rule 1.2 & 1.3."),
        Citation(category: .signals, rule: "R4.1", difficulty: 2, isCorrect: true,
            segments: [t("Id.", italic: true), t(" at 93,591.")],
            explanation: "'Id.' cites the immediately preceding authority; 'at' introduces the new pincite. Rule 4.1."),
        Citation(category: .signals, rule: "R10.9", difficulty: 3, isCorrect: true,
            segments: [t("Youngstown Sheet & Tube Co. v. Sawyer, 343 U.S. at 585.")],
            explanation: "A case short form (after a full citation): one party name, volume, 'at,' and the page. Rule 10.9."),
        Citation(category: .signals, rule: "R10.9", difficulty: 4, isCorrect: false,
            segments: [t("Youngstown Sheet & Tube Co. v. Sawyer, 343 U.S. "), bad("585", fix: "at 585"), t(".")],
            explanation: "A short-form case pincite is introduced by 'at': '343 U.S. at 585.' Rule 10.9."),
        Citation(category: .signals, rule: "R4.2", difficulty: 5, isCorrect: true,
            segments: [t("Scope of Protection", italic: true), t(", "), t("supra", italic: true), t(" note 2, at 906.")],
            explanation: "'supra' refers back to a previously cited non-case source by footnote number. Rule 4.2."),
        Citation(category: .cases, rule: "R3.2 · R10", difficulty: 3, isCorrect: true,
            segments: [t("Newdow v. U.S. Cong., 328 F.3d 466, 471 n.3 (9th Cir. 2003).")],
            explanation: "A pincite to material in a footnote uses 'n.3' after the page number. Rule 3.2(a)."),
        Citation(category: .cases, rule: "R10.2.1(c) · T6", difficulty: 2, isCorrect: true,
            segments: [t("Meritor Sav. Bank v. Vinson, 477 U.S. 57, 60 (1986).")],
            explanation: "'Savings Bank' abbreviates to 'Sav. Bank' (Table T6); the pincite is to page 60. Rule 10.2.1(c) & T6."),
        Citation(category: .cases, rule: "R10.2.1(c) · R6.1(b)", difficulty: 3, isCorrect: true,
            segments: [t("Env't Def. Fund v. EPA, 465 F.2d 528, 533 (D.C. Cir. 1972).")],
            explanation: "Environmental→Env't, Defense→Def. (T6); a widely recognized entity (EPA) is left as an unpunctuated acronym. Rule 6.1(b)."),
        Citation(category: .cases, rule: "R10.3.1", difficulty: 2, isCorrect: true,
            segments: [t("Bates v. Tappan, 99 Mass. 376 (1868).")],
            explanation: "An older state decision cited to the official reporter (Mass.) with no reporter series number. Rule 10.3.1."),
        Citation(category: .statutes, rule: "R12.3", difficulty: 2, isCorrect: true,
            segments: [t("Nev. Rev. Stat. § 28.501 (1998).")],
            explanation: "A state code: abbreviated name, section, and year. The Bluebook gives this example. Rule 12.3."),
        Citation(category: .courtDocs, rule: "R10.8.3", difficulty: 4, isCorrect: true,
            segments: [t("Brief for the Petitioner, Demore v. Kim, 538 U.S. 510 (2003).")],
            explanation: "An appellate brief cited by document name followed by the full case citation. The Bluebook gives this example. Rule 10.8.3."),
    ]
}
