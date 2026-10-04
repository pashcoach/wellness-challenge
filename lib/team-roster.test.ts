import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareTeamRoster } from "./team-roster";

test("team roster uses privacy-safe names, sorts them, and marks the signed-in member", () => {
  const roster = prepareTeamRoster(
    [
      { id: "2", full_name: "Taylor Smith", username: "Speedy" },
      { id: "1", full_name: "Alex Johnson", username: null },
    ],
    "1"
  );

  assert.deepEqual(roster, [
    { id: "1", display_name: "Alex J.", is_current_user: true },
    { id: "2", display_name: "Speedy", is_current_user: false },
  ]);
});

test("dashboard offers teammates a collapsible privacy-safe roster", () => {
  const component = readFileSync(resolve(process.cwd(), "components/TeamRoster.tsx"), "utf8");
  const dashboard = readFileSync(resolve(process.cwd(), "components/Dashboard.tsx"), "utf8");

  assert.match(component, /View team roster/);
  assert.match(component, /\.rpc\("get_my_team_roster"\)/);
  assert.doesNotMatch(component, /email|phone/i);
  assert.match(component, /\(You\)/);
  assert.match(dashboard, /<TeamRoster profile=\{profile\}/);
});

test("dashboard invite instructions match the team-list joining flow", () => {
  const dashboard = readFileSync(resolve(process.cwd(), "components/Dashboard.tsx"), "utf8");

  assert.match(dashboard, /select Join a team, and choose/);
  assert.match(dashboard, /enter team code/);
});
