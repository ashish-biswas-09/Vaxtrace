# -*- coding: utf-8 -*-
"""
Build the upgraded VaxTrace Software Requirements Specification (defense quality).
Fixes: empty TOC, character-encoding corruption, non-academic references,
missing document control, no data model / use-case diagrams, weak NFRs,
missing assumptions/dependencies. Embeds 4 Figma diagrams.
"""
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION, WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import os, struct

BASE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(BASE, "figures")

# No colour in the writing: all text is black. Table headers use a neutral grey fill.
NAVY = RGBColor(0x00, 0x00, 0x00)
BLUE = RGBColor(0x00, 0x00, 0x00)
HDR_FILL = "D9D9D9"
GREY = RGBColor(0x59, 0x59, 0x59)

doc = Document()

# ------------------------------------------------------------------ styles
normal = doc.styles["Normal"]
normal.font.name = "Times New Roman"
normal.font.size = Pt(12)
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
pf = normal.paragraph_format
pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
pf.line_spacing = 1.15
pf.space_after = Pt(6)

for nm, sz, col in (("Heading 1", 16, NAVY), ("Heading 2", 13, BLUE), ("Heading 3", 12, BLUE)):
    st = doc.styles[nm]
    st.font.name = "Times New Roman"
    st.font.size = Pt(sz)
    st.font.bold = True
    st.font.color.rgb = col
    st.paragraph_format.space_before = Pt(12)
    st.paragraph_format.space_after = Pt(4)
    st.paragraph_format.keep_with_next = True

# ------------------------------------------------------------------ page setup (A4, 1in margins, numbered footer, no number on cover)
sec = doc.sections[0]
sec.page_width = Inches(8.27)
sec.page_height = Inches(11.69)
for m in ("top_margin", "bottom_margin", "left_margin", "right_margin"):
    setattr(sec, m, Inches(1))
sec.different_first_page_header_footer = True

def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    for t, attrs in (("begin", {}), (None, None), ("end", {})):
        if t == "begin":
            fc = OxmlElement("w:fldChar"); fc.set(qn("w:fldCharType"), "begin"); run._r.append(fc)
            it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = " PAGE "; run._r.append(it)
        elif t == "end":
            fc = OxmlElement("w:fldChar"); fc.set(qn("w:fldCharType"), "end"); run._r.append(fc)

footer_p = sec.footer.paragraphs[0]
add_page_number(footer_p)

# ------------------------------------------------------------------ helpers
def add_complex_field(paragraph, instr, placeholder=""):
    r1 = paragraph.add_run(); fc1 = OxmlElement("w:fldChar"); fc1.set(qn("w:fldCharType"), "begin"); r1._r.append(fc1)
    r2 = paragraph.add_run(); it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = instr; r2._r.append(it)
    r3 = paragraph.add_run(); fc2 = OxmlElement("w:fldChar"); fc2.set(qn("w:fldCharType"), "separate"); r3._r.append(fc2)
    r4 = paragraph.add_run(placeholder); r4.italic = True; r4.font.color.rgb = GREY
    r5 = paragraph.add_run(); fc3 = OxmlElement("w:fldChar"); fc3.set(qn("w:fldCharType"), "end"); r5._r.append(fc3)

def body(text, justify=True, italic=False, space_after=6):
    p = doc.add_paragraph()
    r = p.add_run(text); r.italic = italic
    if justify:
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(space_after)
    return p

def bullet(text, bold_lead=None):
    p = doc.add_paragraph(style="List Bullet")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if bold_lead:
        r = p.add_run(bold_lead); r.bold = True
        p.add_run(text)
    else:
        p.add_run(text)
    return p

def shade(cell, fill=HDR_FILL):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), fill)
    tcPr.append(shd)

def set_cell(cell, text, bold=False, size=11, align=None, color=None):
    cell.text = ""
    p = cell.paragraphs[0]
    if align:
        p.alignment = align
    r = p.add_run(text); r.bold = bold; r.font.size = Pt(size)
    r.font.name = "Times New Roman"
    if color:
        r.font.color.rgb = color
    return cell

