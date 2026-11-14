// Initial master profile, taken from Oshri_Nizri_CV.pdf plus facts confirmed in the spec interview.
// Seeded into master_profile_items on first run; edited later from the Profile screen.

export const PROFILE_KINDS = [
  "summary",
  "role",
  "project",
  "achievement",
  "education",
  "course",
  "certification",
  "skill",
  "language",
  "military",
  "volunteer",
] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];

export const KIND_LABELS: Record<ProfileKind, string> = {
  summary: "תקציר",
  role: "ניסיון תעסוקתי",
  project: "פרויקטים",
  achievement: "הישגים",
  education: "השכלה",
  course: "קורסים",
  certification: "הסמכות",
  skill: "כישורים",
  language: "שפות",
  military: "שירות צבאי",
  volunteer: "התנדבות",
};

export interface ProfileItem {
  id?: string;
  kind: ProfileKind;
  title: string;
  org?: string;
  start_date?: string;
  end_date?: string;
  details: string;
  tags: string[];
}

export const PROFILE_SEED: ProfileItem[] = [
  {
    kind: "summary",
    title: "Profile",
    details:
      "Experienced data professional skilled in advanced analytics and BI tools to drive strategic decision-making and operational improvements. Experienced in complex data integration projects and cross-functional collaboration.",
    tags: [],
  },
  {
    kind: "role",
    title: "Data Analyst",
    org: "Bank Hapoalim (via G-STAT)",
    start_date: "2022-10-01",
    details: [
      "Deep-dive analyses to identify business trends, reduce operational risks and support data-driven decisions.",
      "Generating and maintaining reports and dashboards for internal stakeholders and external regulators (e.g. Bank of Israel).",
      "Developing and maintaining data infrastructure to improve reporting efficiency.",
      "Tools: SQL, SAS, Teradata, Starburst, Qlik — extracting, cleaning and manipulating datasets.",
    ].join("\n"),
    tags: ["SQL", "SAS", "Teradata", "Starburst", "Qlik", "banking", "regulatory reporting", "dashboards"],
  },
  {
    kind: "role",
    title: "System Analyst & Data Integration Engineer",
    org: "Ministry of Health",
    start_date: "2021-07-01",
    end_date: "2022-09-30",
    details: [
      "Designing and reviewing data properties of SQL-based clinical reports.",
      "Responsible for complex integrations between medical systems.",
      "Characterizing and testing SQL stored procedures and RDL reports.",
      "Data manipulations to filter out irrelevant information.",
      "Technical lead for the QA team.",
    ].join("\n"),
    tags: ["SQL", "stored procedures", "RDL", "SSRS", "integration", "healthcare", "tech lead"],
  },
  {
    kind: "role",
    title: "Applicative & Data QA Engineer",
    org: "Ministry of Health",
    start_date: "2020-02-01",
    end_date: "2021-06-30",
    details: [
      "Quality and integration tests across Dev, Test and Production.",
      "Built sanity and regression test scripts.",
      "Monitored bugs using SQL queries.",
      "Worked with data analysts to enhance live system dashboards in Excel.",
    ].join("\n"),
    tags: ["QA", "SQL", "Excel", "healthcare"],
  },
  {
    kind: "role",
    title: "System Implementer",
    org: "Ichilov Hospital",
    start_date: "2018-01-01",
    end_date: "2020-01-31",
    details: [
      "Implemented SAP system model and a new information system (Chameleon).",
      "Handled customer requests and guided best practices of system use.",
      "Trained new team members.",
    ].join("\n"),
    tags: ["SAP", "implementation", "healthcare", "training"],
  },
  {
    kind: "role",
    title: "Corpsman",
    org: "IDF",
    start_date: "2009-03-01",
    end_date: "2013-03-31",
    details: "",
    tags: [],
  },
  {
    kind: "education",
    title: "B.Sc. Industrial Engineering and Management",
    org: "Shenkar College",
    start_date: "2015-10-01",
    end_date: "2019-08-31",
    details: "",
    tags: [],
  },
  {
    kind: "course",
    title: "Data Analyst Course",
    org: "DataMaze",
    start_date: "2021-01-01",
    end_date: "2021-04-30",
    details: "",
    tags: [],
  },
  {
    kind: "course",
    title: "AI Data Analyst Course",
    org: "G-STAT",
    details: "Details to be completed in the enrichment interview.",
    tags: ["AI"],
  },
  {
    kind: "skill",
    title: "Core skills",
    details: "SQL, Excel, SAS, Starburst, Teradata, Qlik",
    tags: ["SQL", "Excel", "SAS", "Starburst", "Teradata", "Qlik"],
  },
  {
    kind: "skill",
    title: "Python (basic)",
    details: "Learned Python years ago; recently uses it again with AI assistance (AI-assisted scripting/analysis). Familiarity level, not production experience. Counts as partial coverage for jobs listing Python as a requirement.",
    tags: ["Python", "AI-assisted coding"],
  },
];

/** Render the master profile as compact text for prompts. */
export function profileToText(items: ProfileItem[]): string {
  return items
    .map((i) => {
      const when = i.start_date ? ` (${i.start_date.slice(0, 7)} – ${i.end_date ? i.end_date.slice(0, 7) : "present"})` : "";
      const head = `[${i.kind}] ${i.title}${i.org ? ` — ${i.org}` : ""}${when}`;
      return i.details ? `${head}\n${i.details}` : head;
    })
    .join("\n\n");
}
