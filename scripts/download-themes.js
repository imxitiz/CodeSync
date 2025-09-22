#!/usr/bin/env node

/**
 * Theme Downloader Script
 * Downloads themes from tweakcn.com and generates preset files
 *
 * Usage:
 * node scripts/download-themes.js [theme-urls...]
 *
 * Examples:
 * node scripts/download-themes.js https://tweakcn.com/r/themes/twitter.json
 * node scripts/download-themes.js https://tweakcn.com/r/themes/twitter.json https://tweakcn.com/r/themes/darkmatter.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRESETS_DIR = path.join(__dirname, "..", "src", "theme", "presets");
const themeNameRegex = /^[a-z0-9-]+$/i;
const urlRegex = /^https?:\/\//i;

// Ensure presets directory exists
if (!fs.existsSync(PRESETS_DIR)) {
  fs.mkdirSync(PRESETS_DIR, { recursive: true });
}

/**
 * Fetch theme from URL
 */
async function fetchTheme(url) {
  try {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Theme-Downloader/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error.message);
    return null;
  }
}

/**
 * Generate theme object from tweakcn data
 */
function generateThemeObject(data, baseName) {
  const themeTokens = data.cssVars?.theme || {};
  const modes = {};

  if (data.cssVars?.light) {
    modes.light = { ...themeTokens, ...data.cssVars.light };
  }

  if (data.cssVars?.dark) {
    modes.dark = { ...themeTokens, ...data.cssVars.dark };
  }

  // If only one mode exists, duplicate it
  if (modes.light && !modes.dark) {
    modes.dark = { ...modes.light };
  } else if (modes.dark && !modes.light) {
    modes.light = { ...modes.dark };
  }

  return {
    name: baseName,
    modes,
    defaultMode: modes.dark ? "dark" : "light",
  };
}

/**
 * Generate JavaScript file content
 */
function generateFileContent(themeObject) {
  return `export default ${JSON.stringify(themeObject, null, 2)};`;
}

/**
 * Save theme to file
 */
function saveTheme(themeObject, filename) {
  const filePath = path.join(PRESETS_DIR, filename);
  const content = generateFileContent(themeObject);

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`✅ Saved: ${filePath}`);
}

/**
 * Extract theme name from URL
 */
function extractThemeName(data) {
  const match = data.name?.match(themeNameRegex);
  return match ? match[0] : "custom-theme";
}

/**
 * Main function
 */
async function main() {
  const urls = process.argv.slice(2);

  if (urls.length === 0) {
    console.log(
      "Usage: node scripts/download-themes.js [theme-names... | theme-urls...]"
    );
    console.log("Examples:");
    console.log("  node scripts/download-themes.js twitter darkmatter");
    console.log(
      "  node scripts/download-themes.js https://tweakcn.com/r/themes/twitter.json https://example.com/my-theme.json"
    );
    process.exit(1);
  }

  console.log(`📥 Downloading ${urls.length} theme(s)...\n`);

  for (const input of urls) {
    let url;
    // If input looks like a URL, use it as-is
    if (urlRegex.test(input)) {
      url = input;
      console.log(`Using URL: ${url}`);
    } else {
      // Accept short theme name only (e.g. "twitter" -> https://tweakcn.com/r/themes/twitter.json)
      if (!themeNameRegex.test(input)) {
        console.error(`❌ Invalid theme name: ${input}`);
        console.error(
          "Theme names may only contain letters, numbers and hyphens, or provide a full URL starting with https://"
        );
        continue;
      }

      url = `https://tweakcn.com/r/themes/${input}.json`;
      console.log(`Resolved "${input}" -> ${url}`);
    }

    const data = await fetchTheme(url);
    if (!data) {
      continue;
    }

    const baseName = extractThemeName(data);
    const themeObject = generateThemeObject(data, baseName);
    const filename = `${baseName}.js`;

    saveTheme(themeObject, filename);
  }

  console.log("\n🎉 All themes downloaded successfully!");
  console.log("Restart your dev server to see the new presets.");
}

// Run the script
main().catch(console.error);
