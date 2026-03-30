import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const seen = new Set();

let patchedCount = 0;

function recordCandidate(filePath, candidates) {
  if (!filePath || seen.has(filePath) || !fs.existsSync(filePath)) {
    return;
  }
  seen.add(filePath);
  candidates.push(filePath);
}

const candidates = [];
const workspaceBundle = path.join(workspaceRoot, "apps", "web", "node_modules", "chat", "dist", "index.js");
recordCandidate(workspaceBundle, candidates);
if (fs.existsSync(workspaceBundle)) {
  recordCandidate(fs.realpathSync(workspaceBundle), candidates);
}

const bunStoreDir = path.join(workspaceRoot, "node_modules", ".bun");
if (fs.existsSync(bunStoreDir)) {
  for (const entry of fs.readdirSync(bunStoreDir)) {
    if (!entry.startsWith("chat@")) {
      continue;
    }
    recordCandidate(path.join(bunStoreDir, entry, "node_modules", "chat", "dist", "index.js"), candidates);
  }
}

for (const bundleFile of candidates) {
  const contents = fs.readFileSync(bundleFile, "utf8");
  if (!contents.includes("sourceMappingURL=index.js.map")) {
    continue;
  }

  fs.writeFileSync(
    bundleFile,
    contents.replace(/\n?\/\/# sourceMappingURL=index\.js\.map\s*$/, "\n"),
    "utf8",
  );
  patchedCount += 1;
  console.log(`[fix-chat-sourcemap] stripped missing source map reference from ${path.relative(workspaceRoot, bundleFile)}`);
}

if (patchedCount === 0) {
  console.log("[fix-chat-sourcemap] no patch required");
}
