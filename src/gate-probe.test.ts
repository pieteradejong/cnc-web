import { expect, test } from "vitest";

// Deliberately red: proves Deployment Checks hold the production alias (dotfiles D42).
// Reverted by the next commit.
test("gate probe", () => {
  expect(1).toBe(2);
});
