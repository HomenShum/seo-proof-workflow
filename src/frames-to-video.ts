import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { hasFlag, joinOrAbsolute, numberOption, optionValue, quote, ROOT, slash } from "./utils.js";

const inputDirArg = optionValue("--input-dir");
const outArg = optionValue("--out");
const fps = numberOption("--fps", 4, 1, 60);
const dryRun = hasFlag("--dry-run");

if (!inputDirArg) throw new Error("Pass --input-dir <frame-directory>");
const inputDir = joinOrAbsolute(inputDirArg);
if (!existsSync(inputDir) || !statSync(inputDir).isDirectory()) throw new Error(`Frame directory not found: ${inputDirArg}`);

const frames = readdirSync(inputDir)
  .filter((file) => /\.(png|jpe?g)$/i.test(file))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (!frames.length) throw new Error(`No PNG/JPEG frames found in ${inputDirArg}`);

const outputPath = outArg ? joinOrAbsolute(outArg) : join(ROOT, "artifacts", `${basename(inputDir)}.review.mp4`);
const sequenceDir = join(inputDir, ".sequence");
mkdirSync(sequenceDir, { recursive: true });

const ext = extname(frames[0]).toLowerCase() === ".png" ? ".png" : ".jpg";
for (let i = 0; i < frames.length; i++) {
  copyFileSync(join(inputDir, frames[i]), join(sequenceDir, `frame-${String(i).padStart(4, "0")}${ext}`));
}

const pattern = join(sequenceDir, `frame-%04d${ext}`);
const argsForFfmpeg = [
  "-y",
  "-framerate", String(fps),
  "-i", pattern,
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-preset", "veryfast",
  "-crf", "28",
  "-movflags", "+faststart",
  outputPath,
];

if (dryRun) {
  console.log(`ffmpeg ${argsForFfmpeg.map(quote).join(" ")}`);
  rmSync(sequenceDir, { recursive: true, force: true });
  process.exit(0);
}

try {
  execFileSync("ffmpeg", argsForFfmpeg, { stdio: "inherit" });
} finally {
  rmSync(sequenceDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  inputDir: slash(relative(ROOT, inputDir)),
  frames: frames.length,
  output: slash(relative(ROOT, outputPath)),
}, null, 2));
