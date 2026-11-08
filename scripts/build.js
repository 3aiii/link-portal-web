// Netlify build step (see netlify.toml): checks the site, then copies only the
// files the page needs into dist/, so README, scripts and netlify.toml never
// get published. Any error fails the build, and Netlify keeps serving the
// previous deploy. No dependencies -- plain Node.
//
//   node scripts/build.js [siteRoot]
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const outDir = path.join(root, "dist");
const SITE_FILES = ["index.html", "style.css", "app.js", "config.js"];

const errors = [];
const warnings = [];
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// 1. Every site file exists.
for (const f of SITE_FILES) {
  if (!fs.existsSync(path.join(root, f))) errors.push(`missing file: ${f}`);
}

if (!errors.length) {
  // 2. JS parses.
  for (const f of SITE_FILES.filter((f) => f.endsWith(".js"))) {
    try {
      new vm.Script(read(f), { filename: f });
    } catch (err) {
      errors.push(`${f}: ${err.message}`);
    }
  }

  // 3. Local files referenced by index.html exist.
  const html = read("index.html");
  for (const [, ref] of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|#|data:)/i.test(ref)) continue;
    if (!fs.existsSync(path.join(root, ref))) errors.push(`index.html points at missing file: ${ref}`);
  }

  // 4. config.js is well-formed.
  const icons = new Set();
  const iconBlock = /const ICONS = \{([\s\S]*?)\n\s*\};/.exec(read("app.js"));
  if (iconBlock) for (const [, name] of iconBlock[1].matchAll(/^\s*(\w+):/gm)) icons.add(name);

  let config = null;
  try {
    const sandbox = { window: {} };
    vm.runInNewContext(read("config.js"), sandbox, { filename: "config.js" });
    config = sandbox.window.PORTAL_CONFIG;
  } catch (err) {
    errors.push(`config.js failed to run: ${err.message}`);
  }

  if (config) {
    if (!config.name) errors.push("config.js: `name` is empty");
    if (!Array.isArray(config.links) || !config.links.length) {
      errors.push("config.js: `links` must be a non-empty list");
    } else {
      if (config.links.filter((l) => l.featured).length > 1) warnings.push("config.js: more than one featured link");
      config.links.forEach((link, i) => {
        const label = `config.js links[${i}] (${link.title || "untitled"})`;
        if (!link.title) errors.push(`${label}: missing title`);
        if (link.icon && icons.size && !icons.has(link.icon)) {
          errors.push(`${label}: unknown icon "${link.icon}" (known: ${[...icons].join(", ")})`);
        }
        if (link.copy) return;
        if (!link.url) errors.push(`${label}: needs a url or copy`);
        else if (link.url === "#") warnings.push(`${label}: url is still the "#" placeholder`);
        else if (!/^(https:\/\/|mailto:)/i.test(link.url)) errors.push(`${label}: url must start with https:// or mailto: (got "${link.url}")`);
      });
    }
  }
}

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);

if (errors.length) {
  console.log(`\nBuild failed: ${errors.length} error(s). Nothing was published.`);
  process.exit(1);
}

// 5. Copy the site into dist/.
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir);
for (const f of SITE_FILES) fs.copyFileSync(path.join(root, f), path.join(outDir, f));
console.log(`Checks passed${warnings.length ? ` with ${warnings.length} warning(s)` : ""}. Copied ${SITE_FILES.length} files to dist/.`);