def make_table(headers, rows, widths=None, header_size=11, body_size=11):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        set_cell(hdr[i], h, bold=True, size=header_size, align=WD_ALIGN_PARAGRAPH.CENTER, color=NAVY)
        shade(hdr[i])
    # repeat header on new pages
    trPr = t.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement("w:tblHeader"); th.set(qn("w:val"), "true"); trPr.append(th)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            set_cell(cells[i], val, size=body_size)
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Inches(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

FIG_N = {"n": 0}
TAB_N = {"n": 0}

def _caption(title):
    FIG_N["n"] += 1
    cap = doc.add_paragraph(); cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap.add_run("Figure "); r.bold = True; r.font.size = Pt(10)
    add_complex_field(cap, " SEQ Figure \\* ARABIC ", str(FIG_N["n"]))
    r2 = cap.add_run(": " + title); r2.bold = True; r2.font.size = Pt(10)
    cap.paragraph_format.space_after = Pt(10)

def _png_size(path):
    """Return (width, height) in pixels from a PNG header (no extra deps)."""
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])

# One shared box so every diagram page is the same size: A4 portrait, 1" margins,
# with room left for the caption. All diagrams scale (aspect-preserved) to fit it.
FIG_BOX_W = 6.27   # 8.27 - 2*1.0
FIG_BOX_H = 8.8    # 11.69 - 2*1.0 - caption space

def figure_fullpage(path, title):
    """Place any diagram on its own A4 portrait page, scaled to fit the shared box."""
    w, h = _png_size(path)
    ar = w / h  # width / height
    doc.add_page_break()
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if ar >= FIG_BOX_W / FIG_BOX_H:
        p.add_run().add_picture(path, width=Inches(FIG_BOX_W))   # width-limited
    else:
        p.add_run().add_picture(path, height=Inches(FIG_BOX_H))  # height-limited
    _caption(title)
    doc.add_page_break()

def table_caption(title):
    TAB_N["n"] += 1
    cap = doc.add_paragraph()
    r = cap.add_run("Table "); r.bold = True; r.font.size = Pt(10)
    add_complex_field(cap, " SEQ Table \\* ARABIC ", str(TAB_N["n"]))
    r2 = cap.add_run(": " + title); r2.bold = True; r2.font.size = Pt(10)
    cap.paragraph_format.space_before = Pt(6); cap.paragraph_format.space_after = Pt(2)

def heading(text, level):
    return doc.add_heading(text, level=level)

# ================================================================== COVER PAGE
def center(text, size, bold=False, color=None, space=4, caps=False):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text.upper() if caps else text); r.bold = bold; r.font.size = Pt(size)
    if color:
        r.font.color.rgb = color
    p.paragraph_format.space_after = Pt(space)
    p.paragraph_format.space_before = Pt(0)
    return p

doc.add_paragraph().paragraph_format.space_after = Pt(36)
center("Software Requirements Specification (SRS)", 14, bold=True, color=BLUE, space=30)
center("VaxTrace", 40, bold=True, color=NAVY, space=4)
center("A Smart Vaccination System for Parents", 16, bold=True, color=RGBColor(0,0,0), space=28)
center("Final Year Design Project", 14, bold=True, space=40)

# metadata block (centered)
for label, val in (
    ("Prepared by", "Ashis Biswas"),
    ("Student ID", "________________________"),
    ("Supervisor", "________________________"),
    ("Institution", "Daffodil International University"),
):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p.add_run(label + ":  "); r1.bold = True; r1.font.size = Pt(12)
    r2 = p.add_run(val); r2.font.size = Pt(12)
    p.paragraph_format.space_after = Pt(4)

doc.add_paragraph().paragraph_format.space_after = Pt(24)
center("Document Version 1.0", 12, bold=True, space=2)
center("June 2026", 12, space=2)

doc.add_page_break()

# ================================================================== DOCUMENT CONTROL
heading("Document Control", level=1)
body("This Software Requirements Specification (SRS) is a controlled document. The revision "
     "history below records each version and the substantive changes applied.", space_after=6)
table_caption("Document Revision History")
make_table(
    ["Version", "Date", "Author", "Summary of Changes"],
    [
        ["1.0", "June 2026", "Ashis Biswas",
         "Initial release of the VaxTrace Software Requirements Specification, prepared in accordance "
         "with IEEE Std 830-1998. Covers the introduction and objectives, overall description, system "
         "requirements, functional requirements with a use-case diagram, non-functional requirements "
         "(ISO/IEC 25010), system architecture, data model (ERD), system workflow, expected outcomes, "
         "future enhancements, and IEEE references."],
    ],
    widths=[0.9, 1.1, 1.4, 2.9],
)

