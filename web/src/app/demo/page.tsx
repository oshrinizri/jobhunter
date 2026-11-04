// Design preview with sample data — viewable before the database is connected.
import { connection } from "next/server";
import { Suspense } from "react";
import { JobCard, type FeedJob } from "@/components/job-card";

const sample = (): FeedJob[] => [
  {
    id: "demo-1",
    title: "Data Analyst - Product Data & AI Quality",
    company: "Similarweb",
    location: "Tel Aviv-Yafo",
    remote: "hybrid",
    posted_at: new Date(Date.now() - 86400_000).toISOString(),
    first_seen_at: new Date().toISOString(),
    total: 86,
    explanation: "התאמה גבוהה: SQL ודשבורדים מכסים את רוב הדרישות, וניסיון בדיווח רגולטורי הוא יתרון. חסר ניסיון ב-Python לניתוחי AI.",
    tags: ["hybrid", "new"],
    missing_skills: ["Python"],
    commute_transit_min: 38,
    commute_drive_min: 22,
    application_status: null,
    filtered_out: null,
  },
  {
    id: "demo-2",
    title: "Data Analyst",
    company: "AppsFlyer",
    location: "Herzliya",
    remote: "unknown",
    posted_at: new Date(Date.now() - 4 * 86400_000).toISOString(),
    first_seen_at: new Date().toISOString(),
    total: 72,
    explanation: "התפקיד מתאים לרמה שלך. הנסיעה להרצליה בגבול (42 דק׳ ברכב), והחברה עובדת בעיקר באנגלית.",
    tags: ["english"],
    missing_skills: ["Looker", "dbt"],
    commute_transit_min: 52,
    commute_drive_min: 42,
    application_status: "saved",
    filtered_out: null,
  },
  {
    id: "demo-3",
    title: "Big Data Engineer",
    company: "Similarweb",
    location: "Tel Aviv, Israel",
    remote: "unknown",
    posted_at: new Date(Date.now() - 9 * 86400_000).toISOString(),
    first_seen_at: new Date().toISOString(),
    total: 48,
    explanation: "כיוון Data Engineer: יש בסיס SQL חזק, אבל רוב הדרישות הן Spark, Airflow ו-Python שלא מופיעים בפרופיל.",
    tags: [],
    missing_skills: ["Spark", "Airflow", "Python"],
    commute_transit_min: 35,
    commute_drive_min: 21,
    application_status: null,
    filtered_out: null,
  },
];

async function SampleList() {
  await connection(); // sample dates are relative to "now" → render per request
  return (
    <div className="space-y-3">
      {sample().map((j) => (
        <JobCard key={j.id} job={j} />
      ))}
    </div>
  );
}

export default function DemoPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-mid-soft px-4 py-2 text-sm text-mid">תצוגה לדוגמה, נתונים לא אמיתיים</div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">משרות</h1>
        <span className="text-sm text-muted">3 משרות</span>
      </div>
      <Suspense>
        <SampleList />
      </Suspense>
    </div>
  );
}
