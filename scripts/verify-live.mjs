#!/usr/bin/env node
/**
 * verify-live.mjs — End-to-end smoke test for provenance-model-guard Vercel deploy
 * Usage: node scripts/verify-live.mjs
 * Returns exit code 1 if any check fails.
 */

const BASE = "https://provenance-model-guard.vercel.app";

const results = [];

function pass(name, notes = "") {
  results.push({ status: "PASS", name, notes });
}

function fail(name, expected, actual, fix = "") {
  results.push({ status: "FAIL", name, expected, actual, fix });
}

function info(name, notes) {
  results.push({ status: "INFO", name, notes });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchCheck(url, opts = {}) {
  const res = await fetch(url, { redirect: "follow", ...opts });
  return res;
}

async function fetchText(url, opts = {}) {
  const res = await fetchCheck(url, opts);
  const text = await res.text();
  return { res, text };
}

// ---------------------------------------------------------------------------
// Parallel requests
// ---------------------------------------------------------------------------

const [
  rootResult,
  cleanResult,
  messyResult,
  pristineResult,
  faviconResult,
  missingApiResult,
  pathTraversalResult,
] = await Promise.all([
  fetchText(BASE + "/", {
    headers: { "Accept-Encoding": "gzip, br", Accept: "text/html" },
  }),
  fetchCheck(BASE + "/samples/clean_dcf_v1.xlsx"),
  fetchCheck(BASE + "/samples/messy_dcf_v2.xlsx"),
  fetchCheck(BASE + "/samples/pristine_dcf.xlsx"),
  fetchCheck(BASE + "/favicon.ico"),
  fetchCheck(BASE + "/api/whatever-doesnt-exist"),
  fetchCheck(BASE + "/samples/../../etc/passwd"),
]);

// ---------------------------------------------------------------------------
// Check: GET /  → 200
// ---------------------------------------------------------------------------
{
  const { res, text: html } = rootResult;
  if (res.status === 200) {
    pass("GET / → 200");
  } else {
    fail("GET / → 200", "200", String(res.status), "Check Vercel deployment logs");
  }

  // Content-type
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    pass("GET / content-type is text/html", ct);
  } else {
    fail("GET / content-type", "text/html", ct);
  }

  // HTML size
  const sizeKB = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
  if (parseFloat(sizeKB) >= 10 && parseFloat(sizeKB) <= 100) {
    pass("GET / HTML size in range", `${sizeKB} KB`);
  } else {
    fail("GET / HTML size", "10–100 KB", `${sizeKB} KB`, "Check for runaway server-rendered content");
  }
  info("GET / HTML size", `${sizeKB} KB`);

  // ---------------------------------------------------------------------------
  // Title tag
  // ---------------------------------------------------------------------------
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  if (title.toLowerCase().includes("provenance model guard") || title.toLowerCase().includes("provenance-model-guard")) {
    pass("<title> contains 'Provenance Model Guard'", title);
  } else {
    fail("<title> check", "Provenance Model Guard...", title, "Update <title> in the Next.js layout");
  }

  // ---------------------------------------------------------------------------
  // Hero copy
  // ---------------------------------------------------------------------------
  const heroTerms = ["Pre-submission", "Diff-aware", "MCP-native"];
  for (const term of heroTerms) {
    if (html.includes(term)) {
      pass(`Hero text: "${term}" present`);
    } else {
      fail(`Hero text: "${term}"`, `String present in HTML`, "Not found", `Add/restore hero copy in landing page`);
    }
  }

  // ---------------------------------------------------------------------------
  // MCP tool names
  // ---------------------------------------------------------------------------
  const mcpTools = ["list_checks", "explain_check", "lint_workbook", "lint_diff"];
  for (const tool of mcpTools) {
    if (html.includes(tool)) {
      pass(`MCP tool name "${tool}" visible`);
    } else {
      fail(`MCP tool name "${tool}"`, "Present in HTML", "Not found", "Add tool listing to landing page content");
    }
  }

  // ---------------------------------------------------------------------------
  // GitHub Source link
  // ---------------------------------------------------------------------------
  const expectedGitHub = "https://github.com/Prahaasn/provenance-model-guard";
  if (html.includes(expectedGitHub)) {
    pass("Source link points to correct GitHub repo");
  } else if (html.includes("github.com/Prahaasn")) {
    pass("Source link contains github.com/Prahaasn (variant form)");
  } else if (html.includes("github.com")) {
    fail(
      "Source link target",
      expectedGitHub,
      "Found github.com but NOT /Prahaasn/provenance-model-guard",
      "Fix the href in the header Source link — currently bare github.com or wrong path. Redeploy required."
    );
  } else {
    fail(
      "Source link target",
      expectedGitHub,
      "No github.com reference found at all",
      "Add Source link to header pointing to the repo"
    );
  }

  // Also verify via grep-like
  const gitHubRefs = (html.match(/github\.com\/Prahaasn/g) || []).length;
  info("github.com/Prahaasn occurrences in HTML", String(gitHubRefs));

  // ---------------------------------------------------------------------------
  // No placeholder strings
  // ---------------------------------------------------------------------------
  const placeholders = ["[GITHUB-URL]", "[DEMO-URL]", "[LOOM-LINK]", "[placeholder]"];
  const foundPlaceholders = placeholders.filter((p) => html.includes(p));
  if (foundPlaceholders.length === 0) {
    pass("No placeholder strings in HTML");
  } else {
    fail(
      "Placeholder strings",
      "None",
      foundPlaceholders.join(", "),
      "Replace placeholder strings before sharing with anyone"
    );
  }

  // ---------------------------------------------------------------------------
  // No raw errors / stack traces
  // Note: "500" is intentionally NOT checked here — it commonly appears as a
  // font-size or numeric value in Next.js RSC payloads. Instead we check for
  // unambiguous error indicators.
  // ---------------------------------------------------------------------------
  const errorPatterns = ["<error>", "at Object.", "stack trace", "Internal Server Error", "Application error", "unhandledRejection"];
  const foundErrors = errorPatterns.filter((p) => html.includes(p));
  // Also flag if the page itself returned a 5xx (checked separately via res.status)
  if (foundErrors.length === 0) {
    pass("No error strings visible in HTML");
  } else {
    fail("Error strings in HTML", "None", foundErrors.join(", "), "Fix server-side errors before sharing");
  }

  // ---------------------------------------------------------------------------
  // Meta description
  // ---------------------------------------------------------------------------
  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (metaDescMatch) {
    const desc = metaDescMatch[1];
    if (desc.length > 10) {
      pass("<meta name='description'> present", desc.substring(0, 100));
    } else {
      fail("<meta name='description'>", "Sensible content (>10 chars)", desc, "Improve meta description");
    }
    info("Meta description", desc.substring(0, 120));
  } else {
    info("<meta name='description'>", "Not found — consider adding for SEO/social");
  }

  // ---------------------------------------------------------------------------
  // Open Graph tags
  // ---------------------------------------------------------------------------
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitle) info("og:title", ogTitle[1]);
  else info("og:title", "Not found");
  if (ogDesc) info("og:description", ogDesc[1]);
  else info("og:description", "Not found");
  if (ogImage) info("og:image", ogImage[1]);
  else info("og:image", "Not found — consider adding for link unfurls");

  // ---------------------------------------------------------------------------
  // Meta viewport + charset
  // ---------------------------------------------------------------------------
  if (html.includes("viewport")) {
    pass("<meta name='viewport'> present");
  } else {
    fail("<meta name='viewport'>", "Present", "Not found", "Add viewport meta tag for mobile");
  }
  if (html.toLowerCase().includes("charset")) {
    pass("charset declaration present");
  } else {
    fail("charset declaration", "Present", "Not found", "Add <meta charset='utf-8'> or charset in Content-Type");
  }

  // ---------------------------------------------------------------------------
  // Script / link tag count (first-paint complexity)
  // ---------------------------------------------------------------------------
  const scriptCount = (html.match(/<script/gi) || []).length;
  const linkCount = (html.match(/<link/gi) || []).length;
  info("Script tags in HTML", String(scriptCount));
  info("Link tags in HTML", String(linkCount));

  // ---------------------------------------------------------------------------
  // Extract a _next/static JS chunk URL for cache header testing
  // ---------------------------------------------------------------------------
  const chunkMatch = html.match(/\/_next\/static\/chunks\/[^"' ]+\.js/);
  if (chunkMatch) {
    info("Found _next/static chunk URL", chunkMatch[0]);
    // Test it
    const chunkUrl = BASE + chunkMatch[0];
    const chunkRes = await fetch(chunkUrl, {
      headers: { "Accept-Encoding": "gzip, br" },
    });
    if (chunkRes.status === 200) {
      pass("_next/static chunk → 200", chunkMatch[0]);
    } else {
      fail("_next/static chunk → 200", "200", String(chunkRes.status));
    }
    const cacheControl = chunkRes.headers.get("cache-control") || "";
    if (cacheControl.includes("max-age=31536000") && cacheControl.includes("immutable")) {
      pass("_next/static chunk cache-control is immutable", cacheControl);
    } else {
      fail(
        "_next/static chunk cache-control",
        "public, max-age=31536000, immutable",
        cacheControl,
        "Vercel should set this automatically; check vercel.json headers config"
      );
    }
    const encoding = chunkRes.headers.get("content-encoding") || "";
    info("_next/static chunk content-encoding", encoding || "(none/identity)");
    const vary = chunkRes.headers.get("vary") || "";
    info("_next/static chunk vary", vary);
  } else {
    info("_next/static chunk URL", "Not found in HTML — may be inline or different path pattern");
  }

  // ---------------------------------------------------------------------------
  // Sanity: github.com/Prahaasn present (stale deploy check)
  // ---------------------------------------------------------------------------
  if (html.includes("github.com/Prahaasn")) {
    pass("Stale deploy check: github.com/Prahaasn found in HTML");
  } else {
    fail(
      "Stale deploy check",
      "github.com/Prahaasn present",
      "Not found",
      "Deploy may be stale or Source link is missing the repo path — redeploy and check"
    );
  }
}

// ---------------------------------------------------------------------------
// Check sample files
// ---------------------------------------------------------------------------

const localSizes = {
  "clean_dcf_v1.xlsx": 27216,
  "messy_dcf_v2.xlsx": 26900,
  "pristine_dcf.xlsx": 27216,
};

async function checkSample(name, res) {
  if (res.status !== 200) {
    fail(`GET /samples/${name} → 200`, "200", String(res.status), "Check Vercel static file serving / vercel.json");
    return;
  }
  pass(`GET /samples/${name} → 200`);

  const ct = res.headers.get("content-type") || "";
  const isXlsx =
    ct.includes("spreadsheetml") ||
    ct.includes("octet-stream") ||
    ct.includes("zip") ||
    ct.includes("vnd.ms-excel");
  if (isXlsx || ct !== "") {
    pass(`GET /samples/${name} content-type`, ct);
  } else {
    fail(`GET /samples/${name} content-type`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet or octet-stream", ct);
  }

  const clHeader = res.headers.get("content-length");
  if (clHeader) {
    const size = parseInt(clHeader, 10);
    const expected = localSizes[name];
    const pct = Math.abs(size - expected) / expected;
    if (pct < 0.05) {
      pass(`GET /samples/${name} size ~${(expected / 1024).toFixed(0)}KB`, `${size} bytes`);
    } else {
      fail(
        `GET /samples/${name} size`,
        `~${expected} bytes (±5%)`,
        `${size} bytes`,
        "Re-upload sample files or check Vercel build output"
      );
    }
  } else {
    // consume body to get size
    const buf = await res.arrayBuffer();
    const size = buf.byteLength;
    const expected = localSizes[name];
    const pct = Math.abs(size - expected) / expected;
    if (pct < 0.05) {
      pass(`GET /samples/${name} size ~${(expected / 1024).toFixed(0)}KB`, `${size} bytes (no content-length header)`);
    } else {
      fail(
        `GET /samples/${name} size`,
        `~${expected} bytes (±5%)`,
        `${size} bytes`,
        "Re-upload sample files or check Vercel build output"
      );
    }
  }
}

await checkSample("clean_dcf_v1.xlsx", cleanResult);
await checkSample("messy_dcf_v2.xlsx", messyResult);
await checkSample("pristine_dcf.xlsx", pristineResult);

// ---------------------------------------------------------------------------
// Favicon
// ---------------------------------------------------------------------------
{
  const status = faviconResult.status;
  if (status === 200 || status === 404) {
    pass(`GET /favicon.ico → ${status} (acceptable)`, `HTTP ${status}`);
  } else {
    fail("GET /favicon.ico", "200 or 404", String(status), "Server error on favicon — check Next.js app/favicon.ico");
  }
}

// ---------------------------------------------------------------------------
// Missing API route → 404
// ---------------------------------------------------------------------------
{
  const status = missingApiResult.status;
  if (status === 404) {
    pass("GET /api/whatever-doesnt-exist → 404");
  } else {
    fail("GET /api/whatever-doesnt-exist → 404", "404", String(status), "Check Next.js 404 handling");
  }
}

// ---------------------------------------------------------------------------
// Path traversal
// ---------------------------------------------------------------------------
{
  const status = pathTraversalResult.status;
  if (status === 404 || status === 400 || status === 403) {
    pass(`Path traversal /samples/../../etc/passwd → ${status} (blocked)`);
  } else if (status === 200) {
    // Check if it actually served passwd
    const body = await pathTraversalResult.text();
    if (body.includes("root:") || body.includes("/bin/bash")) {
      fail(
        "Path traversal blocked",
        "404/400/403",
        `200 with apparent /etc/passwd content`,
        "CRITICAL: Path traversal not blocked — escalate immediately"
      );
    } else {
      pass("Path traversal /samples/../../etc/passwd → 200 but no passwd content (Vercel normalizes paths)");
    }
  } else {
    info("Path traversal response", `HTTP ${status}`);
  }
}

// ---------------------------------------------------------------------------
// Print results table
// ---------------------------------------------------------------------------

const passes = results.filter((r) => r.status === "PASS");
const fails = results.filter((r) => r.status === "FAIL");
const infos = results.filter((r) => r.status === "INFO");

console.log("\n" + "=".repeat(80));
console.log("PROVENANCE MODEL GUARD — LIVE DEPLOY SMOKE TEST");
console.log("=".repeat(80));
console.log(`Target: ${BASE}`);
console.log(`Date:   ${new Date().toISOString()}`);
console.log("=".repeat(80) + "\n");

console.log("--- PASS/FAIL ---\n");
for (const r of results.filter((r) => r.status !== "INFO")) {
  const icon = r.status === "PASS" ? "✓" : "✗";
  const label = r.status === "PASS" ? "PASS" : "FAIL";
  const notes = r.status === "PASS" ? (r.notes ? `  [${r.notes}]` : "") : "";
  console.log(`  ${icon} ${label}  ${r.name}${notes}`);
  if (r.status === "FAIL") {
    console.log(`         Expected: ${r.expected}`);
    console.log(`         Actual:   ${r.actual}`);
    if (r.fix) console.log(`         Fix:      ${r.fix}`);
  }
}

console.log("\n--- INFO ---\n");
for (const r of infos) {
  console.log(`  ℹ  ${r.name}: ${r.notes}`);
}

console.log("\n" + "=".repeat(80));
console.log(`RESULT: ${passes.length} PASS  |  ${fails.length} FAIL  |  ${infos.length} INFO`);
console.log("=".repeat(80) + "\n");

if (fails.length > 0) {
  console.log("FAILURES:\n");
  for (const r of fails) {
    console.log(`  [FAIL] ${r.name}`);
    console.log(`    Expected: ${r.expected}`);
    console.log(`    Actual:   ${r.actual}`);
    if (r.fix) console.log(`    Fix:      ${r.fix}`);
    console.log();
  }
  process.exit(1);
} else {
  console.log("All checks passed. Deploy appears ready.\n");
  process.exit(0);
}
