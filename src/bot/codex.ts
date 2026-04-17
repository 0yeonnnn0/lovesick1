import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HistoryMessage } from "./history";

const execFileAsync = promisify(execFile);

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

function extractCodexErrorMessage(error: unknown): string {
  const err = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
  if (err.code === "ENOENT") {
    return "Codex CLI를 찾을 수 없습니다. `codex`를 설치하거나 `CODEX_BIN` 경로를 설정하세요.";
  }

  const stderr = `${err.stderr || ""}\n${err.stdout || ""}`.trim();
  if (/auth|login|sign in|credential|token/i.test(stderr)) {
    return "Codex 인증이 필요합니다. 서버에서 `codex login`으로 로그인한 뒤 다시 시도하세요.";
  }

  return stderr || err.message || "Codex 실행에 실패했습니다.";
}

export async function getCodexReply(history: HistoryMessage[], systemPrompt: string, model: string): Promise<string> {
  const codexBin = process.env.CODEX_BIN || "codex";
  const prompt = buildCodexPrompt(history, systemPrompt);
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--model",
    model || "gpt-5.4",
    "--ephemeral",
    prompt,
  ];

  try {
    const { stdout } = await execFileAsync(codexBin, args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 4,
      timeout: 120_000,
      env: process.env,
    });

    const reply = stdout.trim();
    if (!reply) {
      throw new Error("Codex 응답이 비어 있습니다.");
    }
    return reply;
  } catch (error) {
    throw new Error(extractCodexErrorMessage(error));
  }
}