doc.add_page_break()

# ================================================================== TABLE OF CONTENTS
heading("Table of Contents", level=1)
toc_p = doc.add_paragraph()
add_complex_field(toc_p, ' TOC \\o "1-3" \\h \\z \\u ',
                  "Right-click here and choose 'Update Field' (or select all and press F9) to build the Table of Contents.")
doc.add_page_break()

# ------------------------------------------------- List of Figures
heading("List of Figures", level=1)
lof_p = doc.add_paragraph()
add_complex_field(lof_p, ' TOC \\h \\z \\c "Figure" ',
                  "Right-click here and choose 'Update Field' to build the List of Figures.")

# ------------------------------------------------- List of Tables
heading("List of Tables", level=1)
lot_p = doc.add_paragraph()
add_complex_field(lot_p, ' TOC \\h \\z \\c "Table" ',
                  "Right-click here and choose 'Update Field' to build the List of Tables.")
doc.add_page_break()

# ================================================================== 1. INTRODUCTION
heading("1. Introduction", level=1)

heading("1.1 Purpose", level=2)
body("This Software Requirements Specification (SRS) describes the functional and non-functional "
     "requirements of VaxTrace, a smart, web-based vaccination management system for parents, "
     "healthcare workers, and administrators. The document is prepared in accordance with the IEEE "
     "Recommended Practice for Software Requirements Specifications (IEEE Std 830-1998) [8] and "
     "serves as the authoritative reference for the design, implementation, and evaluation of the "
     "system as a Final Year Design Project. The intended audience comprises the project supervisor "
     "and examination committee, the development team, and future maintainers of the system.")

heading("1.2 Objective", level=2)
body("The objective of VaxTrace is to design and develop a centralized, web-based vaccination "
     "management system that digitizes child immunization records for parents, healthcare workers, "
     "and administrators. The system automatically generates a complete vaccination schedule for "
     "each registered child based on the date of birth, in accordance with Bangladesh’s National "
     "Immunization Schedule (NIS) [7], and proactively notifies parents through SMS and email before "
     "each scheduled dose. By replacing manual, paper-based immunization tracking with an automated "
     "digital workflow, VaxTrace aims to:")
for lead, txt in (
    ("O1 — ", "Reduce the number of missed or delayed vaccine doses among children."),
    ("O2 — ", "Give parents real-time, self-service visibility into their child’s immunization history and upcoming doses."),
    ("O3 — ", "Give healthcare workers a fast, reliable interface for registering children and recording administered vaccines."),
    ("O4 — ", "Give administrators centralized oversight of vaccine inventory, coverage rates, and missed-dose statistics."),
    ("O5 — ", "Demonstrate, as a Final Year Design Project, a practical full-stack implementation of an automated, rule-driven scheduling and notification system."),
):
    bullet(txt, bold_lead=lead)

heading("1.3 Scope", level=2)
body("VaxTrace is a scalable, web-based platform for centralized vaccination record management, "
     "built as a single full-stack application using the Next.js App Router with JavaScript for both "
     "the user interface and the backend API [1], with MongoDB as the persistent data store [2]. "
     "Three role-based user classes — parents/guardians, healthcare workers, and administrators — "
     "access the system through dedicated dashboards served by the same application.")
body("In scope:", justify=False, space_after=2).runs[0].bold = True
for t in (
    "Child registration and duplicate-registration prevention.",
    "Automatic generation of the NIS-based vaccination schedule from the date of birth.",
    "Recording of administered doses and automatic calculation of the next due date.",
    "Multi-channel reminder notifications (SMS and email) driven by scheduled jobs.",
    "Vaccine inventory monitoring and administrative reporting and statistics.",
    "Role-based authentication and access control.",
):
    bullet(t)
body("Out of scope (addressed as future enhancements in Section 10):", justify=False, space_after=2).runs[0].bold = True
for t in (
    "Integration with national Birth Registration / EPI databases.",
    "A dedicated native mobile application.",
    "Full bilingual (Bangla/English) interface and notifications.",
    "AI-driven coverage-gap and outbreak-risk analytics, and telemedicine modules.",
):
    bullet(t)
body("The current scope is limited to a single-country deployment aligned with Bangladesh’s NIS [7] "
     "and is intended primarily as a working prototype for academic evaluation.")

