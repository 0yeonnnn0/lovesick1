import { describe, expect, it } from "vitest";
import { __test } from "./codex";

describe("codex transcript parsing", () => {
  it("extracts the final reply from codex exec stdout", () => {
    const stdout = [
      "OpenAI Codex v0.121.0 (research preview)",
      "--------",
      "workdir: /app",
      "model: gpt-5.4",
      "provider: openai",
      "approval: never",
      "sandbox: read-only",
      "session id: abc",
      "--------",
      "user",
      "짧게 하이라고만 답해",
      "codex",
      "하이",
      "tokens used",
      "1,211",
    ].join("\n");

    expect(__test.extractCodexReplyFromTranscript(stdout)).toBe("하이");
  });

  it("does not report missing CLI when the output file is missing", () => {
    const error = Object.assign(new Error("ENOENT: no such file or directory, open '/tmp/last-message.txt'"), {
      code: "ENOENT",
      path: "/tmp/last-message.txt",
    });

    expect(__test.extractCodexErrorMessage(error, "/usr/local/bin/codex")).not.toContain("Codex CLI를 찾을 수 없습니다");
  });
});
