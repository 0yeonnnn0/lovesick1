import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { HistoryMessage } from "./history";

const execFileAsync = promisify(execFile);

type ExecFileError = NodeJS.ErrnoException & {
  stderr?: string;
  stdout?: string;
  path?: string;
};

function formatHistory(history: HistoryMessage[]): string {
  return history.map((message, index) => {
    const role = message.role === "assistant" ? "assistant" : "user";
    const imageNote = message.imageData ? "\n[image attachment omitted for codex exec provider]" : "";
    return `<message index="${index + 1}" role="${role}">\n${message.content}${imageNote}\n</message>`;
  }).join("\n");
}

function buildCodexPrompt(history: HistoryMessage[], systemPrompt: string): string {
  return [
    "You are being used as the runtime for a Discord shared-memory assistant.",
    "Do not inspect repository files, do not browse the project, and do not run shell commands.",
    "Treat this as a pure text-generation task based only on the provided system prompt and conversation.",
    "Return only the final reply for the user. Do not explain your process.",
    "",
    "<system_prompt>",
    systemPrompt,
    "</system_prompt>",
    "",
    "<conversation>",
    formatHistory(history),
    "</conversation>",
  ].join("\n");
}

function extractCodexReplyFromTranscript(stdout: string): string {
  const text = stdout.trim();
  if (!text) return "";

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== "codex") continue;

    const collected: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      const trimmed = line.trim();
      if (!trimmed) {
        if (collected.length > 0) break;
        continue;
      }
      if (/^(tokens used|warning:|user|approval:|sandbox:|session id:|model:|provider:|workdir:|-{2,})/i.test(trimmed)) {
        if (collected.length > 0) break;
        continue;
      }
      collected.push(line);
    }

    const reply = collected.join("\n").trim();
    if (reply) return reply;
  }

  return "";
}

function extractCodexErrorMessage(error: unknown, codexBin: string): string {
  const err = error as ExecFileError;
  if (err.code === "ENOENT" && (err.path === codexBin || err.message.includes(codexBin))) {
    return "Codex CLI를 찾을 수 없습니다. `codex`를 설치하거나 `CODEX_BIN` 경로를 설정하세요.";
  }

  const stderr = `${err.stderr || ""}\n${err.stdout || ""}`.trim();
  if (/auth|login|sign in|credential|token/i.test(stderr)) {
    return "Codex 인증이 필요합니다. 서버에서 `codex login`으로 로그인한 뒤 다시 시도하세요.";
  }

  return stderr || err.message || "Codex 실행에 실패했습니다.";
}

export const __test = {
  extractCodexReplyFromTranscript,
  extractCodexErrorMessage,
};

export async function getCodexReply(history: HistoryMessage[], systemPrompt: string, model: string): Promise<string> {
  const codexBin = process.env.CODEX_BIN || "codex";
  const prompt = buildCodexPrompt(history, systemPrompt);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "lovesick1-codex-"));
  const outputFile = path.join(tempDir, "last-message.txt");
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--model",
    model || "gpt-5.4",
    "--ephemeral",
    "--output-last-message",
    outputFile,
    prompt,
  ];

  try {
    const { stdout } = await execFileAsync(codexBin, args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 4,
      timeout: 120_000,
      env: process.env,
    });

    let reply = "";
    try {
      reply = (await readFile(outputFile, "utf-8")).trim();
    } catch (error) {
      const err = error as ExecFileError;
      if (err.code !== "ENOENT") throw error;
    }
    if (!reply) {
      reply = extractCodexReplyFromTranscript(stdout);
    }
    if (!reply) {
      throw new Error("Codex 응답이 비어 있습니다.");
    }
    return reply;
  } catch (error) {
    throw new Error(extractCodexErrorMessage(error, codexBin));
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