heading("1.4 Definitions, Acronyms, and Abbreviations", level=2)
table_caption("Definitions, Acronyms, and Abbreviations")
make_table(
    ["Term", "Definition"],
    [
        ["NIS", "National Immunization Schedule (Bangladesh)."],
        ["EPI", "Expanded Programme on Immunization."],
        ["API", "Application Programming Interface."],
        ["JWT", "JSON Web Token."],
        ["RBAC", "Role-Based Access Control."],
        ["NextAuth", "Authentication library for Next.js used for session management."],
        ["Cron Job", "A time-based scheduled task that runs automatically at fixed intervals."],
        ["SMTP", "Simple Mail Transfer Protocol."],
        ["Atlas", "MongoDB Atlas, the managed cloud database service for MongoDB."],
        ["DOB", "Date of Birth."],
        ["UI", "User Interface."],
        ["ERD", "Entity-Relationship Diagram."],
        ["SRS", "Software Requirements Specification."],
        ["NFR", "Non-Functional Requirement."],
        ["CRUD", "Create, Read, Update, Delete."],
    ],
    widths=[1.4, 4.9],
)

# ================================================================== 2. OVERALL DESCRIPTION
heading("2. Overall Description", level=1)

heading("2.1 Product Perspective", level=2)
body("VaxTrace is a new, self-contained product rather than an extension of an existing system. It "
     "is built as a single Next.js application in which frontend pages and backend API routes are "
     "served from the same codebase [1]. At a high level, the system consists of role-based web "
     "interfaces for parents, healthcare workers, and administrators; Next.js API routes (/api/*) "
     "that handle business logic and data access; NextAuth for session management [3] combined with "
     "a JWT [4] and RBAC middleware layer for role-based access control; scheduled cron jobs that "
     "check vaccination due dates and trigger reminders; a notification layer that dispatches "
     "reminders through an email service (Nodemailer) [5] and an SMS gateway API; and a centralized "
     "MongoDB Atlas database [9].")

heading("2.2 User Classes and Characteristics", level=2)
bullet("Views their child’s vaccination history and upcoming schedule, and receives SMS and email reminders ahead of due dates. Assumed to have basic web/smartphone literacy.", bold_lead="Parent / Guardian (Web User): ")
bullet("Registers children, records administered vaccines, and updates vaccination status. Assumed to have routine clinical data-entry experience.", bold_lead="Healthcare Worker (Web User): ")
bullet("Manages user accounts and permissions, monitors vaccine inventory, and generates reports and statistical analyses. Assumed to be the most technically proficient user class.", bold_lead="Administrator (Web User): ")

heading("2.3 Operating Environment", level=2)
bullet("Modern web browsers (Chrome, Firefox, Edge, Safari) on desktop or mobile devices.", bold_lead="Client: ")
bullet("Node.js runtime running Next.js (App Router, JavaScript) for both frontend and backend.", bold_lead="Application server: ")
bullet("MongoDB Atlas (cloud) or a self-hosted MongoDB instance [9].", bold_lead="Database: ")
bullet("Third-party SMS gateway API and SMTP-based email service.", bold_lead="Notification gateways: ")
bullet("Cloud hosting (e.g., Vercel) or a local server environment with HTTPS enabled.", bold_lead="Deployment: ")

heading("2.4 Design and Implementation Constraints", level=2)
for t in (
    "Each child’s vaccination schedule must be automatically generated from the date of birth, following Bangladesh’s National Immunization Schedule [7].",
    "Sensitive child and guardian data must be protected through proper authentication and role-based access control.",
    "SMS and email reminder delivery depends on third-party gateway availability and may be simulated within the prototype.",
    "The system must be implemented as a single Next.js (App Router, JavaScript) application with MongoDB, per the project specification.",
    "The system must operate within the academic project (Final Year Design Project) timeline and resource constraints.",
):
    bullet(t)

heading("2.5 Assumptions and Dependencies", level=2)
for t in (
    "Users have access to an internet-connected device with a modern web browser.",
    "Guardian contact details (mobile number and/or email) are accurate and kept up to date for reminder delivery.",
    "A third-party SMS gateway and an SMTP email service are available; in the prototype these may be simulated.",
    "The official Bangladesh NIS dose schedule is available and used as the rule base for automatic schedule generation [7].",
    "The hosting platform supports scheduled (cron) execution for the reminder jobs.",
    "MongoDB Atlas (or an equivalent MongoDB deployment) is available as the persistent data store [9].",
):
    bullet(t)

