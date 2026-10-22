import { test, expect } from "@playwright/test";

test("loads the playground and formats code without logging errors", async ({
  page,
}) => {
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  await page.goto("/");

  await expect(page.locator("#loading")).toHaveClass(/hidden/, {
    timeout: 30000,
  });
  await expect(page.locator("#error-display")).toHaveClass(/hidden/);
  await expect(page.locator("#output-editor .cm-content")).toContainText(
    "def rubyfmt",
  );

  expect(errors).toEqual([]);
});
