import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "x";
const CLIENT_VIEWER_EMAIL = process.env.PLAYWRIGHT_CLIENT_VIEWER_EMAIL ?? "viewer101@example.com";
const CLIENT_VIEWER_PASSWORD = process.env.PLAYWRIGHT_CLIENT_VIEWER_PASSWORD ?? "x";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Kowinsblue 3PL Login" })).toBeVisible();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

async function expectNavLink(page: Page, label: RegExp, hrefPart: string) {
  const link = page
    .locator(`aside a[href='${hrefPart}'], aside a[href='#${hrefPart}']`)
    .filter({ hasText: label })
    .first();
  await expect(link).toBeVisible();
}

test.describe("deployed site smoke", () => {
  test("admin can log in and open core routes", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await expect(page).toHaveURL(/\/outbounds(?:\?.*)?$/);
    await expectNavLink(page, /inbounds/i, "/inbounds");
    await expectNavLink(page, /outbounds/i, "/outbounds");
    await expectNavLink(page, /inventory/i, "/inventory");
    await expectNavLink(page, /billing/i, "/billing/events");
    await expectNavLink(page, /dashboard/i, "/dashboard");
    await expectNavLink(page, /settings/i, "/settings");

    await page.goto("/guide");
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByRole("heading", { name: "User Guide" })).toBeVisible();
    await expect(page.locator("body")).toContainText(/Billing Events|정산\(Billing\) 상세 사용법/);
  });

  test("client viewer sees client-only navigation", async ({ page }) => {
    await login(page, CLIENT_VIEWER_EMAIL, CLIENT_VIEWER_PASSWORD);

    await expect(page).toHaveURL(/\/billing(?:\?.*)?$/);
    await expectNavLink(page, /billing/i, "/billing");
    await expectNavLink(page, /outbounds/i, "/outbounds");
    await expectNavLink(page, /inventory/i, "/inventory");
    await expectNavLink(page, /dashboard/i, "/dashboard");
    await expect(
      page.locator("aside a").filter({ hasText: /inbounds/i })
    ).toHaveCount(0);
    await expect(
      page.locator("aside a").filter({ hasText: /settings/i })
    ).toHaveCount(0);

    await expect(page.getByRole("link", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Billing Events" })).toHaveCount(0);

    await page.goto("/inventory");
    await expect(page).toHaveURL(/\/inventory(?:\?.*)?$/);
    await expect(page.locator("body")).toContainText("Available");
    await expect(page.locator("body")).toContainText("Reserved");
    await expect(page.locator("body")).toContainText("Allocatable");
  });
});