# ================================================================== 3. SYSTEM REQUIREMENTS
heading("3. System Requirements", level=1)
body("This section defines the minimum hardware and software requirements needed to develop, deploy, and run VaxTrace.")

heading("3.1 Hardware Requirements", level=2)
table_caption("Hardware Requirements")
make_table(
    ["Component", "Minimum Requirement", "Recommended"],
    [
        ["Application server (cloud or local)", "1 vCPU, 2 GB RAM, 10 GB storage", "2 vCPU, 4 GB RAM, SSD storage"],
        ["Database server (MongoDB Atlas or self-hosted)", "Shared cluster (M0) or 2 GB RAM", "Dedicated cluster, 4 GB+ RAM"],
        ["Developer workstation", "Dual-core CPU, 8 GB RAM", "Quad-core CPU, 16 GB RAM, SSD"],
        ["Client device", "Smartphone, tablet, or PC with a modern browser", "Smartphone or laptop with stable internet"],
        ["Network connectivity", "Stable internet connection", "Broadband / 4G or better"],
    ],
    widths=[2.2, 2.1, 2.0],
)

heading("3.2 Software Requirements", level=2)
table_caption("Software Requirements")
make_table(
    ["Layer", "Technology / Tool", "Purpose"],
    [
        ["Frontend & Backend", "Next.js (App Router, JavaScript)", "Unified full-stack framework serving UI pages and /api/* routes"],
        ["Database", "MongoDB / MongoDB Atlas", "Persistent storage for users, children, vaccines, records, schedules, notifications, inventory"],
        ["Authentication", "NextAuth, JWT, RBAC middleware", "Session management and role-based access control"],
        ["Notifications", "Nodemailer (SMTP), SMS Gateway API", "Automated email and SMS reminders for upcoming doses"],
        ["Scheduling", "Cron jobs (Node.js scheduler / Vercel Cron)", "Periodic checks for upcoming vaccination due dates"],
        ["Hosting / Deployment", "Vercel or Node.js server with HTTPS", "Production deployment of the application"],
        ["Version Control", "Git and GitHub", "Source code management and collaboration"],
        ["Development Environment", "Visual Studio Code, Node.js, npm", "Local development and dependency management"],
        ["Password Security", "bcrypt", "Hashing of user passwords before storage"],
    ],
    widths=[1.6, 2.1, 2.6],
)

# ================================================================== 4. FUNCTIONAL REQUIREMENTS
heading("4. Functional Requirements", level=1)
body("This section presents the system’s functional behaviour. The use-case view (Section 4.1) "
     "identifies the actors and the services they invoke; Section 4.2 details a representative "
     "use case; and Section 4.3 enumerates the testable functional requirements with priority and "
     "objective traceability.")

heading("4.1 Use-Case Diagram", level=2)
body("Figure 1 shows the three actors — Parent/Guardian, Healthcare Worker, and Administrator — "
     "and the use cases each can perform within the VaxTrace system boundary.")
figure_fullpage(os.path.join(FIG, "fig3_usecase.png"), "VaxTrace Use-Case Diagram")

heading("4.2 Representative Use-Case Description", level=2)
body("To illustrate the dynamic behaviour of the system, the core automated use case — sending a "
     "vaccination reminder — is described below.", space_after=4)
make_table(
    ["Field", "Description"],
    [
        ["Use Case", "UC-08: Send Vaccination Reminder"],
        ["Primary Actors", "System (Cron Job); Parent/Guardian (recipient)"],
        ["Precondition", "The child has one or more scheduled doses and a valid guardian contact on file."],
        ["Trigger", "The scheduled cron job runs and finds a dose due within the configured reminder window."],
        ["Main Flow", "1) Cron job scans the schedules collection. 2) It identifies doses due within the window. "
                      "3) The notification service composes the message. 4) It dispatches the reminder via the SMS gateway and email (Nodemailer). "
                      "5) The dispatch outcome is logged in the notifications collection."],
        ["Postcondition", "The reminder is recorded and the parent/guardian is notified ahead of the due date."],
        ["Exceptions", "If a gateway is unavailable, delivery is retried up to three times and then marked as failed."],
    ],
    widths=[1.5, 4.8],
)

