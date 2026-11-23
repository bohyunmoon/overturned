import { createHash } from "node:crypto";

/**
 * Protects the owner's model bill.
 *
 * Every request that can reach the model passes through `guard`, which:
 *
 *   1. limits each visitor (by hashed IP address) per hour and per day;
 *   2. caps AI requests for the whole site per day, after which the site
 *      keeps working without AI (keyword reader, standard letter wording);
 *   3. keeps hourly and daily usage counts; and
 *   4. emails the owner (via Resend) when usage is accelerating or a cap is
 *      being approached. A phone push through ntfy is also supported.
 *
 * Counts live in Upstash Redis when it is connected, so they are shared by
 * every copy of the site. Without it, each copy counts on its own in memory:
 * that still slows a single abuser but cannot enforce a site-wide cap or
 * detect acceleration, so alerts are off in that mode.
 *
 * The guard fails open. If the counter store is unreachable, visitors are
 * not blocked; the failure is logged.
 */

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};

export const limits = () => ({
  /** AI requests one visitor may make per hour and per day. */
  ipHourly: num("RATE_IP_HOURLY", 30),
  ipDaily: num("RATE_IP_DAILY", 100),
  /** AI requests the whole site may make per day (UTC). */
  dailyCap: num("DAILY_AI_CAP", 500),
  /** Diagnostic checks one visitor may run per hour. */
  healthHourly: 6,
});

/* ---------- pure rules (unit tested) ---------- */

/** An hour's count is checked for a spike each time it doubles past this. */
export const SPIKE_FLOOR = 20;
export const SPIKE_RATIO = 3;

/** True at 20, 40, 80, 160, …: the moments an hour's count is examined. */
export function isCheckpoint(count: number): boolean {
  if (count < SPIKE_FLOOR || count % SPIKE_FLOOR !== 0) return false;
  const n = count / SPIKE_FLOOR;
  return (n & (n - 1)) === 0;
}

/**
 * Usage is accelerating when this hour, at a checkpoint, is at least three
 * times the average of the previous six hours. Because checkpoints double,
 * a surge that keeps growing alerts again at each doubling.
 */
export function spikeAlert(count: number, previousHours: number[]): { baseline: number } | null {
  if (!isCheckpoint(count)) return null;
  const baseline = previousHours.length ? previousHours.reduce((a, b) => a + b, 0) / previousHours.length : 0;
  return count >= SPIKE_RATIO * baseline ? { baseline: Math.round(baseline * 10) / 10 } : null;
}

/** The share of the daily cap just reached, if this request crossed 50%, 80% or 100%. */
export function capAlert(count: number, cap: number): 50 | 80 | 100 | null {
  if (count === cap) return 100;
  if (count === Math.ceil(cap * 0.8)) return 80;
  if (count === Math.ceil(cap * 0.5)) return 50;
  return null;
}

