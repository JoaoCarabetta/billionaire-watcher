import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workflow = fs.readFileSync(
  path.join(fileURLToPath(new URL(".", import.meta.url)), "..", ".github", "workflows", "dbt-ci.yml"),
  "utf8",
);

describe("dbt CI workflow", () => {
  it("still parses and unit-tests the warehouse on PRs", () => {
    expect(workflow).toMatch(/pull_request/);
    expect(workflow).toMatch(/dbt parse|dbt test/);
    expect(workflow).toMatch(/transform/);
  });
});