heading("4.3 Functional Requirements List", level=2)
body("Priority levels: H = High (core), M = Medium, L = Low. The Objective column traces each "
     "requirement to the objectives defined in Section 1.2.", space_after=4)
table_caption("Functional Requirements")
make_table(
    ["ID", "Requirement", "Pri.", "Obj."],
    [
        ["FR-1", "The system shall authenticate users using NextAuth with JWT-based sessions, enforced by an RBAC middleware layer for parents, healthcare workers, and administrators.", "H", "O2–O4"],
        ["FR-2", "Healthcare workers shall register a new child with details such as name, date of birth, gender, and guardian contact information.", "H", "O3"],
        ["FR-3", "The system shall prevent duplicate child registration based on identifying details such as guardian contact and date of birth.", "M", "O3"],
        ["FR-4", "The system shall automatically generate a complete vaccination schedule for each child based on date of birth, following Bangladesh’s NIS [7].", "H", "O1, O5"],
        ["FR-5", "Healthcare workers shall update vaccination records after a dose is administered, including date administered, vaccine name, and dose number.", "H", "O3"],
        ["FR-6", "The system shall automatically calculate and update the next due date immediately after a vaccination record is updated.", "H", "O1, O5"],
        ["FR-7", "Parents/guardians shall access a dashboard to view their child’s complete vaccination history and upcoming scheduled doses.", "H", "O2"],
        ["FR-8", "A scheduled cron job shall check upcoming vaccination due dates and automatically trigger SMS and email reminders to parents before each scheduled date.", "H", "O1, O5"],
        ["FR-9", "Administrators shall manage user accounts and role-based permissions for healthcare workers and parents.", "M", "O4"],
        ["FR-10", "Administrators shall monitor vaccine inventory, including stock levels and batch/expiry tracking.", "M", "O4"],
        ["FR-11", "The system shall generate reports and statistical analyses, including immunization coverage rates and missed-dose tracking, for administrators.", "M", "O4"],
        ["FR-12", "The system shall maintain audit logs of all vaccination record updates.", "L", "O4"],
    ],
    widths=[0.5, 4.5, 0.5, 0.8],
    body_size=10.5,
)

# ================================================================== 5. NON-FUNCTIONAL REQUIREMENTS
heading("5. Non-Functional Requirements", level=1)
body("The non-functional requirements are organised according to the ISO/IEC 25010 software product "
     "quality model [10], each with a measurable acceptance criterion.")
table_caption("Non-Functional Requirements (ISO/IEC 25010)")
make_table(
    ["ID", "Quality Attribute", "Requirement and Acceptance Criterion"],
    [
        ["NFR-1", "Security", "Passwords are stored only as bcrypt hashes (cost factor ≥ 10); all traffic is served over HTTPS (TLS 1.2+); access is enforced per role via JWT and RBAC; controls align with the OWASP Top Ten [11]."],
        ["NFR-2", "Performance Efficiency", "Under normal load (up to ~100 concurrent users), 95% of API requests complete in under 3 seconds."],
        ["NFR-3", "Reliability", "Target availability of 99% (prototype); automated daily MongoDB backups; failed SMS/email deliveries are retried up to 3 times with structured error handling."],
        ["NFR-4", "Maintainability", "Code is organised into feature modules with documented API routes and is managed under Git version control."],
        ["NFR-5", "Scalability", "The architecture supports a growing number of children, guardians, and facilities through stateless API routes and horizontally scalable hosting and MongoDB Atlas."],
        ["NFR-6", "Usability", "Role-specific dashboards are usable by non-technical parents; primary tasks are completable within three clicks; the UI is responsive on mobile and desktop."],
        ["NFR-7", "Portability", "The application runs on any modern browser and is deployable to Vercel or any Node.js host with HTTPS."],
        ["NFR-8", "Compatibility", "The system interoperates with third-party SMS gateways and SMTP email services through standard APIs."],
    ],
    widths=[0.6, 1.7, 4.0],
    body_size=10.5,
)

# ================================================================== 6. SYSTEM ARCHITECTURE
heading("6. System Architecture", level=1)

