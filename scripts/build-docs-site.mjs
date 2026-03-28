import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const outputDir = resolve(root, ".generated/pages-src");
const docsSiteDir = resolve(root, "docs-site");
const repoSlug = "Dexploarer/cadet";

const pageGroups = [
  {
    title: "Current State",
    pages: [
      {
        source: "SESSION.md",
        slug: "session",
        title: "Session Tracker",
        description: "Current checkpoint, active phase, validated progress, and next action.",
        section: "Current State",
      },
      {
        source: "MASTER_IMPLEMENTATION_PLAN.md",
        slug: "master-implementation-plan",
        title: "Master Implementation Plan",
        description: "Canonical implementation sequence and architecture review gates.",
        section: "Planning",
      },
      {
        source: "IMPLEMENTATION_PHASES.md",
        slug: "implementation-phases",
        title: "Implementation Phases",
        description: "Atomic workstreams and handoff-ready execution loops.",
        section: "Planning",
      },
    ],
  },
  {
    title: "Architecture",
    pages: [
      {
        source: "ARCHITECTURE.md",
        slug: "architecture",
        title: "Architecture Overview",
        description: "Top-level system intent, repo layout, and control-plane direction.",
        section: "Architecture",
      },
      {
        source: "docs/ARCHITECTURE_GUIDE.md",
        slug: "architecture-guide",
        title: "Architecture Guide",
        description: "Control fabric, workers, browser tasks, and memory topology.",
        section: "Architecture",
      },
      {
        source: "docs/DIOXUS_SPACETIMEDB.md",
        slug: "dioxus-spacetimedb",
        title: "Dioxus + SpacetimeDB",
        description: "Recommended integration shapes for the native operator surface.",
        section: "Architecture",
      },
      {
        source: "docs/FRAMEWORK_RESEARCH_BLUEPRINT.md",
        slug: "framework-research-blueprint",
        title: "Framework Research Blueprint",
        description: "Comparative research and selection criteria across UI and runtime options.",
        section: "Architecture",
      },
    ],
  },
  {
    title: "Agent Authoring",
    pages: [
      {
        source: "docs/AGENT_MANIFESTS.md",
        slug: "agent-manifests",
        title: "Agent Manifests",
        description: "Manifest schema, workflow templates, and behavior contracts.",
        section: "Agent Authoring",
      },
      {
        source: "docs/DYNAMIC_AGENT_UI.md",
        slug: "dynamic-agent-ui",
        title: "Dynamic Agent UI",
        description: "JSON-to-UI and constrained per-agent operator surfaces.",
        section: "Agent Authoring",
      },
    ],
  },
  {
    title: "Operations",
    pages: [
      {
        source: "docs/GITHUB_AUTOMATION.md",
        slug: "github-automation",
        title: "GitHub Automation",
        description: "CI, Claude agent workflows, Vercel CD, and Pages publishing.",
        section: "Operations",
      },
      {
        source: "docs/RALPH_LOOP.md",
        slug: "ralph-loop",
        title: "RALPH Loop",
        description: "Route / Atomize / Land / Prove / Handoff execution discipline.",
        section: "Operations",
      },
      {
        source: "docs/CONVERSATION_SYNTHESIS.md",
        slug: "conversation-synthesis",
        title: "Conversation Synthesis",
        description: "Original design intent distilled into architecture decisions.",
        section: "Operations",
      },
      {
        source: "docs/README.md",
        slug: "docs-index",
        title: "Docs Index",
        description: "Repo-local map of the planning, architecture, and authoring docs.",
        section: "Operations",
      },
    ],
  },
];

const pageEntries = pageGroups.flatMap((group) => group.pages);
const pageBySource = new Map(
  pageEntries.map((entry) => [resolve(root, entry.source), entry]),
);

function slugToPermalink(slug) {
  return slug === "index" ? "/" : `/${slug}.html`;
}

function slugToHref(slug) {
  return slug === "index" ? "./" : `${slug}.html`;
}

function sourceToBlobUrl(sourcePath) {
  const rel = relative(root, sourcePath)
    .split(sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://github.com/${repoSlug}/blob/main/${rel}`;
}

function escapeYaml(value) {
  return String(value).replaceAll('"', '\\"');
}

function decodeLink(href) {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function resolveRepoTarget(filePath, href) {
  const cleanHref = href.split("#")[0].split("?")[0];
  if (cleanHref.length === 0) {
    return null;
  }

  const decoded = decodeLink(cleanHref);
  const workspacePrefix = `${root}${sep}`;
  const decodedWorkspacePrefix = `${decodeLink(root)}${sep}`;

  if (decoded.startsWith(workspacePrefix)) {
    return decoded;
  }

  if (decoded.startsWith(decodedWorkspacePrefix)) {
    return resolve(root, decoded.slice(decodedWorkspacePrefix.length));
  }

  if (decoded.startsWith("/")) {
    return resolve(root, decoded.slice(1));
  }

  return resolve(dirname(filePath), decoded);
}

function rewriteLinks(markdown, sourcePath) {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (full, label, href) => {
    const trimmedHref = href.trim();
    if (
      trimmedHref.length === 0 ||
      trimmedHref.startsWith("http://") ||
      trimmedHref.startsWith("https://") ||
      trimmedHref.startsWith("mailto:") ||
      trimmedHref.startsWith("#")
    ) {
      return full;
    }

    const anchor = trimmedHref.includes("#")
      ? `#${trimmedHref.split("#").slice(1).join("#")}`
      : "";
    const targetPath = resolveRepoTarget(sourcePath, trimmedHref);

    if (targetPath && pageBySource.has(targetPath)) {
      const page = pageBySource.get(targetPath);
      return `[${label}](${slugToHref(page.slug)}${anchor})`;
    }

    if (targetPath && existsSync(targetPath)) {
      return `[${label}](${sourceToBlobUrl(targetPath)}${anchor})`;
    }

    return full;
  });
}

function frontMatter(entry) {
  const fields = [
    "---",
    'layout: "default"',
    `title: "${escapeYaml(entry.title)}"`,
    `description: "${escapeYaml(entry.description)}"`,
    `section: "${escapeYaml(entry.section)}"`,
    `source_path: "${escapeYaml(entry.source)}"`,
    `permalink: "${slugToPermalink(entry.slug)}"`,
    "---",
    "",
  ];
  return fields.join("\n");
}

function getSessionSummary() {
  const sessionText = readFileSync(resolve(root, "SESSION.md"), "utf8");
  const phase =
    sessionText.match(/\*\*Current Phase\*\*:\s*(.+)/)?.[1]?.trim() ?? "Unknown";
  const stage =
    sessionText.match(/\*\*Current Stage\*\*:\s*(.+)/)?.[1]?.trim() ?? "Unknown";
  const checkpoint =
    sessionText.match(/\*\*Last Checkpoint\*\*:\s*(.+)/)?.[1]?.trim() ?? "Unknown";
  return { phase, stage, checkpoint };
}

function currentRevision() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "local";
  }
}

