import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar en la demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Tus aventuras" }),
  ).toBeVisible();
}
async function character(page: Page, name: string) {
  await expect(
    page.getByRole("heading", { name: "Personaje", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
  await page
    .getByLabel("Describe a tu aventurero")
    .fill("Una exploradora del bosque con una capa verde.");
  await page.getByRole("button", { name: "Confirmar personaje" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function round(a: Page, b: Page, text: string, n: number) {
  for (const page of [a, b]) {
    await page.locator("#intent").fill(text);
    await page.getByRole("button", { name: "Preparar acción" }).click();
  }
  for (const page of [a, b])
    await expect(page.locator(".round")).toHaveText(`Turno ${n}`);
}
test("two independent browsers complete a persistent cooperative adventure", async ({
  browser,
}) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  const a = await ac.newPage(),
    b = await bc.newPage();
  const errors: string[] = [];
  a.on("pageerror", (e) => errors.push(e.message));
  await demo(a);
  await a.getByRole("button", { name: "Crear campaña" }).click();
  await a
    .getByLabel("Nombre", { exact: true })
    .fill("El pacto de los hermanos");
  await a.getByRole("button", { name: "Crear", exact: true }).click();
  const code = (await a.getByTestId("invite-code").innerText()).trim();
  await character(a, "Alba");
  await demo(b);
  await b.getByRole("button", { name: "Unirse con código" }).click();
  await b.getByLabel("Código de invitación").fill(code);
  await b.getByRole("button", { name: "Unirse con código" }).last().click();
  await character(b, "Bruno");
  await a.getByRole("button", { name: "Comenzar aventura" }).click();
  await expect(b.locator("#intent")).toBeVisible();
  await a.screenshot({
    path: "test-results/desktop-adventure.png",
    fullPage: true,
  });
  await round(a, b, "Investigar", 1);
  await round(a, b, "Viajar a La brasa quieta", 2);
  await round(a, b, "Conversar", 3);
  await round(a, b, "Viajar a Plaza de Zarzavilla", 4);
  await round(a, b, "Viajar a La posada abandonada", 5);
  await round(a, b, "Investigar", 6);
  await a.locator("#intent").fill("Mi borrador persistente");
  await ac.setOffline(true);
  await expect(
    a.getByRole("button", { name: "Preparar acción" }),
  ).toBeDisabled();
  await ac.setOffline(false);
  await a.reload();
  await expect(a.locator("#intent")).toHaveValue("Mi borrador persistente");
  await expect(a.locator(".round")).toHaveText("Turno 6");
  await round(a, b, "Viajar a Sendero del bosque", 7);
  await round(a, b, "Viajar a La campana bajo el pozo", 8);
  await round(a, b, "Renovar el pacto", 9);
  await expect(
    a.getByRole("heading", { name: "La aldea recupera su voz" }),
  ).toBeVisible();
  await expect(
    b.getByRole("heading", { name: "La aldea recupera su voz" }),
  ).toBeVisible();
  await a.getByRole("button", { name: "Diario", exact: true }).first().click();
  await expect(a.getByRole("dialog")).toContainText("pacto");
  await a.getByRole("button", { name: "Cerrar", exact: true }).click();
  await a.getByRole("button", { name: "Español", exact: true }).click();
  await expect(
    a.getByRole("button", { name: "English", exact: true }),
  ).toBeVisible();
  await expect(
    a.getByRole("heading", { name: "The village finds its voice" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await ac.close();
  await bc.close();
});
test("mobile layout, keyboard drawer and reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await demo(page);
  await page.getByRole("button", { name: "Crear campaña" }).click();
  await page.getByLabel("Tamaño del grupo").selectOption("1");
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await character(page, "Celia");
  await page.getByRole("button", { name: "Comenzar aventura" }).click();
  await expect(page.locator("#intent")).toBeVisible();
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator("#intent").fill("@");
  await expect(page.locator(".mention-picker")).toBeVisible();
  await page.locator(".mention-picker button").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#intent")).not.toHaveValue("@");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-adventure.png",
    fullPage: true,
  });
  await context.close();
});
