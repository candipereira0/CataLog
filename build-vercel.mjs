// Node.js version of build-vercel.sh — used by Vercel's GitHub integration
// Vercel's build image has Node but not Bun, so we use npm + esbuild
import { execSync } from "child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "fs";

console.log("[1/3] vite build");
execSync("npx vite build", { stdio: "inherit" });

console.log("[2/3] assemble .vercel/output (Build Output API v3)");
rmSync(".vercel/output", { recursive: true, force: true });
mkdirSync(".vercel/output/static", { recursive: true });
mkdirSync(".vercel/output/functions/render.func", { recursive: true });
cpSync("dist", ".vercel/output/static", { recursive: true });

console.log("[3/3] bundle SSR handler + deps into the render function");
execSync("npx esbuild vercel-entry.ts --bundle --platform=node --outfile=.vercel/output/functions/render.func/index.mjs --external:bun:sqlite --format=esm", { stdio: "inherit" });

writeFileSync(".vercel/output/functions/render.func/.vc-config.json", JSON.stringify({
  runtime: "nodejs22.x",
  handler: "index.mjs",
  launcherType: "Nodejs",
  supportsResponseStreaming: true
}));

writeFileSync(".vercel/output/config.json", JSON.stringify({
  version: 3,
  routes: [
    { src: "/assets/(.*)", dest: "/assets/$1" },
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/render" }
  ]
}));

console.log("done -> .vercel/output ready for deployment");
