import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
const password = "DeskHop-test-passphrase-2026!";
const base = "http://127.0.0.1:3100";
const unique = () => randomUUID().replaceAll("-", "").slice(0, 12);
async function command(
  request: APIRequestContext,
  path: string,
  data: unknown = {},
) {
  return request.post(`${base}/api/${path}`, {
    data,
    headers: { Origin: base, "Idempotency-Key": randomUUID() },
  });
}
async function makeUser(context: BrowserContext, name = "Test Student") {
  const handle = "test_" + unique();
  const response = await command(context.request, "auth/register", {
    name,
    handle,
    email: handle + "@example.test",
    password,
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const token = new URL(body.data.developmentLink, base).searchParams.get(
    "token",
  );
  expect(
    (await command(context.request, "auth/verify", { token })).ok(),
  ).toBeTruthy();
  return { id: body.data.user.id, handle, name };
}
async function removeUser(context: BrowserContext) {
  await command(context.request, "account/delete", { password });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
}

test("guest can filter spots, search, use keyboard dialog, and recover from no matches", async ({
  page,
}) => {
  await page.goto("/discover?catalog=sample");
  await expect(
    page.getByRole("heading", { name: "Aspen Reading Room" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("A quieter setting").check();
  await dialog.getByLabel("Somewhere to plug in").check();
  await dialog.getByRole("button", { name: "Show matching spots" }).click();
  await expect(
    page.getByRole("heading", { name: "Aspen Reading Room" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Juniper & Co." }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search study spots" })
    .fill("No such study venue");
  await expect(
    page.getByRole("heading", { name: "Let’s open up the possibilities" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset search" }).click();
  await expect(
    page.getByRole("heading", { name: "Juniper & Co." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Help me find a spot" }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox")
    .fill("quiet coffee with outlets");
  await page.getByRole("button", { name: "Find my kind of spot" }).click();
  await expect(
    page.getByRole("heading", { name: "Paper & Pine" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The Study Hall" }),
  ).toHaveCount(0);
});

test("registration, verification, sign-out, and password recovery work end to end", async ({
  page,
  context,
}) => {
  const handle = "flow_" + unique();
  await page.goto("/register");
  await page.getByLabel("Your name", { exact: true }).fill("Browser Test");
  await page.getByLabel("Your handle", { exact: true }).fill(handle);
  await page
    .getByLabel("Email address", { exact: true })
    .fill(handle + "@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create my account" }).click();
  await page
    .getByRole("link", { name: "Verify my email", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Verify my email", exact: true })
    .click();
  await expect(page.getByText("Your email is verified.")).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText("Email verified", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/forgot-password");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(handle + "@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.getByRole("link", { name: "Open password reset" }).click();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Update password" }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).last().click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill(handle + "@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Welcome back" }).click();
  await expect(page).toHaveURL(/discover/);
  await removeUser(context);
});

test("save, reserve, refresh, pause/resume, finish, review, and cancel a room", async ({
  page,
  context,
}) => {
  await makeUser(context);
  await page.goto("/spots/aspen-reading-room");
  await page.getByRole("button", { name: "Save this spot" }).click();
  await expect(
    page.getByRole("button", { name: "Saved for later" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find a time" }).click();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Date", { exact: true }).fill(tomorrow);
  await page.locator(".time-slots button:not([disabled])").first().click();
  await page.getByRole("button", { name: "Review reservation" }).click();
  await page
    .getByRole("button", { name: "Confirm reservation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your little corner is confirmed." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to My bookings" }).click();
  await expect(page).toHaveURL(/bookings/);
  await page.reload();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await page.goto("/study?spot=aspen-reading-room");
  await page
    .getByRole("button", { name: "Start studying", exact: true })
    .click();
  await expect(page.locator(".timer-digits")).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Aspen Reading Room", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(
    page.getByRole("heading", { name: "A little progress. A good feeling." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Share a thought about your spot" })
    .click();
  await page.getByRole("button", { name: "Leave a review" }).click();
  await page
    .getByLabel("Anything worth sharing?")
    .fill("A quiet sample venue for a focused afternoon.");
  await page.getByRole("button", { name: "Publish review" }).click();
  await expect(
    page.getByText("A quiet sample venue for a focused afternoon."),
  ).toBeVisible();
  await page.goto("/saved");
  await expect(
    page.getByRole("heading", { name: "Aspen Reading Room" }),
  ).toBeVisible();
  await page.goto("/bookings");
  await page
    .getByRole("button", { name: "Cancel reservation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel reservation", exact: true })
    .click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await removeUser(context);
});

test("two people can become friends and send a revocable, one-recipient hop", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  await makeUser(a, "Alex Test");
  const maya = await makeUser(b, "Maya Test");
  const alex = (await (await a.request.get(base + "/api/bootstrap")).json())
    .data.user;
  expect(
    (
      await command(a.request, "friends", {
        action: "request",
        target: maya.id,
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await command(b.request, "friends", { action: "accept", target: alex.id })
    ).ok(),
  ).toBeTruthy();
  const s = await command(b.request, "study", {
    spot_id: "aspen-reading-room",
    minutes: 50,
    visibility: "friends_status_and_venue",
    share_completion: false,
  });
  expect(s.ok()).toBeTruthy();
  expect(
    (
      await command(b.request, "availability", {
        mode: "open_to_join",
        minutes: 60,
        revision: 0,
      })
    ).ok(),
  ).toBeTruthy();
  const page = await a.newPage();
  await page.goto(base + "/friends");
  await expect(
    page.getByText("Open to company", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hop over" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Only Maya Test will see this arrival update.",
  );
  await page.getByRole("button", { name: "Tell Maya I’m on my way" }).click();
  await expect(
    page.getByText("Hopping over to Aspen Reading Room", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Hopping over to Aspen Reading Room", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Update ETA" }).click();
  await page.getByLabel("Time from now").selectOption("30");
  await page.getByRole("button", { name: "Save estimate" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await command(b.request, "settings", {
    name: "Maya Test",
    sharing: false,
    notify: false,
  });
  const projection = (await (await b.request.get(base + "/api/friends")).json())
    .data;
  expect(projection.incoming).toEqual([]);
  await page.getByRole("button", { name: "Cancel hop" }).click();
  await expect(
    page.getByText("Hopping over to Aspen Reading Room", { exact: true }),
  ).toHaveCount(0);
  await removeUser(a);
  await removeUser(b);
  await a.close();
  await b.close();
});

test("API rejects cross-origin writes, unverified bookings, and private reads by a guest", async ({
  request,
}) => {
  const r = await request.post("/api/auth/login", {
    data: { email: "nobody@example.test", password: "password" },
    headers: { Origin: "https://untrusted.example" },
  });
  expect(r.status()).toBe(403);
  expect((await request.get("/api/bookings")).status()).toBe(401);
  expect((await request.get("/api/admin")).status()).toBe(401);
  const handle = "unverified_" + unique().slice(0, 8);
  const account = await command(request, "auth/register", {
    name: "Unverified Test",
    handle,
    email: handle + "@example.test",
    password,
  });
  expect(account.ok()).toBeTruthy();
  const booking = await command(request, "bookings", {
    room_id: "aspen-room-a",
    starts_at: Date.now() + 86400000,
    duration: 60,
    party_size: 2,
  });
  expect(booking.status()).toBe(403);
  expect((await booking.json()).error.code).toBe("VERIFY_EMAIL");
  await command(request, "account/delete", { password });
});

test("discovery, dialogs, and mobile pages have no serious accessibility violations or horizontal overflow", async ({
  page,
  context,
}) => {
  await page.goto("/discover?catalog=sample");
  await expect(
    page.getByRole("heading", { name: "Aspen Reading Room" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/deskhop-desktop.png",
    fullPage: true,
  });
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await makeUser(context, "Mobile Test");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of [
      "/discover",
      "/spots/aspen-reading-room",
      "/study",
      "/friends",
      "/profile",
      "/bookings",
    ]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      await noOverflow(page);
    }
    await page.goto("/discover?catalog=sample");
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await noOverflow(page);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.screenshot({
      path: `test-results/deskhop-mobile-${width}.png`,
      fullPage: true,
    });
  }
  await removeUser(context);
});

test("real catalog is the default and registration returns to the selected study spot", async ({
  page,
  context,
}) => {
  await page.goto("/discover");
  await expect(
    page.getByRole("heading", { name: "Golden Library", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Aspen Reading Room", exact: true }),
  ).toHaveCount(0);
  await page.goto("/spots/golden-public-library");
  await expect(
    page.getByText("Outlets not verified", { exact: true }),
  ).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.goto("/study?spot=golden-public-library");
  await page.getByRole("button", { name: "Sign in to DeskHop" }).click();
  await expect(page).toHaveURL(/next=%2Fstudy%3Fspot%3Dgolden-public-library/);
  const user = await makeUser(context);
  await page
    .getByLabel("Email address", { exact: true })
    .fill(user.handle + "@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Welcome back" }).click();
  await expect(page).toHaveURL(/study\?spot=golden-public-library/);
  await expect(page.getByLabel("Your study spot")).toHaveValue(
    "golden-public-library",
  );
  await removeUser(context);
});

test("statewide photo filtering, map selection, attribution and directions work", async ({
  page,
}) => {
  await page.goto("/discover");
  await page.getByLabel("With location photos").check();
  const card = page.locator(".spot-card").first();
  await expect(card.locator("img")).toHaveAttribute(
    "src",
    /^https:\/\/(upload|thumb)\.wikimedia\.org\//,
  );
  await expect(card.locator(".photo-credit a")).toHaveAttribute(
    "href",
    /^https:\/\/commons\.wikimedia\.org/,
  );
  await page.getByRole("button", { name: "Map view", exact: true }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.locator(".spot-card").first().hover();
  await expect(page.locator(".map-preview")).toBeVisible();
  await page.locator(".spot-name").first().click();
  await expect(page.locator(".detail-hero-image img")).toHaveAttribute(
    "src",
    /^https:\/\/(upload|thumb)\.wikimedia\.org\//,
  );
  await expect(page.getByRole("link", { name: /Google Maps/ })).toHaveAttribute(
    "href",
    /google\.com\/maps/,
  );
  await expect(page.getByRole("link", { name: /Apple Maps/ })).toHaveAttribute(
    "href",
    /maps\.apple\.com/,
  );
});

test("profile appearance persists publicly and membership stays unavailable without billing", async ({page,context,request}) => {
  const user = await makeUser(context);
  try {
    await page.goto("/profile");
    await page.getByLabel("About you", {exact:false}).fill("Library afternoons and mountain mornings.");
    await page.getByRole("button",{name:"Save profile appearance"}).click();
    await expect(page.getByRole("status")).toContainText("Your public corner is updated.");
    const publicResponse = await request.get(`/api/profiles/${user.handle}`);
    expect(publicResponse.ok()).toBeTruthy();
    const publicData = (await publicResponse.json()).data;
    expect(publicData.decoration.bio).toBe("Library afternoons and mountain mornings.");
    expect(publicData.progress.coins).toBeUndefined();
    await page.reload();
    await expect(page.getByLabel("About you", {exact:false})).toHaveValue("Library afternoons and mountain mornings.");
    await page.getByRole("link",{name:"Community rankings",exact:true}).click();
    await page.getByRole("button",{name:"Community",exact:true}).click();
    await page.getByRole("button",{name:"Today",exact:true}).click();
    await expect(page.getByRole("button",{name:"Today",exact:true})).toHaveAttribute("aria-pressed","true");
    await page.goto("/premium");
    await expect(page.getByRole("button",{name:"Premium checkout is not open yet"})).toBeDisabled();
    await page.setViewportSize({width:390,height:844});
    await noOverflow(page);
  } finally { await removeUser(context); }
});