heading("6.1 Architecture Overview", level=2)
body("VaxTrace is implemented as a single Next.js application using the App Router for both the user "
     "interface and the backend API routes [1]. Parents, healthcare workers, and administrators all "
     "interact with the same Next.js frontend, which communicates with the backend through RESTful "
     "API routes under /api/*. The backend is supported by three core components: NextAuth for "
     "session management [3], a JWT [4] and RBAC middleware layer that enforces role-based access "
     "control on every request, and scheduled cron jobs that check for upcoming vaccination due "
     "dates. When a reminder is due, the cron job triggers the notification layer, which dispatches "
     "messages through an email service (Nodemailer) [5] and an SMS gateway API. All application "
     "data — users, children, vaccines, vaccination records, schedules, notifications, and "
     "inventories — is persisted in MongoDB Atlas [9]. Figure 2 illustrates this architecture.")
figure_fullpage(os.path.join(FIG, "fig1_architecture.png"), "VaxTrace System Architecture")

heading("6.2 Component Description", level=2)
bullet("Renders role-specific dashboards and forms for parents, healthcare workers, and administrators using the App Router.", bold_lead="Next.js Frontend: ")
bullet("Exposes RESTful endpoints under /api/* that implement business logic, validation, and data access.", bold_lead="Next.js Backend (API Routes): ")
bullet("Manages login sessions and issues JWTs on successful authentication.", bold_lead="NextAuth Session: ")
bullet("Validates tokens and enforces role-based permissions on every protected request.", bold_lead="JWT + RBAC Middleware: ")
bullet("Run on a schedule to identify vaccinations due within a configurable window and queue reminder notifications.", bold_lead="Cron Jobs (Reminders): ")
bullet("Dispatches due reminders through Nodemailer (email) and a third-party SMS gateway API.", bold_lead="Notification Layer: ")
bullet("Centralized data store holding the users, children, vaccines, vaccinationRecords, schedules, notifications, and inventories collections.", bold_lead="MongoDB Atlas: ")

# ================================================================== 7. DATA MODEL
heading("7. Data Model", level=1)

heading("7.1 Entity-Relationship Diagram", level=2)
body("Figure 3 presents the VaxTrace data model as an entity-relationship diagram. It defines the "
     "seven MongoDB collections, their key fields, and the relationships and cardinalities between "
     "them — for example, one guardian (user) may have many children, and each child has one or "
     "more scheduled doses.")
figure_fullpage(os.path.join(FIG, "fig4_erd.png"), "VaxTrace Entity-Relationship (Data Model) Diagram")

heading("7.2 Collection Descriptions", level=2)
table_caption("MongoDB Collection Descriptions")
make_table(
    ["Collection", "Purpose", "Key Fields"],
    [
        ["users", "Accounts for all roles (parent, worker, admin).", "id, name, email, passwordHash, role, contact"],
        ["children", "Registered children and guardian linkage.", "id, name, dateOfBirth, gender, guardianId, guardianContact"],
        ["vaccines", "Vaccine catalogue aligned with the NIS.", "id, name, totalDoses, recommendedAgeDays"],
        ["schedules", "Generated per-child dose schedule.", "id, childId, vaccineId, doseNumber, dueDate, status"],
        ["vaccinationRecords", "Administered-dose records.", "id, childId, vaccineId, administeredBy, doseNumber, administeredDate, nextDueDate"],
        ["notifications", "Reminder dispatch log.", "id, scheduleId, recipientId, channel, sentAt, status"],
        ["inventories", "Vaccine stock and batch tracking.", "id, vaccineId, batchNumber, stockQuantity, expiryDate"],
    ],
    widths=[1.4, 2.2, 2.7],
    body_size=10.5,
)

# ================================================================== 8. SYSTEM WORKFLOW
heading("8. System Workflow", level=1)
body("Figure 4 illustrates the end-to-end workflow of VaxTrace: from user login and role-based "
     "branching, through child registration, automatic schedule generation, persistence, the cron "
     "job’s due-date checks and reminder delivery, dose administration and record update, and "
     "finally report generation.")
figure_fullpage(os.path.join(FIG, "fig2_workflow.png"), "VaxTrace Vaccination Workflow")

