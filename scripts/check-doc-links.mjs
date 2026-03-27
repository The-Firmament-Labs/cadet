import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const root = process.cwd();
const markdownRoots = ["README.md", "ARCHITECTURE.md", "IMPLEMENTATION_PHASES.md", "SESSION.md"];
const docsDir = resolve(root, "docs");
const failures = [];

function walkMarkdown(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkMarkdown(fullPath));
      continue;
    }
    if (entry.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

function toRelativePath(filePath) {
  return filePath.replace(`${root}${sep}`, "");
}

const files = [
  ...markdownRoots.map((file) => resolve(root, file)),
  ...walkMarkdown(docsDir),
];

const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

for (const file of files) {
  const fileText = readFileSync(file, "utf8");
  const relativeFile = toRelativePath(file);
  const directory = dirname(file);

  for (const match of fileText.matchAll(markdownLinkPattern)) {
    const href = match[1].trim();
    if (
      href.length === 0 ||
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("#")
    ) {
      continue;
    }

    if (href.startsWith("/")) {
      failures.push(`${relativeFile}: uses absolute path link '${href}'`);
      continue;
    }

    const target = href.split("#")[0].split("?")[0];
    if (target.length === 0) {
      continue;
    }

    const resolvedTarget = resolve(directory, target);
    if (!existsSync(resolvedTarget)) {
      failures.push(`${relativeFile}: missing link target '${href}'`);
    }
  }
}

if (failures.length > 0) {
  console.error("Broken documentation links found:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Docs link check passed for ${files.length} markdown files.`);
