# Fakerni — Project Report (LaTeX / Overleaf)

This folder contains two self-contained LaTeX reports. Pick the one you want:

- **`Fakerni_PFE_Report.tex`** — the full **ESPRIT-style internship/PFE report**
  (title page → dedication → acknowledgements → abstract → context → requirements
  → 6 sprints → conclusion → webography). This is the one modelled on a standard
  Tunisian PFE report layout. **Use this one.**
- `rapport.tex` — an earlier, simpler report kept for reference.

## Compile on Overleaf
1. Go to [overleaf.com](https://www.overleaf.com) → **New Project** → **Upload Project**.
2. Zip this `report/` folder (so the zip contains the `.tex` files and the
   `images/` subfolder) and upload it — or drag the files in.
3. In Overleaf, open **Menu → Main document** and choose
   `Fakerni_PFE_Report.tex`. Set the compiler to **pdfLaTeX**, then **Recompile**.

## Before you submit — 1) edit your details
Open `Fakerni_PFE_Report.tex` and change the values in the **"EDIT THESE"** block
near the top (the `\my...` commands):

| Command | Put here |
|---|---|
| `\mySchool` | Your school / university |
| `\myReportType` | `INTERNSHIP REPORT` or `END-OF-STUDIES PROJECT REPORT` |
| `\myDegree`, `\mySpecialization` | Your programme + specialization |
| `\myAuthor` | Your full name |
| `\myCompany` | The host firm's name |
| `\myProSupervisor` | Supervisor at the firm |
| `\myAcadSupervisor` | Supervisor at the school |
| `\myPresentedOn`, `\myPeriod`, `\myAcademicYear` | Dates |

Also fill the bracketed `[ ... ]` placeholders inside **Chapter 1** (company
description, activities, departments) and the hardware table in Chapter 2.

## Before you submit — 2) add your figures
Every diagram is inserted with a `\figph{filename.png}{caption}` command. If the
file is **missing**, the report still compiles and shows a labelled placeholder
box telling you which file to add. Drop your images into `images/` using these
names (the diagrams marked ✅ are already included):

| File in `images/` | What it is |
|---|---|
| `school-logo.png`, `company-logo.png` | Logos on the title page |
| `uc-global.png` | Global use-case diagram |
| `architecture.png` ✅ | Architecture diagram |
| `erd.png` ✅ | Entity–relationship diagram |
| `gantt.png` | Gantt chart |
| `uc-*.png` | Per-sprint use-case diagrams (authenticate, rbac, groups, lists, budget, ai, realtime, dashboard) |
| `seq-*.png` | Sequence diagrams (login, add-item, budget, ai, realtime, dashboard) |
| `class-sprint1/2/3.png` | Class diagrams |
| `web-login.png` ✅, `web-fakra.png` ✅, `web-dashboard.png` ✅ | Web screenshots |
| `mobile-fakra.png` ✅, `mobile-dashboard.png` ✅ | Mobile screenshots |
| `budget-analytics.png`, `ai-smartadd.png`, `realtime-presence.png` | Feature screenshots |

You can draw the UML diagrams in draw.io / Lucidchart / StarUML and export them as
PNG into `images/` with the names above.

## Notes
- Uses only standard packages that Overleaf ships with by default.
- The Table of Contents, List of Figures, and List of Tables are generated
  automatically — recompile twice so the page numbers settle.
