// LinkedIn Job Alert emails, read from the user's Gmail over IMAP with an App Password (read-only).
// We use only what is in the email itself (title, company, location, link) — LinkedIn pages are never fetched.
// When the same job also appears on a board we scan, the fingerprint dedup merges it and keeps that full text.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { RawJob } from "../types";
import { detectRemote, htmlToText } from "../text";

const SENDERS = ["jobalerts-noreply@linkedin.com", "jobs-noreply@linkedin.com", "jobs-listings@linkedin.com"];

const GENERIC = /^(view job|apply|easy apply|see all jobs|view all|צפייה במשרה|הגשה|הגשה קלה|לכל המשרות|unsubscribe|ביטול)/i;

export interface AlertJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
}

/** Pull jobs out of one LinkedIn alert email's HTML. Tolerant: works on the fragment between consecutive job links. */
export function parseAlertHtml(html: string): AlertJob[] {
  const links = [...html.matchAll(/href="([^"]*linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)[^"]*)"/gi)];
  const firstIndex = new Map<string, number>();
  for (const m of links) if (!firstIndex.has(m[2])) firstIndex.set(m[2], m.index ?? 0);
  const ordered = [...firstIndex.entries()].sort((a, b) => a[1] - b[1]);

  const jobs: AlertJob[] = [];
  ordered.forEach(([id, start], i) => {
    const end = ordered[i + 1]?.[1] ?? Math.min(html.length, start + 6000);
    const fragment = html.slice(start, end);
    // Each job card is a small table: one text cell with the title, the next with "Company · Location".
    const lines = [...fragment.matchAll(/<(?:td|p|span|h\d)[^>]*>([^<]+)</gi)]
      .map((m) => htmlToText(m[1]).replace(/\s+/g, " ").trim())
      .filter((l) => l && !GENERIC.test(l) && !/^(\d+ )?(applicants?|מועמדים)|promoted|קודם|actively recruiting|מגייסים|^·$/i.test(l));

    const title = lines[0];
    if (!title) return;
    const after = lines.slice(1);
    // Usually "Company · Location" on one line, or company and location on consecutive lines.
    let company = "", location: string | null = null;
    const dotted = after.find((l) => l.includes("·"));
    if (dotted && after.indexOf(dotted) <= 1) {
      const [c, ...rest] = dotted.split("·").map((s) => s.trim());
      company = c;
      location = rest.join(", ") || null;
    } else {
      company = after[0] ?? "";
      location = after[1] ?? null;
    }
    jobs.push({ id, title, company: company || "לא צוין", location });
  });
  return jobs;
}

export function alertJobToRaw(j: AlertJob, receivedAt: Date | null): RawJob {
  const url = `https://www.linkedin.com/jobs/view/${j.id}/`;
  // "Ramat Gan (Hybrid)" → location "Ramat Gan"; the workplace type still feeds remote detection.
  const location = j.location?.replace(/\s*\([^)]*\)\s*/g, " ").trim() || null;
  return {
    source: "linkedin_email",
    externalId: j.id,
    url,
    title: j.title,
    company: j.company,
    location,
    remote: detectRemote(`${j.location ?? ""} ${j.title}`),
    description: `(מתוך התראת LinkedIn — אין תיאור מלא. כותרת: ${j.title}; חברה: ${j.company}; מיקום: ${j.location ?? "לא צוין"})`,
    applyEmail: null,
    applyUrl: url,
    postedAt: receivedAt ? receivedAt.toISOString() : null,
  };
}

/** Read LinkedIn alert emails from the last `days` days. Opens the mailbox read-only (nothing is marked as read). */
export async function fetchLinkedInAlerts(opts: { user: string; appPassword: string; days?: number }): Promise<RawJob[]> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: opts.user, pass: opts.appPassword.replace(/\s+/g, "") },
    logger: false,
  });
  await client.connect();
  const out = new Map<string, RawJob>();
  try {
    // "All Mail" (special-use \All) also covers archived mail; its name is localized, so find it by flag.
    const boxes = await client.list();
    const allMail = boxes.find((b) => b.specialUse === "\\All")?.path ?? "INBOX";
    const lock = await client.getMailboxLock(allMail, { readOnly: true });
    try {
      const since = new Date(Date.now() - (opts.days ?? 3) * 86400_000);
      // Job alerts come from jobalerts-noreply@, but "X and Y are hiring" job digests come from messages-noreply@.
      // Search all LinkedIn mail and keep only messages that contain job links.
      const uids = await client.search({ or: SENDERS.map((from) => ({ from })).concat([{ from: "linkedin.com" }]), since }, { uid: true });
      if (uids && uids.length) {
        const jobUids: number[] = [];
        for await (const m of client.fetch(uids, { envelope: true }, { uid: true })) {
          const from = m.envelope?.from?.[0]?.address ?? "";
          const subject = m.envelope?.subject ?? "";
          if (SENDERS.includes(from) || /hiring|job|משרה|משרות|מגייס/i.test(subject)) jobUids.push(m.uid);
        }
        if (!jobUids.length) return [];
        for await (const msg of client.fetch(jobUids.slice(-60), { source: true, internalDate: true }, { uid: true })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const html = typeof parsed.html === "string" ? parsed.html : "";
          if (!html) continue;
          const received = parsed.date ?? (msg.internalDate ? new Date(msg.internalDate) : null);
          for (const j of parseAlertHtml(html)) if (!out.has(j.id)) out.set(j.id, alertJobToRaw(j, received));
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return [...out.values()];
}
