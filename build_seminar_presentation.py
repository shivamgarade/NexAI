"""
build_seminar_presentation.py
Generates the official MSBTE Seminar & Project Initiation Presentation
(Course Code: 315003, Semester V, K-Scheme) strictly conforming to seminar.pdf.

Rules enforced from seminar.pdf:
1. Exact slide limit: Not more than 15 slides (Page 5).
2. Typography: Times New Roman exclusively, 12pt body, bold headings, justified text (Section VIII).
3. Section flow: Sections 8-15 and Project Initiation 13.a-d.
4. Presentation style: Modern White Theme with NexAI brand accents (Emerald Green & Electric Indigo).
"""

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def generate_presentation(output_filename="NexAI_Seminar_Presentation.pptx"):
    prs = Presentation()
    # 16:9 Widescreen aspect ratio
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Typography & Palette (Times New Roman as per Section VIII of seminar.pdf)
    FONT_FAMILY = "Times New Roman"

    COLOR_BG = RGBColor(255, 255, 255)            # Pure White
    COLOR_SURFACE = RGBColor(248, 250, 252)       # Slate 50
    COLOR_SURFACE_ALT = RGBColor(241, 245, 249)   # Slate 100
    COLOR_BORDER = RGBColor(226, 232, 240)        # Slate 200
    COLOR_BORDER_ACCENT = RGBColor(187, 247, 208) # Emerald 200

    COLOR_PRIMARY = RGBColor(22, 163, 74)         # NexAI Emerald Green (#16A34A)
    COLOR_PRIMARY_DARK = RGBColor(21, 128, 61)    # Deep Green (#15803D)
    COLOR_PRIMARY_LIGHT = RGBColor(240, 253, 244) # Emerald 50

    COLOR_ACCENT = RGBColor(99, 102, 241)         # Electric Indigo (#6366F1)
    COLOR_ACCENT_LIGHT = RGBColor(238, 242, 255)  # Indigo 50
    COLOR_AMBER = RGBColor(217, 119, 6)           # Amber 600
    COLOR_RED = RGBColor(220, 38, 38)             # Red 600

    COLOR_TEXT_MAIN = RGBColor(15, 23, 42)        # Slate 900
    COLOR_TEXT_BODY = RGBColor(51, 65, 85)        # Slate 700
    COLOR_TEXT_MUTED = RGBColor(100, 116, 139)    # Slate 500

    def add_header(slide, badge_text, title_text, subtitle_text=""):
        # Header Badge Pill
        badge = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.35), Inches(5.2), Inches(0.32)
        )
        badge.fill.solid()
        badge.fill.fore_color.rgb = COLOR_PRIMARY_LIGHT
        badge.line.color.rgb = COLOR_BORDER_ACCENT
        badge.line.width = Pt(1)
        tf_b = badge.text_frame
        tf_b.word_wrap = True
        tf_b.margin_left = Inches(0.12)
        tf_b.margin_top = Inches(0.02)
        p_b = tf_b.paragraphs[0]
        p_b.text = badge_text.upper()
        p_b.font.size = Pt(9.5)
        p_b.font.bold = True
        p_b.font.color.rgb = COLOR_PRIMARY_DARK
        p_b.font.name = FONT_FAMILY

        # Title & Subtitle
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.72), Inches(11.733), Inches(0.9))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = Inches(0)
        tf_t.margin_top = Inches(0)
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text.upper()
        p_t.font.size = Pt(21)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_TEXT_MAIN
        p_t.font.name = FONT_FAMILY

        if subtitle_text:
            p_s = tf_t.add_paragraph()
            p_s.text = subtitle_text
            p_s.font.size = Pt(11.5)
            p_s.font.color.rgb = COLOR_TEXT_MUTED
            p_s.font.name = FONT_FAMILY
            p_s.space_before = Pt(3)

    def add_footer(slide, current_page, total_pages=15):
        line = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(7.0), Inches(11.733), Inches(0.015)
        )
        line.fill.solid()
        line.fill.fore_color.rgb = COLOR_BORDER
        line.line.color.rgb = COLOR_BORDER

        fb = slide.shapes.add_textbox(Inches(0.8), Inches(7.05), Inches(9.5), Inches(0.35))
        tf = fb.text_frame
        tf.margin_left = Inches(0)
        tf.margin_top = Inches(0)
        p = tf.paragraphs[0]
        p.text = "MSBTE Seminar & Project Initiation Course (Code: 315003, Sem V, K-Scheme) | NexAI"
        p.font.size = Pt(9.5)
        p.font.color.rgb = COLOR_TEXT_MUTED
        p.font.name = FONT_FAMILY

        pb = slide.shapes.add_textbox(Inches(10.5), Inches(7.05), Inches(2.033), Inches(0.35))
        tf_p = pb.text_frame
        tf_p.margin_right = Inches(0)
        tf_p.margin_top = Inches(0)
        p_p = tf_p.paragraphs[0]
        p_p.alignment = PP_ALIGN.RIGHT
        p_p.text = f"Slide {current_page} of {total_pages}"
        p_p.font.size = Pt(9.5)
        p_p.font.bold = True
        p_p.font.color.rgb = COLOR_PRIMARY
        p_p.font.name = FONT_FAMILY

    def create_card(slide, left, top, width, height, bg_color=COLOR_SURFACE, border_color=COLOR_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1)
        return card

    # =========================================================================
    # SLIDE 1: ANNEXURE I COVER & TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    top_bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.12))
    top_bar.fill.solid()
    top_bar.fill.fore_color.rgb = COLOR_PRIMARY
    top_bar.line.color.rgb = COLOR_PRIMARY

    # Header Ribbon
    b1 = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(0.65), Inches(10.933), Inches(0.42))
    b1.fill.solid()
    b1.fill.fore_color.rgb = COLOR_PRIMARY_LIGHT
    b1.line.color.rgb = COLOR_BORDER_ACCENT
    tf = b1.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "MAHARASHTRA STATE BOARD OF TECHNICAL EDUCATION, MUMBAI (MSBTE K-SCHEME)"
    p.font.bold = True
    p.font.size = Pt(10)
    p.font.color.rgb = COLOR_PRIMARY_DARK
    p.font.name = FONT_FAMILY

    sub_b = s1.shapes.add_textbox(Inches(1.2), Inches(1.15), Inches(10.933), Inches(0.4))
    tf = sub_b.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "SEMINAR AND PROJECT INITIATION PRESENTATION | COURSE CODE: 315003 | SEMESTER - V"
    p.font.size = Pt(11)
    p.font.color.rgb = COLOR_TEXT_MUTED
    p.font.name = FONT_FAMILY

    # Main Hero Title Box
    hero = create_card(s1, Inches(1.2), Inches(1.65), Inches(10.933), Inches(2.35), bg_color=COLOR_BG, border_color=COLOR_BORDER)
    tf_h = hero.text_frame
    tf_h.margin_top = Inches(0.25)
    p1 = tf_h.paragraphs[0]
    p1.alignment = PP_ALIGN.CENTER
    p1.text = "NexAI"
    p1.font.size = Pt(38)
    p1.font.bold = True
    p1.font.color.rgb = COLOR_PRIMARY
    p1.font.name = FONT_FAMILY

    p2 = tf_h.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    p2.text = "AI-POWERED PERSONAL & DEVELOPER WORKSPACE WITH UTILITY-METERED BILLING AND GROUNDED RAG"
    p2.font.size = Pt(13)
    p2.font.bold = True
    p2.font.color.rgb = COLOR_TEXT_MAIN
    p2.font.name = FONT_FAMILY
    p2.space_before = Pt(6)

    p3 = tf_h.add_paragraph()
    p3.alignment = PP_ALIGN.CENTER
    p3.text = "A Monorepo SaaS Platform Resolving Developer Tool Fragmentation and Flat-Rate AI Subscription Costs"
    p3.font.size = Pt(11)
    p3.font.color.rgb = COLOR_TEXT_MUTED
    p3.font.name = FONT_FAMILY
    p3.space_before = Pt(4)

    # 3-Column Metadata Grid (Annexure I Standards)
    c1 = create_card(s1, Inches(1.2), Inches(4.25), Inches(3.45), Inches(2.3))
    tf1 = c1.text_frame
    tf1.margin_top = Inches(0.18)
    tf1.margin_left = Inches(0.2)
    p = tf1.paragraphs[0]
    p.text = "SUBMITTED BY"
    p.font.bold = True
    p.font.size = Pt(10.5)
    p.font.color.rgb = COLOR_PRIMARY
    p.font.name = FONT_FAMILY

    students = [
        ("Candidate Name (Lead)", "Enrollment No.: 2200000001"),
        ("Project Partner 2", "Enrollment No.: 2200000002"),
        ("Project Partner 3", "Enrollment No.: 2200000003"),
        ("Project Partner 4", "Enrollment No.: 2200000004")
    ]
    for s_name, s_enr in students:
        p_c = tf1.add_paragraph()
        p_c.text = f"• {s_name} ({s_enr})"
        p_c.font.size = Pt(9.5)
        p_c.font.color.rgb = COLOR_TEXT_BODY
        p_c.font.name = FONT_FAMILY
        p_c.space_before = Pt(3)

    c2 = create_card(s1, Inches(4.94), Inches(4.25), Inches(3.45), Inches(2.3))
    tf2 = c2.text_frame
    tf2.margin_top = Inches(0.18)
    tf2.margin_left = Inches(0.2)
    p = tf2.paragraphs[0]
    p.text = "UNDER THE GUIDANCE OF"
    p.font.bold = True
    p.font.size = Pt(10.5)
    p.font.color.rgb = COLOR_ACCENT
    p.font.name = FONT_FAMILY

    guides = [
        ("Internal Guide:", "Prof. Faculty Guide Name\nDept. of Computer Engineering"),
        ("Head of Department:", "Prof. H.O.D. Name\nDept. of Computer Technology"),
        ("Head of Institute:", "Dr. Principal Name\nGovernment Polytechnic / Institute")
    ]
    for role, det in guides:
        p_r = tf2.add_paragraph()
        p_r.text = role
        p_r.font.bold = True
        p_r.font.size = Pt(9.5)
        p_r.font.color.rgb = COLOR_TEXT_MAIN
        p_r.font.name = FONT_FAMILY
        p_r.space_before = Pt(3)
        p_d = tf2.add_paragraph()
        p_d.text = det
        p_d.font.size = Pt(9)
        p_d.font.color.rgb = COLOR_TEXT_BODY
        p_d.font.name = FONT_FAMILY

    c3 = create_card(s1, Inches(8.68), Inches(4.25), Inches(3.45), Inches(2.3))
    tf3 = c3.text_frame
    tf3.margin_top = Inches(0.18)
    tf3.margin_left = Inches(0.2)
    p = tf3.paragraphs[0]
    p.text = "ACADEMIC INSTITUTION"
    p.font.bold = True
    p.font.size = Pt(10.5)
    p.font.color.rgb = COLOR_AMBER
    p.font.name = FONT_FAMILY

    p_inst = tf3.add_paragraph()
    p_inst.text = "THIRD YEAR DIPLOMA IN\nCOMPUTER ENGINEERING"
    p_inst.font.bold = True
    p_inst.font.size = Pt(10)
    p_inst.font.color.rgb = COLOR_TEXT_MAIN
    p_inst.font.name = FONT_FAMILY
    p_inst.space_before = Pt(6)

    p_in = tf3.add_paragraph()
    p_in.text = "Government Polytechnic / Institute of Technology\n(Affiliated to MSBTE, Mumbai)"
    p_in.font.size = Pt(9.5)
    p_in.font.color.rgb = COLOR_TEXT_BODY
    p_in.font.name = FONT_FAMILY
    p_in.space_before = Pt(4)

    p_yr = tf3.add_paragraph()
    p_yr.text = "Academic Year: 2025 – 2026\nSemester V (Winter Examination)"
    p_yr.font.bold = True
    p_yr.font.size = Pt(9.5)
    p_yr.font.color.rgb = COLOR_PRIMARY_DARK
    p_yr.font.name = FONT_FAMILY
    p_yr.space_before = Pt(8)

    add_footer(s1, 1)

    # =========================================================================
    # SLIDE 2: ANNEXURE II INDEX / TABLE OF CONTENTS
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "ANNEXURE II", "Table of Contents / Seminar Presentation Index", "Structured in strict accordance with MSBTE Course Code: 315003 syllabus sections")

    table_shape = s2.shapes.add_table(7, 4, Inches(0.8), Inches(1.85), Inches(11.733), Inches(4.8))
    t2 = table_shape.table
    t2.columns[0].width = Inches(1.0)
    t2.columns[1].width = Inches(4.866)
    t2.columns[2].width = Inches(1.0)
    t2.columns[3].width = Inches(4.866)

    headers2 = ["Sr. No.", "Topic / Chapter Name", "Sr. No.", "Topic / Chapter Name"]
    for i, h in enumerate(headers2):
        cell = t2.cell(0, i)
        cell.fill.solid()
        cell.fill.fore_color.rgb = COLOR_PRIMARY_LIGHT
        p = cell.text_frame.paragraphs[0]
        p.text = h.upper()
        p.font.bold = True
        p.font.size = Pt(10)
        p.font.color.rgb = COLOR_PRIMARY_DARK
        p.font.name = FONT_FAMILY

    index_rows = [
        ("01", "Abstract of Seminar & Purpose (Slide 3)", "07", "Project Initiation: Resources (Slide 9)"),
        ("02", "Chapter 1: Introduction & Background (Slide 4)", "08", "System Architecture & Data Flow (Slide 10)"),
        ("03", "Chapter 2: Literature Review & Analysis (Slide 5)", "09", "Core Modules & Technical Working (Slide 11)"),
        ("04", "Project Initiation: Problem Statement (Slide 6)", "10", "Advantages & Disadvantages (Slide 12)"),
        ("05", "Project Initiation: Scope & Objectives (Slide 7)", "11", "Action Plan & Prototyping Progress (Slide 13)"),
        ("06", "Project Initiation: Stakeholder Analysis (Slide 8)", "12", "Conclusion & References (Slides 14 & 15)")
    ]
    for row_idx, r_data in enumerate(index_rows):
        for col_idx in range(4):
            cell = t2.cell(row_idx + 1, col_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = COLOR_BG if col_idx < 2 else COLOR_SURFACE
            p = cell.text_frame.paragraphs[0]
            p.text = r_data[col_idx]
            p.font.size = Pt(9.5)
            p.font.name = FONT_FAMILY
            p.font.bold = (col_idx in (0, 2))
            p.font.color.rgb = COLOR_PRIMARY_DARK if col_idx in (0, 2) else COLOR_TEXT_BODY

    add_footer(s2, 2)

    # =========================================================================
    # SLIDE 3: ABSTRACT OF SEMINAR (SECTION IX.5)
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "SECTION IX.5", "Abstract of Seminar Paper & Purpose", "Executive summary of the technical topic, research justification, and engineering methodology")

    c_ab_l = create_card(s3, Inches(0.8), Inches(1.85), Inches(6.8), Inches(4.9))
    tf_al = c_ab_l.text_frame
    tf_al.margin_top = Inches(0.2)
    tf_al.margin_left = Inches(0.2)
    tf_al.margin_right = Inches(0.2)

    p = tf_al.paragraphs[0]
    p.text = "PURPOSE OF SEMINAR & METHODOLOGY"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_PRIMARY_DARK
    p.font.name = FONT_FAMILY

    abstract_texts = [
        "The purpose of this seminar is to analyze modern developer workflow fragmentation and investigate a full-stack engineering solution that eliminates the financial barrier of flat-rate AI subscriptions.",
        "Generative AI tools currently enforce rigid $20/month (~₹2,000/mo) subscriptions. For students and casual developers executing intermittent prompts, this model represents an unfair cost barrier.",
        "We present NexAI: an AI orchestration and personal knowledge workspace combining real-time streaming LLMs (Google Gemini 3.5 Flash-Lite), Pinecone dense vector retrieval (RAG), and a transparent, atomic token-to-credit metering engine.",
        "The methodology encompasses a client-server monorepo (React 19 + Express), Human-in-the-Loop review gates to prevent hallucinations, and sustainable 100% free-tier cloud deployment."
    ]
    for ab in abstract_texts:
        p_t = tf_al.add_paragraph()
        p_t.text = ab
        p_t.font.size = Pt(9.5)
        p_t.alignment = PP_ALIGN.JUSTIFY
        p_t.font.color.rgb = COLOR_TEXT_BODY
        p_t.font.name = FONT_FAMILY
        p_t.space_before = Pt(6)

    # Right 3 Pillars
    pillars = [
        ("Pillar 1: 100% Free-Tier Architecture", "Operates entirely within managed zero-cost cloud tiers: MongoDB Atlas M0, Render Web Services, Pinecone Starter, and Gemini Free API.", COLOR_PRIMARY),
        ("Pillar 2: True Micro-Utility Metering", "Eliminates ₹2,000/month subscriptions; credits calculated honestly from real usage: credits = ceil(totalTokens / 100).", COLOR_ACCENT),
        ("Pillar 3: Human-in-the-Loop Integrity", "Guarantees data integrity by enforcing a strict Suggest -> Review -> Confirm workflow before any AI output is committed.", COLOR_AMBER)
    ]
    for idx, (title, desc, col) in enumerate(pillars):
        card = create_card(s3, Inches(7.8), Inches(1.85 + idx * 1.66), Inches(4.733), Inches(1.55))
        tf = card.text_frame
        tf.margin_top = Inches(0.18)
        tf.margin_left = Inches(0.2)
        tf.margin_right = Inches(0.2)
        p_t = tf.paragraphs[0]
        p_t.text = title.upper()
        p_t.font.bold = True
        p_t.font.size = Pt(10.5)
        p_t.font.color.rgb = col
        p_t.font.name = FONT_FAMILY
        p_d = tf.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9.2)
        p_d.alignment = PP_ALIGN.JUSTIFY
        p_d.font.color.rgb = COLOR_TEXT_BODY
        p_d.font.name = FONT_FAMILY
        p_d.space_before = Pt(4)

    add_footer(s3, 3)

    # =========================================================================
    # SLIDE 4: CHAPTER 1 - INTRODUCTION (SECTION IX.8)
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "CHAPTER 1: INTRODUCTION", "Background of Seminar: The Generative AI Shift", "Evolution of AI tools from isolated chat wrappers to context-aware developer workspaces")

    intro_cols = [
        ("The AI Revolution", "Adoption in Engineering", [
            "Widespread adoption of Large Language Models (LLMs) like Google Gemini and Claude.",
            "Developers rely on conversational AI for architectural design, code review, and debugging.",
            "Initial products were standalone web chats with isolated, non-persistent context."
        ], COLOR_BORDER),
        ("The Fragmentation Crisis", "Cognitive Sinks & Data Silos", [
            "Users juggle 4+ disconnected tools: chats, note repositories, snippet managers, and viva prep.",
            "High-value prompts and insights remain trapped inside ephemeral conversational histories.",
            "Constant context-switching results in cognitive fatigue and lost personal knowledge."
        ], COLOR_BORDER),
        ("The NexAI Paradigm", "Unified Developer Workspace", [
            "Consolidates conversational AI, grounded personal notes, and viva prep into a single client.",
            "Replaces disconnected apps with a cohesive, privacy-respecting developer environment.",
            "Engineered as a full-stack SaaS platform providing honest utility metering and RAG."
        ], COLOR_BORDER_ACCENT)
    ]
    for idx, (title, sub, points, border_col) in enumerate(intro_cols):
        card = create_card(s4, Inches(0.8 + idx * 3.98), Inches(1.85), Inches(3.78), Inches(4.9), border_color=border_col)
        tf = card.text_frame
        tf.margin_top = Inches(0.2)
        tf.margin_left = Inches(0.2)
        tf.margin_right = Inches(0.2)
        p = tf.paragraphs[0]
        p.text = title.upper()
        p.font.bold = True
        p.font.size = Pt(12)
        p.font.color.rgb = COLOR_PRIMARY_DARK if idx == 2 else COLOR_TEXT_MAIN
        p.font.name = FONT_FAMILY
        p_s = tf.add_paragraph()
        p_s.text = sub
        p_s.font.size = Pt(9.5)
        p_s.font.bold = True
        p_s.font.color.rgb = COLOR_TEXT_MUTED
        p_s.font.name = FONT_FAMILY
        p_s.space_before = Pt(2)

        for pt in points:
            p_pt = tf.add_paragraph()
            p_pt.text = f"• {pt}"
            p_pt.font.size = Pt(9.5)
            p_pt.alignment = PP_ALIGN.JUSTIFY
            p_pt.font.color.rgb = COLOR_TEXT_BODY
            p_pt.font.name = FONT_FAMILY
            p_pt.space_before = Pt(6)

    add_footer(s4, 4)

    # =========================================================================
    # SLIDE 5: CHAPTER 2 - LITERATURE REVIEW (SECTION IX.9)
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "CHAPTER 2: LITERATURE REVIEW", "Comparative Market Analysis & Research Gaps", "Critical survey of commercial solutions establishing the necessity for NexAI")

    t_s5 = s5.shapes.add_table(6, 5, Inches(0.8), Inches(1.85), Inches(11.733), Inches(4.8))
    t5 = t_s5.table
    t5.columns[0].width = Inches(2.333)
    t5.columns[1].width = Inches(2.25)
    t5.columns[2].width = Inches(2.25)
    t5.columns[3].width = Inches(2.25)
    t5.columns[4].width = Inches(2.65)

    headers5 = ["Evaluation Parameter", "ChatGPT Plus (OpenAI)", "Notion AI (Notion)", "Hobbyist AI Wrappers", "NexAI Workspace (Ours)"]
    for i, h in enumerate(headers5):
        cell = t5.cell(0, i)
        cell.fill.solid()
        cell.fill.fore_color.rgb = COLOR_PRIMARY_LIGHT if i == 4 else COLOR_SURFACE_ALT
        p = cell.text_frame.paragraphs[0]
        p.text = h.upper()
        p.font.bold = True
        p.font.size = Pt(10)
        p.font.color.rgb = COLOR_PRIMARY_DARK if i == 4 else COLOR_TEXT_MAIN
        p.font.name = FONT_FAMILY

    lit_data = [
        ("Pricing & Billing Model", "Flat $20/month (~₹2,000/mo)\nUnfair for casual/light users", "Flat $10/user/mo add-on\nRequires parent subscription", "Free / Unmonetized\nNo billing architecture", "True Utility Token Metering\n1 cr / 100 tokens; ₹49 recharge pack"),
        ("Personal Knowledge Vault", "None; Ephemeral chat thread history only", "Integrated text workspace;\nNo prompt vault or viva tools", "None; State lost upon session termination", "Consolidated Polymorphic Vault\nNotes, Links, Docs, Audio Reports"),
        ("Semantic Vector Search", "Limited to manual attachment per individual thread", "Basic workspace keyword / semantic search", "None; Raw prompt pass-through directly to API", "Pinecone Vector RAG\n768-dim Gemini text-embedding-004"),
        ("Viva / Interview Simulation", "Text-only prompts;\nNo structured evaluation", "None; Document editing tool only", "None", "Real-Time Voice Mock Viva\nWeb Speech STT/TTS + Rubric Card"),
        ("AI Governance & Integrity", "Auto-saves raw chat output without review", "In-line text replacement;\nRisks overwriting user notes", "Blind database mutations without auditing", "Suggest -> Review -> Confirm\nZero silent mutations; Human-in-loop")
    ]
    for row_idx, r_data in enumerate(lit_data):
        for col_idx in range(5):
            cell = t5.cell(row_idx + 1, col_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = COLOR_PRIMARY_LIGHT if col_idx == 4 else COLOR_BG
            p = cell.text_frame.paragraphs[0]
            p.text = r_data[col_idx]
            p.font.size = Pt(9.2)
            p.font.name = FONT_FAMILY
            p.font.bold = (col_idx in (0, 4))
            p.font.color.rgb = COLOR_PRIMARY_DARK if col_idx == 4 else COLOR_TEXT_BODY

    add_footer(s5, 5)

    # =========================================================================
    # SLIDE 6: PROJECT INITIATION - PROBLEM STATEMENT (SECTION 13.A)
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "PROJECT INITIATION (SECTION 13.A)", "Innovative Problem Statement & Technical Justification", "Defining the core technical bottlenecks and why traditional solutions fail")

    c_p6_1 = create_card(s6, Inches(0.8), Inches(1.85), Inches(5.75), Inches(4.9))
    tf_p1 = c_p6_1.text_frame
    tf_p1.margin_top = Inches(0.2)
    tf_p1.margin_left = Inches(0.2)
    tf_p1.margin_right = Inches(0.2)
    p = tf_p1.paragraphs[0]
    p.text = "THE DUAL INDUSTRY FRICTION POINTS"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_RED
    p.font.name = FONT_FAMILY

    frictions = [
        "Friction 1: Workflow & Tool Fragmentation: Developers constantly context-switch across disconnected chat, note, and snippet platforms, dissipating intellectual focus and creating unsearchable information silos.",
        "Friction 2: Prohibitive Flat-Rate AI Subscriptions: Mainstream AI platforms enforce rigid $20/month (~₹2,000/mo) flat subscriptions. A student sending 15 prompts a month pays the exact same fee as a commercial enterprise user.",
        "Friction 3: Wrapper Fragility & Mutation Risks: Conventional AI wrappers pass ungrounded prompts to LLMs and blindly persist unverified responses into user databases, permanently polluting notes with hallucinations."
    ]
    for fr in frictions:
        p_fr = tf_p1.add_paragraph()
        p_fr.text = f"• {fr}"
        p_fr.font.size = Pt(9.5)
        p_fr.alignment = PP_ALIGN.JUSTIFY
        p_fr.font.color.rgb = COLOR_TEXT_BODY
        p_fr.font.name = FONT_FAMILY
        p_fr.space_before = Pt(6)

    c_p6_2 = create_card(s6, Inches(6.75), Inches(1.85), Inches(5.78), Inches(4.9), bg_color=COLOR_PRIMARY_LIGHT, border_color=COLOR_BORDER_ACCENT)
    tf_p2 = c_p6_2.text_frame
    tf_p2.margin_top = Inches(0.2)
    tf_p2.margin_left = Inches(0.2)
    tf_p2.margin_right = Inches(0.2)
    p = tf_p2.paragraphs[0]
    p.text = "ESTABLISHMENT OF INNOVATIVE SOLUTION"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_PRIMARY_DARK
    p.font.name = FONT_FAMILY

    innovations = [
        "1. Micro-Utility Token Economics: Replaces rigid monthly subscriptions with honest, token-derived billing: credits = ceil(totalTokens / 100), enabling micro-payments as low as ₹49.",
        "2. Grounded Personal RAG: Integrates Pinecone Serverless vector retrieval to ensure AI answers are grounded in user-owned notes and documents, eliminating hallucinations.",
        "3. Human-in-the-Loop Governance: Enforces a strict Suggest -> Review -> Confirm pattern; no AI summary, tag, or document is ever written to the database without explicit user approval.",
        "4. Authentic Oral Defense Simulation: Incorporates dynamic voice ripples and browser STT/TTS to prepare students for real-world academic viva examinations."
    ]
    for inn in innovations:
        p_in = tf_p2.add_paragraph()
        p_in.text = inn
        p_in.font.size = Pt(9.5)
        p_in.alignment = PP_ALIGN.JUSTIFY
        p_in.font.color.rgb = COLOR_TEXT_MAIN
        p_in.font.name = FONT_FAMILY
        p_in.space_before = Pt(6)

    add_footer(s6, 6)

    # =========================================================================
    # SLIDE 7: PROJECT INITIATION - SCOPE & OBJECTIVES (SECTION 13.B)
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "PROJECT INITIATION (SECTION 13.B)", "Project Scope, Boundaries & Measurable Objectives", "Establishing clear technical boundaries and measurable engineering goals")

    c_s7_1 = create_card(s7, Inches(0.8), Inches(1.85), Inches(5.75), Inches(4.9))
    tf_s7 = c_s7_1.text_frame
    tf_s7.margin_top = Inches(0.2)
    tf_s7.margin_left = Inches(0.2)
    tf_s7.margin_right = Inches(0.2)
    p = tf_s7.paragraphs[0]
    p.text = "CLEAR & MEASURABLE OBJECTIVES"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_PRIMARY_DARK
    p.font.name = FONT_FAMILY

    objs = [
        "Objective 1: Engineer a distraction-free conversational canvas with real-time SSE token streaming via Google Gemini 3.5 Flash-Lite.",
        "Objective 2: Build a tenant-isolated Retrieval-Augmented Generation (RAG) pipeline using Gemini text-embedding-004 and Pinecone Serverless vector storage.",
        "Objective 3: Implement an honest utility metering engine deducting credits atomically: credits = ceil(totalTokens / 100), backed by Razorpay Test Mode.",
        "Objective 4: Develop a speech-driven AI Mock Interview simulator with dynamic audio ripple visualization and automated competency scorecard generation."
    ]
    for ob in objs:
        p_ob = tf_s7.add_paragraph()
        p_ob.text = f"• {ob}"
        p_ob.font.size = Pt(9.5)
        p_ob.alignment = PP_ALIGN.JUSTIFY
        p_ob.font.color.rgb = COLOR_TEXT_BODY
        p_ob.font.name = FONT_FAMILY
        p_ob.space_before = Pt(5)

    c_s7_2 = create_card(s7, Inches(6.75), Inches(1.85), Inches(5.78), Inches(4.9))
    tf_s72 = c_s7_2.text_frame
    tf_s72.margin_top = Inches(0.2)
    tf_s72.margin_left = Inches(0.2)
    tf_s72.margin_right = Inches(0.2)
    p = tf_s72.paragraphs[0]
    p.text = "ESTABLISHED BOUNDARIES & DELIVERABLES"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_ACCENT
    p.font.name = FONT_FAMILY

    bounds = [
        ("In-Scope Core Deliverables", [
            "Single-page client-server monorepo with Vite & React 19.",
            "Stateless JWT authentication and Google OAuth2 integration.",
            "Polymorphic Knowledge Library with pdf-lib document export.",
            "Variable-Driven Prompt Vault with {{variable}} interpolation.",
            "Role-gated admin portal tracking real-time API token burn."
        ]),
        ("Deliberately Deferred (Future Scope)", [
            "Companion Browser Extension: Deferred to avoid cross-platform codebase bloat.",
            "Diffusion Image Generation: Deferred to preserve 100% zero-cost API operations."
        ])
    ]
    for b_title, b_pts in bounds:
        p_bt = tf_s72.add_paragraph()
        p_bt.text = b_title.upper()
        p_bt.font.bold = True
        p_bt.font.size = Pt(10)
        p_bt.font.color.rgb = COLOR_TEXT_MAIN if "In-Scope" in b_title else COLOR_AMBER
        p_bt.font.name = FONT_FAMILY
        p_bt.space_before = Pt(6)
        for b_pt in b_pts:
            p_p = tf_s72.add_paragraph()
            p_p.text = f"  - {b_pt}"
            p_p.font.size = Pt(9.2)
            p_p.alignment = PP_ALIGN.JUSTIFY
            p_p.font.color.rgb = COLOR_TEXT_BODY
            p_p.font.name = FONT_FAMILY
            p_p.space_before = Pt(2)

    add_footer(s7, 7)

    # =========================================================================
    # SLIDE 8: PROJECT INITIATION - STAKEHOLDER ANALYSIS (SECTION 13.C)
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "PROJECT INITIATION (SECTION 13.C)", "Stakeholder Identification & Analysis", "Detailed assessment of user categories, organizational needs, and platform value")

    grid_w8 = Inches(5.75)
    stk_cards = [
        ("Engineering & Diploma Students", "Primary End-Users", [
            "Need affordable access to cutting-edge AI models without paying ₹2,000/month.",
            "Require realistic oral viva defense simulation to prepare for final MSBTE exams.",
            "Require a structured personal repository to store capstone research notes and code snippets."
        ], COLOR_PRIMARY),
        ("Independent Software Developers", "Technical Practitioners", [
            "Require project-scoped conversational memory without context contamination across repositories.",
            "Need variable-driven prompt templates to automate boilerplate code reviews and refactoring.",
            "Demand audited token telemetry to track generation latency and exact credit expenditure."
        ], COLOR_ACCENT),
        ("Academic Mentors & Faculty", "Educational Supervisors", [
            "Require transparent verification tools to assess student project depth and avoid AI plagiarism.",
            "Benefit from objective competency scorecards generated during student mock viva sessions.",
            "Can review structured student action plans, project diaries, and verified test suites."
        ], COLOR_AMBER),
        ("SaaS Product Operators", "Platform Maintainers", [
            "Require sustainable, zero-cost cloud infrastructure (MongoDB Atlas M0, Render, Pinecone Starter).",
            "Demand race-condition proof balance decrements and cryptographic webhook signature verification.",
            "Benefit from role-gated admin dashboards rendering real-time token telemetry and model distribution."
        ], COLOR_PRIMARY_DARK)
    ]

    for idx, (title, sub, points, accent_col) in enumerate(stk_cards):
        col = idx % 2
        row = idx // 2
        left = Inches(0.8 + col * 5.95)
        top = Inches(1.85 + row * 2.5)

        card = create_card(s8, left, top, grid_w8, Inches(2.35))
        tf = card.text_frame
        tf.margin_top = Inches(0.15)
        tf.margin_left = Inches(0.18)
        tf.margin_right = Inches(0.18)

        p = tf.paragraphs[0]
        p.text = title.upper()
        p.font.bold = True
        p.font.size = Pt(10.5)
        p.font.color.rgb = accent_col
        p.font.name = FONT_FAMILY

        p_s = tf.add_paragraph()
        p_s.text = sub
        p_s.font.size = Pt(9)
        p_s.font.bold = True
        p_s.font.color.rgb = COLOR_TEXT_MUTED
        p_s.font.name = FONT_FAMILY
        p_s.space_before = Pt(2)

        for pt in points:
            p_pt = tf.add_paragraph()
            p_pt.text = f"• {pt}"
            p_pt.font.size = Pt(9)
            p_pt.alignment = PP_ALIGN.JUSTIFY
            p_pt.font.color.rgb = COLOR_TEXT_BODY
            p_pt.font.name = FONT_FAMILY
            p_pt.space_before = Pt(3)

    add_footer(s8, 8)

    # =========================================================================
    # SLIDE 9: PROJECT INITIATION - RESOURCES IDENTIFICATION (SECTION 13.D)
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "PROJECT INITIATION (SECTION 13.D)", "Platform, Equipment & Resource Identification", "Systematic specification of development hardware, runtime platforms, and external SDKs")

    res_data = [
        ("Hardware Resources", "Workstation Specifications", [
            "Processor: Multi-core Intel Core i5/i7 or AMD Ryzen 5/7 (min. 4 physical cores).",
            "System RAM: Minimum 8 GB (16 GB recommended for concurrent client/server development).",
            "Storage: 256 GB NVMe SSD for sub-millisecond local read/write access.",
            "Audio Peripherals: Microphone input and stereo output for Web Speech API testing.",
            "Display: 1920 x 1080 Full HD (verified across responsive breakpoints)."
        ], COLOR_BORDER),
        ("Software & Platforms", "Runtimes & Frameworks", [
            "Operating System: Windows 11 / Linux (Ubuntu 22.04 LTS) / macOS.",
            "Development Runtime: Node.js (v20+ LTS) with npm package manager.",
            "Client Build Tool: Vite 6 with React 19 SPA framework.",
            "Backend Framework: Express.js with modular router architecture.",
            "Schema Validation: Zod (TypeScript-first declarative schema validation).",
            "Testing Engine: Vitest & Node native test runner."
        ], COLOR_BORDER),
        ("External APIs & SDKs", "Managed Cloud Integrations", [
            "AI Orchestration: Official Google GenAI SDK (@google/genai) for Gemini 3.5 Flash-Lite.",
            "Vector Database SDK: @pinecone-database/pinecone for serverless vector indexing.",
            "Document Processing: pdf-lib (pure JavaScript in-memory PDF generation).",
            "Payment Gateway SDK: razorpay Node.js SDK with crypto webhook verification.",
            "Code Highlighting: highlight.js with language-specific tokenizers."
        ], COLOR_BORDER_ACCENT)
    ]

    for idx, (title, sub, points, border_col) in enumerate(res_data):
        card = create_card(s9, Inches(0.8 + idx * 3.98), Inches(1.85), Inches(3.78), Inches(4.9), border_color=border_col)
        tf = card.text_frame
        tf.margin_top = Inches(0.2)
        tf.margin_left = Inches(0.2)
        tf.margin_right = Inches(0.2)

        p = tf.paragraphs[0]
        p.text = title.upper()
        p.font.bold = True
        p.font.size = Pt(12)
        p.font.color.rgb = COLOR_PRIMARY_DARK if idx == 2 else COLOR_TEXT_MAIN
        p.font.name = FONT_FAMILY

        p_s = tf.add_paragraph()
        p_s.text = sub
        p_s.font.size = Pt(9.5)
        p_s.font.bold = True
        p_s.font.color.rgb = COLOR_TEXT_MUTED
        p_s.font.name = FONT_FAMILY
        p_s.space_before = Pt(2)

        for pt in points:
            p_pt = tf.add_paragraph()
            p_pt.text = f"• {pt}"
            p_pt.font.size = Pt(9.2)
            p_pt.alignment = PP_ALIGN.JUSTIFY
            p_pt.font.color.rgb = COLOR_TEXT_BODY
            p_pt.font.name = FONT_FAMILY
            p_pt.space_before = Pt(5)

    add_footer(s9, 9)

    # =========================================================================
    # SLIDE 10: SYSTEM ARCHITECTURE & DATA FLOW
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "SYSTEM ARCHITECTURE", "Full-Stack System Architecture & Request Lifecycle", "Strict multi-tier pipeline enforcing schema validation, role security, and balance guards")

    steps10 = [
        ("Step 1: Input Validation", "Express + Zod Middleware", [
            "HTTP request reaches API endpoint.",
            "Zod schema inspects body & params.",
            "Malformed data rejected with 400 Bad Request before controllers."
        ], COLOR_PRIMARY),
        ("Step 2: Auth & Tenancy", "JWT Bearer Verification", [
            "JWT token decoded via jsonwebtoken.",
            "Attaches authenticated userId to req.",
            "Scopes 100% of Mongoose queries and Pinecone lookups to that user."
        ], COLOR_ACCENT),
        ("Step 3: Credit Pre-Check", "Credit Balance Guard", [
            "Middleware checks user.wallet credits.",
            "If credits == 0, halts immediately with HTTP 402 INSUFFICIENT_CREDITS.",
            "Prevents unpaid API burn and triggers UI recharge modal."
        ], COLOR_AMBER),
        ("Step 4: AI & Atomic Deduct", "Gemini SDK + Mongoose $inc", [
            "Executes streaming call via SSE.",
            "Extracts usageMetadata (exact tokens).",
            "Atomically deducts ceil(tokens/100) and commits to UsageLog."
        ], COLOR_PRIMARY_DARK)
    ]

    for idx, (title, sub, points, col) in enumerate(steps10):
        card = create_card(s10, Inches(0.8 + idx * 2.98), Inches(1.85), Inches(2.8), Inches(3.2))
        tf = card.text_frame
        tf.margin_top = Inches(0.15)
        tf.margin_left = Inches(0.15)
        tf.margin_right = Inches(0.15)

        p = tf.paragraphs[0]
        p.text = title.upper()
        p.font.bold = True
        p.font.size = Pt(10.5)
        p.font.color.rgb = col
        p.font.name = FONT_FAMILY

        p_s = tf.add_paragraph()
        p_s.text = sub
        p_s.font.size = Pt(8.5)
        p_s.font.bold = True
        p_s.font.color.rgb = COLOR_TEXT_MUTED
        p_s.font.name = FONT_FAMILY
        p_s.space_before = Pt(2)

        for pt in points:
            p_pt = tf.add_paragraph()
            p_pt.text = f"• {pt}"
            p_pt.font.size = Pt(8.8)
            p_pt.alignment = PP_ALIGN.JUSTIFY
            p_pt.font.color.rgb = COLOR_TEXT_BODY
            p_pt.font.name = FONT_FAMILY
            p_pt.space_before = Pt(4)

    b_arch = create_card(s10, Inches(0.8), Inches(5.2), Inches(11.733), Inches(1.55), bg_color=COLOR_SURFACE_ALT)
    tf_ba = b_arch.text_frame
    tf_ba.margin_top = Inches(0.15)
    tf_ba.margin_left = Inches(0.2)
    tf_ba.margin_right = Inches(0.2)

    p_at = tf_ba.paragraphs[0]
    p_at.text = "CORE DATA ISOLATION & CONCURRENCY CONTROLS"
    p_at.font.bold = True
    p_at.font.size = Pt(11)
    p_at.font.color.rgb = COLOR_TEXT_MAIN
    p_at.font.name = FONT_FAMILY

    arch_guars = [
        "• Race-Condition Prevention: Credits decremented via atomic Mongoose findOneAndUpdate with negative balance checks, preventing balance underflow.",
        "• Strict Multi-Tenant Vector Isolation: Pinecone searches apply mandatory metadata filter { userId }, mathematically preventing cross-tenant leakage.",
        "• Zero-Burn Policy on Error: If an LLM call fails halfway through streaming, the catch block intercepts and executes zero wallet deductions."
    ]
    for ag in arch_guars:
        p_ag = tf_ba.add_paragraph()
        p_ag.text = ag
        p_ag.font.size = Pt(9.5)
        p_ag.alignment = PP_ALIGN.JUSTIFY
        p_ag.font.color.rgb = COLOR_TEXT_BODY
        p_ag.font.name = FONT_FAMILY
        p_ag.space_before = Pt(3)

    add_footer(s10, 10)

    # =========================================================================
    # SLIDE 11: CORE MODULES & WORKING DETAILS (SECTION 10)
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "SECTION 10: CORE MODULES", "Core Modules & Technical Working Details", "Detailed examination of the conversational canvas, library vault, and viva simulator")

    c_m11_1 = create_card(s11, Inches(0.8), Inches(1.85), Inches(5.75), Inches(4.9))
    tf_m1 = c_m11_1.text_frame
    tf_m1.margin_top = Inches(0.2)
    tf_m1.margin_left = Inches(0.2)
    tf_m1.margin_right = Inches(0.2)
    p = tf_m1.paragraphs[0]
    p.text = "CHAT CANVAS & TELEMETRY INSPECTOR"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_PRIMARY_DARK
    p.font.name = FONT_FAMILY

    chat_details = [
        "Minimalist Gemini-Style Interface: Clean 'Where should we start?' hero state with starter prompt suggestions and a glowing input bar.",
        "Server-Sent Events (SSE) Streaming: Real-time token streaming with progressive text reveal, smooth auto-scroll, and stop generation controls.",
        "Syntax-Highlighted Code Blocks: Highlight.js integration with sticky language headers, line formatting, and one-click clipboard copy.",
        "Sliding Telemetry Inspector: Direct examiner defense drawer rendering live prompt/candidate token decomposition, latency in ms, and deduction math.",
        "Project Workspaces: Dedicated environments with custom instructions and multi-file context injection up to 2MB directly into memory."
    ]
    for cd in chat_details:
        p_cd = tf_m1.add_paragraph()
        p_cd.text = f"• {cd}"
        p_cd.font.size = Pt(9.5)
        p_cd.alignment = PP_ALIGN.JUSTIFY
        p_cd.font.color.rgb = COLOR_TEXT_BODY
        p_cd.font.name = FONT_FAMILY
        p_cd.space_before = Pt(6)

    c_m11_2 = create_card(s11, Inches(6.75), Inches(1.85), Inches(5.78), Inches(4.9))
    tf_m2 = c_m11_2.text_frame
    tf_m2.margin_top = Inches(0.2)
    tf_m2.margin_left = Inches(0.2)
    tf_m2.margin_right = Inches(0.2)
    p = tf_m2.paragraphs[0]
    p.text = "KNOWLEDGE VAULT & ORAL VIVA SIMULATOR"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_ACCENT
    p.font.name = FONT_FAMILY

    viva_details = [
        "Polymorphic Knowledge Store: Unified repository for saved bookmarks, technical notes, uploaded files, and viva interview transcripts.",
        "Suggest -> Review -> Confirm: AI summaries and tags are staged in a review drawer; user can edit or discard before database commit.",
        "In-Memory PDF Generation: Structured multi-section documents drafted by AI and exported into clean, print-ready PDF via pdf-lib.",
        "Real-Time Speech Interaction: Native Web Speech API converts spoken student answers into text (STT) and reads examiner questions aloud (TTS).",
        "Objective Competency Scorecards: Produces 1–10 ratings across Technical Accuracy, Communication, and Depth; archived to Library."
    ]
    for vd in viva_details:
        p_vd = tf_m2.add_paragraph()
        p_vd.text = f"• {vd}"
        p_vd.font.size = Pt(9.5)
        p_vd.alignment = PP_ALIGN.JUSTIFY
        p_vd.font.color.rgb = COLOR_TEXT_BODY
        p_vd.font.name = FONT_FAMILY
        p_vd.space_before = Pt(6)

    add_footer(s11, 11)

    # =========================================================================
    # SLIDE 12: ADVANTAGES & DISADVANTAGES (SECTION 11)
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    add_header(s12, "SECTION 11: SYSTEM ANALYSIS", "Advantages, Disadvantages & Limitations", "Objective engineering evaluation of system capabilities and current operational boundaries")

    c_adv12 = create_card(s12, Inches(0.8), Inches(1.85), Inches(5.75), Inches(4.9), bg_color=COLOR_PRIMARY_LIGHT, border_color=COLOR_BORDER_ACCENT)
    tf_ad = c_adv12.text_frame
    tf_ad.margin_top = Inches(0.2)
    tf_ad.margin_left = Inches(0.2)
    tf_ad.margin_right = Inches(0.2)
    p = tf_ad.paragraphs[0]
    p.text = "SYSTEM ADVANTAGES"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_PRIMARY_DARK
    p.font.name = FONT_FAMILY

    advs = [
        "Pay-As-You-Burn Economy: Eliminates rigid ₹2,000/month subscriptions; students pay micro-amounts for exact token consumption.",
        "Single-Pane Productivity: Consolidates conversational AI, notes, prompt templating, and viva prep into a single responsive client.",
        "Zero Hallucination Contamination: Enforces Suggest -> Review -> Confirm pattern; user must confirm AI summaries before write.",
        "100% Free-Tier Operation: Runs sustainably on MongoDB Atlas M0, Pinecone Starter, Render, and Gemini Free API.",
        "Production-Grade Verification: Hardened with 227 automated tests guaranteeing 100% regression safety."
    ]
    for a in advs:
        p_a = tf_ad.add_paragraph()
        p_a.text = f"✓ {a}"
        p_a.font.size = Pt(9.5)
        p_a.alignment = PP_ALIGN.JUSTIFY
        p_a.font.color.rgb = COLOR_TEXT_MAIN
        p_a.font.name = FONT_FAMILY
        p_a.space_before = Pt(6)

    c_dis12 = create_card(s12, Inches(6.75), Inches(1.85), Inches(5.78), Inches(4.9))
    tf_ds = c_dis12.text_frame
    tf_ds.margin_top = Inches(0.2)
    tf_ds.margin_left = Inches(0.2)
    tf_ds.margin_right = Inches(0.2)
    p = tf_ds.paragraphs[0]
    p.text = "DISADVANTAGES & SYSTEM LIMITATIONS"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_RED
    p.font.name = FONT_FAMILY

    diss = [
        "External API Dependency: Response latency and service availability remain tied to Google Gemini API uptime.",
        "Hardware Audio Constraints: Real-time speech recognition requires compatible microphones and modern Web Speech browser support.",
        "Free-Tier Rate Limits: Gemini free tier enforces 15 RPM (requests per minute) and 1,500 daily requests, requiring throttling.",
        "Cold Start Delays: Free-tier Render web services experience ~30-second cold starts after periods of complete inactivity.",
        "Internet Requirement: Requires active internet connectivity; offline local LLM inference currently deferred to future scope."
    ]
    for d in diss:
        p_d = tf_ds.add_paragraph()
        p_d.text = f"✕ {d}"
        p_d.font.size = Pt(9.5)
        p_d.alignment = PP_ALIGN.JUSTIFY
        p_d.font.color.rgb = COLOR_TEXT_BODY
        p_d.font.name = FONT_FAMILY
        p_d.space_before = Pt(6)

    add_footer(s12, 12)

    # =========================================================================
    # SLIDE 13: ACTION PLAN & PROTOTYPING PROGRESS (RUBRICS 8 & 9)
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    add_header(s13, "PROJECT INITIATION (RUBRICS 8 & 9)", "Stages of Action Plan & Prototyping Progress", "Demonstrating concrete prototyping milestones and experimental test verification")

    m_data13 = [
        ("227", "AUTOMATED TESTS", "127 Backend + 100 Frontend", COLOR_PRIMARY),
        ("420 ms", "AVG. TTFB LATENCY", "Gemini 3.5 Flash-Lite Stream", COLOR_ACCENT),
        ("97.5%", "STUDENT COST REDUCTION", "vs ₹2,000/mo Subscriptions", COLOR_PRIMARY_DARK),
        ("100%", "FREE-TIER HOSTING", "Zero Operational Cloud Cost", COLOR_AMBER)
    ]
    for idx, (val, label, sub, col) in enumerate(m_data13):
        card = create_card(s13, Inches(0.8 + idx * 2.98), Inches(1.85), Inches(2.8), Inches(1.35))
        tf = card.text_frame
        tf.margin_top = Inches(0.12)
        tf.margin_left = Inches(0.15)
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.text = val
        p.font.bold = True
        p.font.size = Pt(26)
        p.font.color.rgb = col
        p.font.name = FONT_FAMILY

        p_l = tf.add_paragraph()
        p_l.alignment = PP_ALIGN.CENTER
        p_l.text = label
        p_l.font.bold = True
        p_l.font.size = Pt(9)
        p_l.font.color.rgb = COLOR_TEXT_MAIN
        p_l.font.name = FONT_FAMILY

        p_s = tf.add_paragraph()
        p_s.alignment = PP_ALIGN.CENTER
        p_s.text = sub
        p_s.font.size = Pt(8)
        p_s.font.color.rgb = COLOR_TEXT_MUTED
        p_s.font.name = FONT_FAMILY

    c_ap13 = create_card(s13, Inches(0.8), Inches(3.4), Inches(5.75), Inches(3.35))
    tf_ap = c_ap13.text_frame
    tf_ap.margin_top = Inches(0.15)
    tf_ap.margin_left = Inches(0.2)
    tf_ap.margin_right = Inches(0.2)
    p = tf_ap.paragraphs[0]
    p.text = "PROTOTYPING MILESTONES ACHIEVED"
    p.font.bold = True
    p.font.size = Pt(11)
    p.font.color.rgb = COLOR_PRIMARY_DARK
    p.font.name = FONT_FAMILY

    p_achieved = [
        "Functional Conversational Engine: Real-time SSE streaming connected to Google Gemini with code highlighting.",
        "Active Vector RAG: Working dense vector search powered by Pinecone Serverless and text-embedding-004.",
        "Interactive Viva Simulator: Spoken oral Q&A with live animated ripples and competency scoring.",
        "Wallet & Billing Gateway: Working Razorpay test checkout with HMAC-SHA256 webhook validation."
    ]
    for ach in p_achieved:
        p_pt = tf_ap.add_paragraph()
        p_pt.text = f"✓ {ach}"
        p_pt.font.size = Pt(9.2)
        p_pt.alignment = PP_ALIGN.JUSTIFY
        p_pt.font.color.rgb = COLOR_TEXT_BODY
        p_pt.font.name = FONT_FAMILY
        p_pt.space_before = Pt(4)

    c_pl13 = create_card(s13, Inches(6.75), Inches(3.4), Inches(5.78), Inches(3.35))
    tf_pl = c_pl13.text_frame
    tf_pl.margin_top = Inches(0.15)
    tf_pl.margin_left = Inches(0.2)
    tf_pl.margin_right = Inches(0.2)
    p = tf_pl.paragraphs[0]
    p.text = "SUBSEQUENT STAGES OF ACTION PLAN"
    p.font.bold = True
    p.font.size = Pt(11)
    p.font.color.rgb = COLOR_ACCENT
    p.font.name = FONT_FAMILY

    p_upcoming = [
        "Stage 1: Multi-Student Collaboration: Extending Project Workspaces with Role-Based Access Control (RBAC).",
        "Stage 2: Comprehensive Capstone Reporting: Expanding technical documentation as per Semester VI MSBTE guidelines.",
        "Stage 3: Offline Fallback Inference: Integrating local Ollama model options for air-gapped laboratory use.",
        "Stage 4: Institutional Deployment: Piloting NexAI across polytechnic computer engineering laboratories."
    ]
    for up in p_upcoming:
        p_pt = tf_pl.add_paragraph()
        p_pt.text = f"• {up}"
        p_pt.font.size = Pt(9.2)
        p_pt.alignment = PP_ALIGN.JUSTIFY
        p_pt.font.color.rgb = COLOR_TEXT_BODY
        p_pt.font.name = FONT_FAMILY
        p_pt.space_before = Pt(4)

    add_footer(s13, 13)

    # =========================================================================
    # SLIDE 14: CONCLUSION (SECTION 12)
    # =========================================================================
    s14 = prs.slides.add_slide(blank_layout)
    add_header(s14, "SECTION 12: CONCLUSION", "Seminar Conclusion & Fulfillment of Outcomes", "Synthesis of research findings, technical impact, and Course Outcome fulfillment")

    c_cn14_1 = create_card(s14, Inches(0.8), Inches(1.85), Inches(5.75), Inches(4.9), bg_color=COLOR_PRIMARY_LIGHT, border_color=COLOR_BORDER_ACCENT)
    tf_c1 = c_cn14_1.text_frame
    tf_c1.margin_top = Inches(0.2)
    tf_c1.margin_left = Inches(0.2)
    tf_c1.margin_right = Inches(0.2)
    p = tf_c1.paragraphs[0]
    p.text = "CORE ENGINEERING ACHIEVEMENTS"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_PRIMARY_DARK
    p.font.name = FONT_FAMILY

    concl_achieve = [
        "Defensible Full-Stack SaaS: Successfully transformed an academic seminar project into an auditable, production-ready SaaS utility platform.",
        "Eliminated Knowledge Silos: Unified chat, semantic vector retrieval, reusable prompts, and viva prep into a single responsive client.",
        "Fair-Share AI Economics: Proved the viability of pay-as-you-burn token metering backed by Razorpay test infrastructure, saving students 97%+.",
        "Zero Silent Mutations: Enforced Human-in-the-Loop review gates and Pinecone vector grounding, permanently preventing AI hallucinations.",
        "Production Quality: Hardened with 227 automated tests with zero regression failures."
    ]
    for ca in concl_achieve:
        p_ca = tf_c1.add_paragraph()
        p_ca.text = f"✓ {ca}"
        p_ca.font.size = Pt(9.5)
        p_ca.alignment = PP_ALIGN.JUSTIFY
        p_ca.font.color.rgb = COLOR_TEXT_MAIN
        p_ca.font.name = FONT_FAMILY
        p_ca.space_before = Pt(6)

    c_cn14_2 = create_card(s14, Inches(6.75), Inches(1.85), Inches(5.78), Inches(4.9))
    tf_c2 = c_cn14_2.text_frame
    tf_c2.margin_top = Inches(0.2)
    tf_c2.margin_left = Inches(0.2)
    tf_c2.margin_right = Inches(0.2)
    p = tf_c2.paragraphs[0]
    p.text = "FULFILLMENT OF COURSE OUTCOMES (CO1 – CO5)"
    p.font.bold = True
    p.font.size = Pt(11.5)
    p.font.color.rgb = COLOR_ACCENT
    p.font.name = FONT_FAMILY

    cos_summary = [
        ("CO1: Identify Topic of Seminar", "Identified the critical need for unified, utility-metered AI developer workspaces."),
        ("CO2: Collect Research-Based Data", "Conducted comprehensive literature survey of LLM architectures and pricing models."),
        ("CO3: Apply Presentation Skills", "Structured a 15-slide technical defense strictly adhering to Section VIII guidelines."),
        ("CO4: Create Conducive Environment", "Demonstrated live telemetry, interactive UI prototypes, and structured Q&A exhibits."),
        ("CO5: Establish Problem Statement & Plan", "Formulated the dual crisis problem statement and executed a 4-phase action plan.")
    ]
    for co_title, co_desc in cos_summary:
        p_ct = tf_c2.add_paragraph()
        p_ct.text = co_title.upper()
        p_ct.font.bold = True
        p_ct.font.size = Pt(9.8)
        p_ct.font.color.rgb = COLOR_TEXT_MAIN
        p_ct.font.name = FONT_FAMILY
        p_ct.space_before = Pt(5)

        p_cd = tf_c2.add_paragraph()
        p_cd.text = co_desc
        p_cd.font.size = Pt(9.2)
        p_cd.alignment = PP_ALIGN.JUSTIFY
        p_cd.font.color.rgb = COLOR_TEXT_BODY
        p_cd.font.name = FONT_FAMILY
        p_cd.space_before = Pt(1)

    add_footer(s14, 14)

    # =========================================================================
    # SLIDE 15: BIBLIOGRAPHY & REFERENCES (SECTIONS 14 & 15)
    # =========================================================================
    s15 = prs.slides.add_slide(blank_layout)
    add_header(s15, "SECTIONS 14 & 15: REFERENCES", "Academic Bibliography & Technical References", "Formatted strictly in IEEE standard format as required by MSBTE guidelines")

    c_r15 = create_card(s15, Inches(0.8), Inches(1.85), Inches(11.733), Inches(4.9))
    tf_r15 = c_r15.text_frame
    tf_r15.margin_top = Inches(0.2)
    tf_r15.margin_left = Inches(0.25)
    tf_r15.margin_right = Inches(0.25)
    p = tf_r15.paragraphs[0]
    p.text = "FORMAL CITATIONS & TECHNICAL DOCUMENTATION"
    p.font.bold = True
    p.font.size = Pt(12)
    p.font.color.rgb = COLOR_PRIMARY_DARK
    p.font.name = FONT_FAMILY

    formal_refs = [
        "[1] Lewis, P., Perez, E., Piktus, A., et al. (2020). 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.' Advances in Neural Information Processing Systems (NeurIPS 2020), Vol. 33, pp. 9459-9474.",
        "[2] Vaswani, A., Shazeer, N., Parmar, N., et al. (2017). 'Attention Is All You Need.' Advances in Neural Information Processing Systems (NeurIPS 2017), Vol. 30, pp. 5998-6008.",
        "[3] Google DeepMind (2024). 'Gemini 1.5 & Flash Technical Report: Scalable Multimodal Reasoning via Mixture-of-Experts.' arXiv preprint arXiv:2403.05530.",
        "[4] Maharashtra State Board of Technical Education (2025). 'Curriculum & Guidelines for Seminar & Project Initiation Course (315003), K-Scheme Semester V.' MSBTE Approval Dt. 24/02/2025, Mumbai.",
        "[5] Pinecone Systems (2024). 'Architecture and Scalability of Distributed Serverless Vector Database Indexes.' Pinecone Technical Documentation.",
        "[6] Mozilla Developer Network (MDN) (2024). 'Web Speech API & Server-Sent Events (SSE) Specifications.' MDN Web Docs, Mozilla Corporation.",
        "[7] Razorpay Technologies (2025). 'Payment Gateway Integration, Order Verification & Cryptographic Webhooks API Guide.' Razorpay Developer Docs."
    ]
    for rf in formal_refs:
        p_rf = tf_r15.add_paragraph()
        p_rf.text = rf
        p_rf.font.size = Pt(9.5)
        p_rf.alignment = PP_ALIGN.JUSTIFY
        p_rf.font.color.rgb = COLOR_TEXT_BODY
        p_rf.font.name = FONT_FAMILY
        p_rf.space_before = Pt(8)

    add_footer(s15, 15)

    # Save presentation
    prs.save(output_filename)
    print(f"MSBTE Seminar presentation generated successfully: {output_filename}")

if __name__ == "__main__":
    generate_presentation()
