import { mkdirSync } from "fs";
import puppeteer from "puppeteer-core";

const BASE = "http://127.0.0.1:3000";
const OUT = "demo-shots/pop-charts-2026-09-28";
mkdirSync(OUT, { recursive: true });

function mergeCookies(jar, setCookies) {
  const map = new Map();
  if (jar.cookie) {
    for (const part of jar.cookie.split("; ")) {
      const i = part.indexOf("=");
      if (i > 0) map.set(part.slice(0, i), part.slice(i + 1));
    }
  }
  for (const raw of setCookies || []) {
    const nv = raw.split(";")[0];
    const i = nv.indexOf("=");
    if (i > 0) map.set(nv.slice(0, i), nv.slice(i + 1));
  }
  jar.cookie = [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(email, password) {
  const jar = { cookie: "" };
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  mergeCookies(jar, csrfRes.headers.getSetCookie?.() || []);
  const { csrfToken } = await csrfRes.json();
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    json: "true",
    callbackUrl: `${BASE}/dashboard`,
  });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: jar.cookie,
    },
    body,
    redirect: "manual",
  });
  mergeCookies(jar, res.headers.getSetCookie?.() || []);
  // follow if needed
  const sess = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: jar.cookie },
  });
  mergeCookies(jar, sess.headers.getSetCookie?.() || []);
  const session = await sess.json();
  return { jar, session };
}

function cookieObjects(cookieHeader) {
  return cookieHeader.split("; ").filter(Boolean).map((c) => {
    const i = c.indexOf("=");
    return {
      name: c.slice(0, i),
      value: decodeURIComponent(c.slice(i + 1)),
      domain: "127.0.0.1",
      path: "/",
    };
  });
}

const roles = [
  {
    name: "admin",
    email: "admin@adnabbit.com",
    password: "admin123!",
    path: "/admin/analytics?range=7",
  },
  {
    name: "advertiser",
    email: "demo.advertiser@adnabbit.com",
    password: "demo123!",
    path: "/analytics?range=7",
  },
  {
    name: "host",
    email: "demo.host@adnabbit.com",
    password: "host123!",
    path: "/host/analytics?range=7",
  },
];

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,1200"],
});

for (const r of roles) {
  const { jar, session } = await login(r.email, r.password);
  console.log(r.name, "role=", session?.user?.role || "NONE");
  if (!session?.user) continue;
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
  // Force dark theme via localStorage before nav
  await page.goto('about:blank');
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem("theme", "dark");
    } catch {}
  });
  await page.setCookie(...cookieObjects(jar.cookie));
  const url = `${BASE}${r.path}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  // wait for chart or empty state
  await page.waitForSelector("h1, h2, canvas, .recharts-wrapper", {
    timeout: 30000,
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  const path = `${OUT}/${r.name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log("saved", path);
  await page.close();
}

await browser.close();
console.log("done");
