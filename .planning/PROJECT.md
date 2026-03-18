# Job Application Automation Chrome Extension

## What This Is

A Chrome extension that automates job applications by generating ATS-optimized CVs tailored to specific job descriptions and auto-filling application forms across multiple job sites (LinkedIn, Indeed, Glassdoor, company sites).

## Core Value

Job seekers can automatically apply to jobs with customized, ATS-optimized CVs that dramatically increase their chances of passing applicant tracking systems and getting interviews.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Manual job description input via popup form
- [ ] Browser action to capture job descriptions from web pages
- [ ] AI-powered CV generation with ATS optimization:
  - [ ] Keyword matching with job description
  - [ ] Skills highlighting and matching
  - [ ] Experience reordering by relevance
  - [ ] Format optimization for ATS parsing
  - [ ] Achievement metrics enhancement
- [ ] Local PDF storage for generated CVs
- [ ] Browser automation to fill application forms
- [ ] Automatic PDF upload during application
- [ ] Multi-site support (LinkedIn, Indeed, Glassdoor, company sites)
- [ ] Integration with existing LinkedIn profile CV generation (as base template)
- [ ] One-at-a-time job application workflow

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Batch processing** — Too complex for v1, focus on quality single applications
- **Cloud sync** — Privacy concerns, local storage sufficient for v1
- **Cover letter generation** — CV optimization is the core value, add later if needed
- **Application tracking** — Out of scope, users track in their own systems
- **Interview preparation** — Separate feature, not part of application flow

## Context

**Existing Codebase:**
- Chrome Extension Manifest V3 with TypeScript, React, Vite
- Background scripts, popup/options pages
- Current LinkedIn CV generation using OpenAI API
- PDF compilation with LaTeX
- Established patterns for Chrome extension architecture

**Technical Environment:**
- Chrome Extension API constraints (CSP, permissions)
- Browser automation challenges across different job sites
- ATS parsing requirements and best practices
- OpenAI API for content generation
- Local storage limitations and performance

**User Research/Feedback:**
- Job seekers struggle with ATS systems rejecting their applications
- Manual CV tailoring for each application is time-consuming
- Different job sites have varying form structures
- Users want to maintain quality while automating applications

## Constraints

- **Platform**: Chrome Extension Manifest V3 — Required for distribution and browser integration
- **AI Model**: OpenAI API — Existing integration, reliable for text generation
- **Storage**: Local browser storage — Privacy first, v1 MVP
- **Automation**: Browser automation APIs — Technical complexity, varies by site
- **ATS Compatibility**: Must work with major ATS systems (Workday, Taleo, Greenhouse, etc.)
- **Performance**: CV generation must complete in <30 seconds
- **Privacy**: User data never leaves browser without explicit consent

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Integrate existing LinkedIn CV as base template | Leverage working code, maintain user's professional identity | — Pending |
| Browser action for job capture (not auto-scraping) | More reliable, respects site ToS, user controls what's captured | — Pending |
| Local storage only | Privacy-focused, simpler v1, no backend costs | — Pending |
| One-at-a-time workflow | Focus on quality over quantity, manageable complexity | — Pending |
| Multi-site support from start | Users apply to jobs across platforms, not just LinkedIn | — Pending |
| ATS optimization over generic CV generation | Core differentiator, directly addresses user pain point | — Pending |

---
*Last updated: 2025-03-18 after project initialization*
