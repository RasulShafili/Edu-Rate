import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { findPasswordProblem, scorePassword } from "../app/lib/password-policy.ts";

describe("şifrə siyasəti (frontend)", () => {
  it("backend ilə bayt-bayt eyni fayldır", () => {
    const frontend = readFileSync(new URL("../app/lib/password-policy.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const backend = readFileSync(new URL("../backend/src/lib/password-policy.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    assert.equal(frontend, backend);
  });

  it("yayılmış və şəxsi şifrələri rədd edir", () => {
    assert.equal(findPasswordProblem("qısa1"), "tooShort");
    assert.equal(findPasswordProblem("Password2026!"), "common");
    assert.equal(findPasswordProblem("salam123456"), "common");
    assert.equal(findPasswordProblem("aysel2026xy", { name: "Aysel Məmmədova" }), "personal");
    assert.equal(findPasswordProblem("zyxwvuts98"), "repetitive");
    assert.equal(findPasswordProblem("Kampus-Yolu-2026"), null);
  });

  it("göstərici zəif şifrəyə yüksək bal vermir", () => {
    assert.equal(scorePassword(""), 0);
    assert.equal(scorePassword("password1234"), 1);
    assert.ok(scorePassword("Kampus-Yolu-2026") >= 3);
  });
});
