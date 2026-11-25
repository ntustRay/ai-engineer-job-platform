import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { applyProfileTransaction, loadProfile } from "./account-store";
import { parseChanges } from "./account-model";
import { readRepo } from "./account-repos";

test("profile updates are idempotent and removing an identical favorite is scoped to the signed-in user", async () => {
  const db = await PGlite.create();
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'a\'),(\'b\');');
    await db.exec(await readFile(new URL("./account-schema.sql", import.meta.url), "utf8"));
    const favorite = { bucket: "favorites", value: "taiwanjobs:example", add: true } as const;
    for (const id of ["a", "a", "b"]) await db.transaction(tx => applyProfileTransaction(tx, id, [favorite]));
    await db.transaction(tx => applyProfileTransaction(tx, "b", [{ ...favorite, add: false }]));
    expect((await loadProfile(db, "a")).favorites).toEqual([favorite.value]);
    expect((await loadProfile(db, "b")).favorites).toEqual([]);
  } finally {
    await db.close();
  }
}, 20000);

test("reject conflicting mutation entries and other users' repositories", () => {
  const entry = { bucket: "skills", value: "react", add: true };
  expect(parseChanges({ changes: [entry, { ...entry, add: false }] })).toBeNull();
  const github = { id: 15, owner: { id: 1 }, full_name: "test/public", private: false };
  expect(readRepo(github, "1")?.fullName).toBe("test/public");
  expect(readRepo(github, "2")).toBeNull();
  expect(readRepo({ ...github, private: true }, "1")).toBeNull();
});
