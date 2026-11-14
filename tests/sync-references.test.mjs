import test from "node:test";
import assert from "node:assert/strict";
import { personalSourceHash, personalSourceRevision, personalQuestionReference } from "../lib/personal-source.ts";
import { localDate } from "../lib/learning/engine.ts";

test("Santiago day boundaries remain stable in summer, winter and DST transition", () => {
  assert.equal(localDate("2026-01-02T02:59:59Z"), "2026-01-01");
  assert.equal(localDate("2026-01-02T03:00:00Z"), "2026-01-02");
  assert.equal(localDate("2026-07-02T03:59:59Z"), "2026-07-01");
  assert.equal(localDate("2026-07-02T04:00:00Z"), "2026-07-02");
  assert.equal(localDate("2026-09-06T04:00:00Z"), "2026-09-06");
});
test("personal sync references preserve original identity while revisions track edited content", async () => {
  const sourceHash = "a".repeat(64);
  const record = { summary: {}, finalJson: { sources: [{ id: "exam", sha256: sourceHash }], questions: [{ number: 4, stem: "Texto privado" }] } };
  assert.equal(await personalSourceHash(record), sourceHash);
  assert.equal(personalQuestionReference(record, sourceHash, 4), `demre:${sourceHash}:4`);
  const edited = { ...record, finalJson: { ...record.finalJson, questions: [{ number: 4, stem: "Texto privado editado" }] } };
  assert.equal(await personalSourceHash(edited), sourceHash);
  assert.notEqual(await personalSourceRevision(record), await personalSourceRevision(edited));
  const generic = { summary: {}, finalJson: { questions: [{ number: 10, stem: "Mi pregunta" }] }, archive: new Blob(["original-file"]) };
  const importedAgain = { ...generic, summary: { title: "Otro nombre" } };
  const hash = await personalSourceHash(generic);
  assert.equal(await personalSourceHash(importedAgain), hash);
  assert.match(personalQuestionReference(generic, hash, 10), /^personal:[a-f\d]{64}:10$/);
});
