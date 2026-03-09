#!/usr/bin/env npx tsx
/**
 * Fetches the budget.finance.go.ug page structure (years, document types, URLs).
 * Outputs JSON that the bot can use to know what's available.
 *
 * Usage: npm run fetch:budget-structure
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

const BUDGET_BASE = "https://budget.finance.go.ug";
const BUDGET_HOME = "https://budget.finance.go.ug/";
const BUDGET_DASHBOARD = "https://budget.finance.go.ug/dashboard";

// Known structure from budget.finance.go.ug (Budget Library, Budget Data)
const KNOWN_YEARS = [
  "FY 2026-27", "FY 2025-26", "FY 2024-25", "FY 2023-24", "FY 2022-23",
  "FY 2021-22", "FY 2020-21", "FY 2019-20", "FY 2018-19", "FY 2017-18",
  "FY 2016-17", "FY 2015-16", "FY 2014-15", "FY 2013-14", "FY 2012-13",
  "FY 2011-12", "FY 2010-11", "FY 2009-10"
];

const DOCUMENT_TYPES = [
  { id: "dashboard", label: "Budget Dashboard", url: BUDGET_DASHBOARD, description: "Data, graphs, Excel downloads" },
  { id: "library", label: "Budget Library", url: BUDGET_HOME, description: "All documents by fiscal year" },
  { id: "excel", label: "Excel Downloads", url: `${BUDGET_BASE}/budget-data/excel-downloads`, description: "Budget data in Excel format" },
  { id: "lg-allocation", label: "LG Allocation Detail", url: `${BUDGET_BASE}/budget-data/lg-allocation-detail`, description: "Local government allocations" }
];

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "MoFPED-Chatbot/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function extractStructure(): Promise<{
  years: Array<{ label: string; year: string; url?: string }>;
  documentTypes: typeof DOCUMENT_TYPES;
  scrapedLinks: Array<{ text: string; href: string }>;
}> {
  const html = await fetchPage(BUDGET_HOME);
  const $ = cheerio.load(html);

  const scrapedLinks: Array<{ text: string; href: string }> = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (href && text && (href.startsWith("/") || href.startsWith("http"))) {
      const fullUrl = href.startsWith("http") ? href : new URL(href, BUDGET_BASE).href;
      if (fullUrl.includes("budget.finance.go.ug")) {
        scrapedLinks.push({ text, href: fullUrl });
      }
    }
  });

  // Extract years from scraped links
  const yearPattern = /FY\s*(\d{4})-(\d{2,4})|(\d{4})\s*[\/\-]\s*(\d{2,4})/i;
  const foundYears = new Map<string, string>();
  for (const { text, href } of scrapedLinks) {
    const m = text.match(yearPattern) || href.match(/(\d{4})[-_](\d{2,4})/);
    if (m) {
      const label = text.includes("FY") ? text.trim() : `FY ${m[1]}-${String(m[2]).padStart(2, "0")}`;
      foundYears.set(label, href);
    }
  }

  const years = KNOWN_YEARS.map((label) => ({
    label,
    year: label.replace(/\D/g, "").slice(0, 4),
    url: foundYears.get(label) || `${BUDGET_HOME}?fy=${label.replace(/\s+/g, "-").toLowerCase()}`,
  }));

  return {
    years,
    documentTypes: DOCUMENT_TYPES,
    scrapedLinks: scrapedLinks.slice(0, 50),
  };
}

async function main() {
  console.log("Fetching budget.finance.go.ug structure...");
  try {
    const structure = await extractStructure();
    const outPath = path.join(process.cwd(), "src", "lib", "budget-structure.json");
    fs.writeFileSync(outPath, JSON.stringify(structure, null, 2), "utf-8");
    console.log(`Wrote ${outPath}`);
    console.log(`Years: ${structure.years.length}, Document types: ${structure.documentTypes.length}`);
  } catch (err) {
    console.error("Error:", err);
    // Fallback: write known structure without scraping
    const fallback = {
      years: KNOWN_YEARS.map((label) => ({ label, year: label.replace(/\D/g, "").slice(0, 4) })),
      documentTypes: DOCUMENT_TYPES,
      scrapedLinks: [],
    };
    const outPath = path.join(process.cwd(), "src", "lib", "budget-structure.json");
    fs.writeFileSync(outPath, JSON.stringify(fallback, null, 2), "utf-8");
    console.log(`Wrote fallback structure to ${outPath}`);
  }
}

main();
