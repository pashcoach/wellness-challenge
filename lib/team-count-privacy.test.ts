import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

for (const component of ["TeamSetup.tsx", "SoloTeamCard.tsx"]) {
  test(`${component} uses the privacy-safe aggregate for team counts`, () => {
    const source = readFileSync(new URL(`../components/${component}`, import.meta.url), "utf8");
    assert.match(source, /\.rpc\("get_team_member_counts"\)/);
    assert.doesNotMatch(source, /\.from\("profiles"\)\.select\("team_id"\)/);
  });
}