/** Today has passed double yesterday's total (and is not trivially small). */
export function dayOverDayAlert(today: number, yesterday: number): boolean {
  return yesterday >= 10 && today >= 50 && today === 2 * yesterday;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
export const hourKey = (d: Date) => `${dayKey(d)}${pad(d.getUTCHours())}`;

/** Visitors are counted by a hash that changes daily, never by raw IP address. */
export function visitorId(req: Request, day: string): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${day}:${ip}`).digest("hex").slice(0, 16);
}

/* ---------- counter stores ---------- */

export interface CounterStore {
  kind: "redis" | "memory";
  /** Add one to each key (creating it with the given lifetime) and return the new counts. */
  incr(keys: [key: string, ttlSeconds: number][]): Promise<number[]>;
  get(keys: string[]): Promise<number[]>;
  /** True the first time it is called for a key, false afterwards. */
  once(key: string, ttlSeconds: number): Promise<boolean>;
  /** Keep a short text note, such as the last alert delivery problem. */
  note(key: string, text: string, ttlSeconds: number): Promise<void>;
  readNote(key: string): Promise<string>;
}

export class MemoryStore implements CounterStore {
  kind = "memory" as const;
  private data = new Map<string, { n: number; expires: number }>();
  private notes = new Map<string, string>();
  constructor(private now: () => number = Date.now) {}
  async note(key: string, text: string) {
    this.notes.set(key, text);
  }
  async readNote(key: string) {
    return this.notes.get(key) ?? "";
  }
  private read(key: string) {
    const e = this.data.get(key);
    if (e && e.expires <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }
  async incr(keys: [string, number][]) {
    if (this.data.size > 5000) for (const k of this.data.keys()) this.read(k);
    return keys.map(([key, ttl]) => {
      const e = this.read(key) ?? { n: 0, expires: this.now() + ttl * 1000 };
      e.n += 1;
      this.data.set(key, e);
      return e.n;
    });
  }
  async get(keys: string[]) {
    return keys.map((k) => this.read(k)?.n ?? 0);
  }
  async once(key: string, ttl: number) {
    if (this.read(key)) return false;
    this.data.set(key, { n: 1, expires: this.now() + ttl * 1000 });
    return true;
  }
}

/** Upstash Redis over its REST API. No client library needed. */
class RedisStore implements CounterStore {
  kind = "redis" as const;
  constructor(private url: string, private token: string) {}
  private async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`counter store answered ${res.status}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    const failed = out.find((r) => r.error);
    if (failed) throw new Error(`counter store error: ${failed.error}`);
    return out.map((r) => r.result);
  }
  async incr(keys: [string, number][]) {
    const out = await this.pipeline(keys.flatMap(([k, ttl]) => [["SET", k, 0, "EX", ttl, "NX"], ["INCR", k]]));
    return keys.map((_, i) => Number(out[i * 2 + 1]));
  }
  async get(keys: string[]) {
    if (!keys.length) return [];
    const [values] = (await this.pipeline([["MGET", ...keys]])) as [unknown[]];
    return values.map((v) => Number(v ?? 0));
  }
  async once(key: string, ttl: number) {
    const [r] = await this.pipeline([["SET", key, 1, "EX", ttl, "NX"]]);
    return r === "OK";
  }
  async note(key: string, text: string, ttl: number) {
    await this.pipeline([["SET", key, text.slice(0, 300), "EX", ttl]]);
  }
  async readNote(key: string) {
    const [r] = await this.pipeline([["GET", key]]);
    return typeof r === "string" ? r : "";
  }
}

const memory = new MemoryStore();

export function sharedStoreConfigured(): boolean {
  return Boolean(redisEnv());
}
function redisEnv() {
  const url = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "").trim();
  const token = (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  return url && token ? { url, token } : null;
}
function store(): CounterStore {
  const env = redisEnv();
  return env ? new RedisStore(env.url, env.token) : memory;
}

/* ---------- alerts ---------- */

const ntfyTopic = () => (process.env.NTFY_TOPIC ?? "").trim();
const emailConfig = () => {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  const to = (process.env.ALERT_EMAIL ?? "").trim();
  // Resend's shared sender only delivers to the Resend account's own address,
  // which is exactly what an alert to the site owner needs.
  const from = (process.env.ALERT_FROM ?? "Overturned alerts <onboarding@resend.dev>").trim();
  return key && to ? { key, to, from } : null;
};

/** Which alert channels are set up, e.g. ["email"]. */
export const alertChannels = () => [...(emailConfig() ? ["email"] : []), ...(ntfyTopic() ? ["ntfy"] : [])];
export const alertsConfigured = () => alertChannels().length > 0 && sharedStoreConfigured();

type Priority = "default" | "high" | "urgent";

const ALERT_ERROR_KEY = "ot:alert:lasterror";

