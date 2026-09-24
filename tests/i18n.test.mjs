import assert from "node:assert/strict";
import test from "node:test";
import { selectPluralForm } from "../app/i18n/plural.ts";

const en = "{count} member|{count} members";
const ru = "{count} участник|{count} участника|{count} участников|{count} участника";

test("EN cəm forması sayla uzlaşır", () => {
  // Reqressiya: əvvəl t() cəmi bilmirdi və "1 members" yazılırdı.
  assert.equal(selectPluralForm(en, "en", 1), "{count} member");
  assert.equal(selectPluralForm(en, "en", 0), "{count} members");
  assert.equal(selectPluralForm(en, "en", 21), "{count} members");
});

test("RU üç cəm formasını seçir", () => {
  assert.equal(selectPluralForm(ru, "ru", 1), "{count} участник");
  assert.equal(selectPluralForm(ru, "ru", 21), "{count} участник");
  assert.equal(selectPluralForm(ru, "ru", 3), "{count} участника");
  assert.equal(selectPluralForm(ru, "ru", 5), "{count} участников");
  assert.equal(selectPluralForm(ru, "ru", 11), "{count} участников");
  assert.equal(selectPluralForm(ru, "ru", 1.5), "{count} участника");
});

test("formatlanmış say oxunur, say olmayanda son forma, `|` olmayan mətn toxunulmaz", () => {
  assert.equal(selectPluralForm(ru, "ru", "1 234"), "{count} участника");
  assert.equal(selectPluralForm(ru, "ru", "5"), "{count} участников");
  assert.equal(selectPluralForm(en, "en", undefined), "{count} members");
  assert.equal(selectPluralForm("Members: {count}", "en", 1), "Members: {count}");
});