function buildHomePage() {
  const summary = getSessionSummary();
  const revision = currentRevision();

  const navBlocks = pageGroups
    .map((group) => {
      const items = group.pages
        .map(
          (page) =>
            `<a class="hub-item" href="${slugToHref(page.slug)}"><strong>${page.title}</strong><span>${page.description}</span></a>`,
        )
        .join("\n");
      return `## ${group.title}\n\n<div class="hub-list">\n${items}\n</div>`;
    })
    .join("\n\n");

  return [
    "---",
    'layout: "default"',
    'title: "Cadet Project Hub"',
    'description: "Published project docs, plans, and session tracking for Cadet collaborators."',
    'section: "Overview"',
    'permalink: "/"',
    "---",
    "",
    "# Cadet Project Hub",
    "",
    "This Pages site publishes the canonical planning set, implementation guides, and active session tracker directly from the repository.",
    "",
    '<div class="status-grid">',
    `<div class="status-card"><span class="status-label">Current phase</span><strong>${summary.phase}</strong></div>`,
    `<div class="status-card"><span class="status-label">Current stage</span><strong>${summary.stage}</strong></div>`,
    `<div class="status-card"><span class="status-label">Last checkpoint</span><strong>${summary.checkpoint}</strong></div>`,
    `<div class="status-card"><span class="status-label">Published revision</span><strong>${revision}</strong></div>`,
    "</div>",
    "",
    "## Start here",
    "",
    "- [Session tracker](session.html)",
    "- [Master implementation plan](master-implementation-plan.html)",
    "- [Implementation phases](implementation-phases.html)",
    "- [Architecture guide](architecture-guide.html)",
    "",
    navBlocks,
    "",
    "## Source of truth",
    "",
    "These pages are generated from the checked-in markdown files in the repository. Session state stays in `SESSION.md`, and the planning sequence stays in `MASTER_IMPLEMENTATION_PLAN.md` and `IMPLEMENTATION_PHASES.md`.",
    "",
  ].join("\n");
}

function buildSidebar() {
  const sections = pageGroups
    .map((group) => {
      const links = group.pages
        .map((page) => {
          const permalink = slugToPermalink(page.slug);
          return [
            `<a class="nav-link{% if page.url == '${permalink}' %} active{% endif %}" href="{{ '${permalink}' | relative_url }}">`,
            `<span class="nav-link-label">${page.title}</span>`,
            `<span class="nav-link-meta">${page.description}</span>`,
            "</a>",
          ].join("");
        })
        .join("\n");

      return [
        '<section class="nav-section">',
        `<h2 class="nav-section-title">${group.title}</h2>`,
        '<div class="nav-links">',
        links,
        "</div>",
        "</section>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<nav aria-label="Project documentation navigation">',
    `<a class="nav-link{% if page.url == '/' %} active{% endif %}" href="{{ '/' | relative_url }}">`,
    '<span class="nav-link-label">Project Hub</span>',
    '<span class="nav-link-meta">Published status, plans, and docs index.</span>',
    "</a>",
    sections,
    "</nav>",
  ].join("\n");
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(resolve(outputDir, "_layouts"), { recursive: true });
mkdirSync(resolve(outputDir, "_includes"), { recursive: true });
mkdirSync(resolve(outputDir, "assets"), { recursive: true });

cpSync(
  resolve(docsSiteDir, "layout-default.html"),
  resolve(outputDir, "_layouts/default.html"),
);
cpSync(resolve(docsSiteDir, "site.css"), resolve(outputDir, "assets/site.css"));

writeFileSync(resolve(outputDir, "_includes/sidebar.html"), buildSidebar());
writeFileSync(
  resolve(outputDir, "_config.yml"),
  [
    'title: "Cadet Project Hub"',
    'description: "Shared planning, docs, and session tracking for Cadet collaborators."',
    "markdown: kramdown",
    "kramdown:",
    "  input: GFM",
    "",
  ].join("\n"),
);

writeFileSync(resolve(outputDir, "index.md"), buildHomePage());

for (const entry of pageEntries) {
  const sourcePath = resolve(root, entry.source);
  const markdown = readFileSync(sourcePath, "utf8");
  const rewritten = rewriteLinks(markdown, sourcePath);
  writeFileSync(
    resolve(outputDir, `${entry.slug}.md`),
    `${frontMatter(entry)}${rewritten.trimEnd()}\n`,
  );
}

console.log(
  `Built GitHub Pages source in ${relative(root, outputDir)} for ${pageEntries.length + 1} pages.`,
);
