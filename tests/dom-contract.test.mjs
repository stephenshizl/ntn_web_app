import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("脚本引用的控件ID都存在于页面", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8")
  ]);
  const htmlIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
  const usedIds = new Set([...script.matchAll(/byId\(["']([^"']+)["']\)/g)].map(match => match[1]));
  const missing = [...usedIds].filter(id => !htmlIds.has(id));
  assert.deepEqual(missing, []);
});