/** Send an alert on every channel that is set up. Never throws. Returns false if any channel failed. */
async function push(title: string, body: string, priority: Priority, tags: string): Promise<boolean | void> {
  const problems = (await Promise.all([sendEmail(title, body, priority), sendNtfy(title, body, priority, tags)])).filter(Boolean);
  if (problems.length) {
    console.error("alert not delivered:", problems.join("; "));
    try {
      await store().note(ALERT_ERROR_KEY, `${new Date().toISOString()} ${problems.join("; ")}`, 7 * DAY);
    } catch {
      /* the log line above is the record */
    }
  }
  return problems.length === 0;
}

/** Returns a short description of what went wrong, or "" on success or when email is not set up. */
async function sendEmail(title: string, body: string, priority: Priority): Promise<string> {
  const cfg = emailConfig();
  if (!cfg) return "";
  const api = (process.env.RESEND_API_URL ?? "https://api.resend.com").trim().replace(/\/$/, "");
  try {
    const res = await fetch(`${api}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: cfg.from,
        to: [cfg.to],
        subject: priority === "urgent" ? `[URGENT] ${title}` : title,
        text: `${body}\n\nSent by your Overturned site. To change limits or stop these emails, edit the environment variables in Vercel.`,
      }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.ok) return "";
    const detail = (await res.text().catch(() => "")).replace(/re_[\w-]+/g, "[key removed]")
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[address removed]") // the diagnostics page is public
      .replace(/\s+/g, " ")
      .slice(0, 200);
    return `email: Resend answered ${res.status} ${detail}`;
  } catch (err) {
    return `email: ${err instanceof Error ? err.message : "request failed"}`;
  }
}

/** Phone push through ntfy. Header values stay ASCII. */
async function sendNtfy(title: string, body: string, priority: Priority, tags: string): Promise<string> {
  const topic = ntfyTopic();
  if (!topic) return "";
  const server = (process.env.NTFY_SERVER ?? "https://ntfy.sh").trim().replace(/\/$/, "");
  try {
    const res = await fetch(`${server}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: { Title: title, Priority: priority, Tags: tags },
      body,
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return res.ok ? "" : `ntfy answered ${res.status}`;
  } catch (err) {
    return `ntfy: ${err instanceof Error ? err.message : "request failed"}`;
  }
}

/* ---------- the guard ---------- */

export type GuardResult =
  | { ok: true; /** False once the site-wide daily cap is spent. */ ai: boolean }
  | { ok: false };

const HOUR = 3600;
const DAY = 86_400;

export async function guard(
  req: Request,
  kind: "ai" | "health",
  deps: { store?: CounterStore; now?: Date; notify?: typeof push } = {},
): Promise<GuardResult> {
  const s = deps.store ?? store();
  const now = deps.now ?? new Date();
  const notify = deps.notify ?? push;
  const L = limits();
  const day = dayKey(now);
  const hour = hourKey(now);
  const who = visitorId(req, day);
  const site = req.headers.get("host") ?? "the site";

  try {
    if (kind === "health") {
      const [n] = await s.incr([[`ot:hc:${who}:${hour}`, HOUR]]);
      return n > L.healthHourly ? { ok: false } : { ok: true, ai: true };
    }

    // 1. This visitor.
    const [ipHour, ipDay] = await s.incr([
      [`ot:ip:${who}:h:${hour}`, HOUR],
      [`ot:ip:${who}:d:${day}`, DAY],
    ]);
    if (ipHour > L.ipHourly || ipDay > L.ipDaily) {
      const first = ipHour === L.ipHourly + 1 || ipDay === L.ipDaily + 1;
      if (first && s.kind === "redis" && (await s.once(`ot:alert:ip:${who}:${day}`, DAY))) {
        await notify(
          "Overturned: a visitor hit the rate limit",
          `One visitor on ${site} reached the limit (${L.ipHourly} per hour, ${L.ipDaily} per day) and is being turned away. No action needed unless this repeats.`,
          "default",
          "no_entry",
        );
      }
      return { ok: false };
    }

    // 2. The whole site. Requests turned away above never count against the cap.
    const [siteHour, siteDay] = await s.incr([
      [`ot:h:${hour}`, 8 * DAY],
      [`ot:d:${day}`, 40 * DAY],
    ]);

    if (s.kind === "redis") await watch({ s, now, siteHour, siteDay, cap: L.dailyCap, site, notify });

    return { ok: true, ai: siteDay <= L.dailyCap };
  } catch (err) {
    console.error("rate limiter unavailable, allowing the request:", err instanceof Error ? err.message : err);
    return { ok: true, ai: true };
  }
}

/** Decide whether this request is the one that should wake the owner. */
async function watch(a: {
  s: CounterStore;
  now: Date;
  siteHour: number;
  siteDay: number;
  cap: number;
  site: string;
  notify: typeof push;
}): Promise<void> {
  const { s, now, siteHour, siteDay, cap, site, notify } = a;

  // First counted request after an alert channel is connected: confirm it works, once per channel set.
  const channels = alertChannels();
  // If delivery fails (a wrong address, say), it is tried again ten minutes later rather than never.
  const hello = `ot:alert:hello:${channels.join("+")}`;
  if (channels.length && !(await s.readNote(`${hello}:sent`)) && (await s.once(hello, 600))) {
    const delivered = await notify(
      "Overturned: alerts are connected",
      `You will be alerted here when AI usage on ${site} is accelerating or nearing the daily cap of ${cap} requests.`,
      "default",
      "white_check_mark",
    );
    if (delivered !== false) await s.note(`${hello}:sent`, "1", 365 * DAY);
  }

  if (isCheckpoint(siteHour)) {
    const previous = await s.get(
      Array.from({ length: 6 }, (_, i) => `ot:h:${hourKey(new Date(now.getTime() - (i + 1) * HOUR * 1000))}`),
    );
    const spike = spikeAlert(siteHour, previous);
    if (spike) {
      await notify(
        "Overturned: usage is accelerating",
        `${siteHour} AI requests so far this hour on ${site}, against an average of ${spike.baseline} per hour over the previous six hours. Today so far: ${siteDay} of ${cap}.`,
        siteHour >= 160 ? "urgent" : "high",
        "chart_with_upwards_trend",
      );
    }
  }

  const share = capAlert(siteDay, cap);
  if (share) {
    await notify(
      share === 100 ? "Overturned: daily AI cap reached" : `Overturned: ${share}% of the daily AI cap used`,
      share === 100
        ? `${site} has made ${cap} AI requests today. AI features are off until midnight UTC; the site still works with the keyword reader and standard letter wording.`
        : `${site} has made ${siteDay} of ${cap} AI requests allowed today.`,
      share === 100 ? "urgent" : share === 80 ? "high" : "default",
      share === 100 ? "rotating_light" : "warning",
    );
  }

  if (siteDay >= 50 && siteDay % 2 === 0) {
    const [yesterday] = await s.get([`ot:d:${dayKey(new Date(now.getTime() - DAY * 1000))}`]);
    if (dayOverDayAlert(siteDay, yesterday)) {
      await notify(
        "Overturned: today is double yesterday",
        `${siteDay} AI requests so far today on ${site}, twice yesterday's total of ${yesterday}.`,
        "high",
        "chart_with_upwards_trend",
      );
    }
  }
}

/** For the owner's diagnostics page. */
export async function usageSnapshot(now: Date = new Date()) {
  const L = limits();
  const base = {
    store: sharedStoreConfigured() ? ("redis" as const) : ("memory" as const),
    alerts: alertsConfigured(),
    alertChannels: alertChannels(),
    limits: L,
  };
  try {
    const [thisHour, today] = await store().get([`ot:h:${hourKey(now)}`, `ot:d:${dayKey(now)}`]);
    const lastAlertProblem = await store().readNote(ALERT_ERROR_KEY);
    return { ...base, aiRequestsThisHour: thisHour, aiRequestsToday: today, ...(lastAlertProblem ? { lastAlertProblem } : {}) };
  } catch {
    return { ...base, storeError: true };
  }
}
