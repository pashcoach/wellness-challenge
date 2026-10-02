import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("password field has an accessible visibility toggle", () => {
  const component = source("components/PasswordField.tsx");
  assert.match(component, /type=\{visible \? "text" : "password"\}/);
  assert.match(component, /aria-label=\{visible \? "Hide password" : "Show password"\}/);
  assert.match(component, /aria-pressed=\{visible\}/);
});

test("sign-in, sign-up, and both reset-password fields use the visibility control", () => {
  const authForm = source("components/AuthForm.tsx");
  const resetPage = source("app/reset-password/page.tsx");
  assert.equal((authForm.match(/<PasswordField/g) ?? []).length, 1);
  assert.equal((resetPage.match(/<PasswordField/g) ?? []).length, 2);
});