# ================================================================== 9. EXPECTED OUTCOMES
heading("9. Expected Outcomes", level=1)
body("Upon completion, VaxTrace is expected to deliver the following outcomes:")
for t in (
    "A fully functional, role-based web application covering child registration, automated NIS-based scheduling, vaccination record updates, and reminder notifications.",
    "A measurable reduction in missed or delayed vaccine doses through proactive, automated SMS and email reminders sent ahead of each due date.",
    "A centralized, digital alternative to paper-based immunization records that improves data accuracy, auditability, and accessibility for parents and healthcare workers.",
    "A self-service parent dashboard that increases visibility into each child’s vaccination history and upcoming schedule without requiring a clinic visit.",
    "An administrative reporting capability that surfaces immunization coverage rates and missed-dose statistics to support data-driven decision-making.",
    "Real-time vaccine inventory monitoring, including stock levels and batch/expiry tracking, to reduce stock-outs and wastage at healthcare facilities.",
    "A secure system — with hashed passwords, JWT-based authentication, role-based access control, and HTTPS — that protects sensitive child and guardian data.",
    "A working prototype suitable for demonstration and evaluation as a Final Year Design Project, with an architecture extensible toward the enhancements in Section 10.",
):
    bullet(t)

# ================================================================== 10. FUTURE ENHANCEMENTS
heading("10. Future Enhancements", level=1)
for t in (
    "Integration with the national Birth Registration / EPI database for automated child verification.",
    "A dedicated mobile application for parents (Android/iOS).",
    "Full bilingual support (Bangla and English) across the interface and notifications.",
    "Vaccine coverage-gap and outbreak-risk analysis using AI-driven analytics.",
    "A telemedicine / teleconsultation module for post-vaccination queries.",
    "Integration with national health information systems to enable nationwide deployment.",
):
    bullet(t)

# ================================================================== 11. CONCLUSION
heading("11. Conclusion", level=1)
body("VaxTrace provides a centralized, easy-to-use web platform for managing child immunization "
     "records in line with Bangladesh’s National Immunization Schedule [7]. By combining a single "
     "Next.js application with automated scheduling and multi-channel reminders backed by MongoDB, "
     "the project demonstrates a practical approach to reducing missed vaccinations and improving "
     "record-keeping for parents, healthcare workers, and administrators alike. The requirements, "
     "architecture, data model, and workflow defined in this SRS provide a complete and verifiable "
     "basis for the implementation and defense of the system.")

# ================================================================== 12. REFERENCES
heading("12. References", level=1)
refs = [
    "Vercel, “Next.js Documentation.” [Online]. Available: https://nextjs.org/docs",
    "MongoDB, Inc., “MongoDB Documentation.” [Online]. Available: https://www.mongodb.com/docs/",
    "“NextAuth.js Documentation.” [Online]. Available: https://next-auth.js.org/",
    "“Introduction to JSON Web Tokens (JWT).” [Online]. Available: https://jwt.io/introduction",
    "“Nodemailer Documentation.” [Online]. Available: https://nodemailer.com/about/",
    "World Health Organization, “Expanded Programme on Immunization (EPI).” [Online]. Available: https://www.who.int/teams/immunization-vaccines-and-biologicals",
    "Directorate General of Health Services (DGHS), Bangladesh, “National Immunization Schedule, EPI Bangladesh.”",
    "IEEE, IEEE Std 830-1998, “IEEE Recommended Practice for Software Requirements Specifications,” Institute of Electrical and Electronics Engineers, 1998.",
    "MongoDB, Inc., “MongoDB Atlas Documentation.” [Online]. Available: https://www.mongodb.com/docs/atlas/",
    "ISO/IEC 25010:2011, “Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models,” International Organization for Standardization, 2011.",
    "OWASP Foundation, “OWASP Top Ten Web Application Security Risks.” [Online]. Available: https://owasp.org/www-project-top-ten/",
]
for i, r in enumerate(refs, 1):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Inches(0.5)
    p.paragraph_format.first_line_indent = Inches(-0.5)
    p.paragraph_format.space_after = Pt(4)
    rr = p.add_run("[%d]  " % i); rr.bold = True
    p.add_run(r)

# ------------------------------------------------------------------ update fields on open
settings = doc.settings.element
uf = OxmlElement("w:updateFields"); uf.set(qn("w:val"), "true"); settings.append(uf)

out = os.path.join(BASE, "VaxTrace_SRS_Final.docx")
doc.save(out)
print("Saved:", out)
print("Figures embedded:", FIG_N["n"], "| Tables captioned:", TAB_N["n"])
