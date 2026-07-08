import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { hasFlag, joinOrAbsolute, optionValue, quote, ROOT, slash } from "./utils.js";

const input = optionValue("--input");
const mode = optionValue("--mode") ?? "readable";
const outArg = optionValue("--out");
const dryRun = hasFlag("--dry-run");

if (!input) throw new Error("Pass --input <video>");
if (!["readable", "review"].includes(mode)) throw new Error("--mode must be readable or review");

const inputPath = joinOrAbsolute(input);
if (!existsSync(inputPath)) throw new Error(`Input video not found: ${input}`);

const suffix = mode === "review" ? "review" : "720p";
const outputPath = outArg ? joinOrAbsolute(outArg) : join(ROOT, "artifacts", `${basename(inputPath, extname(inputPath))}.${suffix}.mp4`);
mkdirSync(dirname(outputPath), { recursive: true });

const vf = mode === "review" ? "fps=6,scale='min(960,iw)':-2" : "fps=15,scale='min(1280,iw)':-2";
const crf = mode === "review" ? "34" : "26";
const argsForFfmpeg = [
  "-y",
  "-i", inputPath,
  "-vf", vf,
  "-c:v", "libx264",
  "-preset", "veryfast",
  "-crf", crf,
  "-movflags", "+faststart",
  "-an",
  outputPath,
];

if (dryRun) {
  console.log(`ffmpeg ${argsForFfmpeg.map(quote).join(" ")}`);
  process.exit(0);
}

try {
  execFileSync("ffmpeg", argsForFfmpeg, { stdio: "inherit" });
} catch (error) {
  throw new Error(`ffmpeg compression failed. Install ffmpeg or pass --dry-run. ${error instanceof Error ? error.message : String(error)}`);
}

const inputSize = statSync(inputPath).size;
const outputSize = statSync(outputPath).size;
console.log(JSON.stringify({
  input: slash(relative(ROOT, inputPath)),
  output: slash(relative(ROOT, outputPath)),
  mode,
  inputBytes: inputSize,
  outputBytes: outputSize,
  ratio: Number((outputSize / Math.max(1, inputSize)).toFixed(3)),
}, null, 2));
