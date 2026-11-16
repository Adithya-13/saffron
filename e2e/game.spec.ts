import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR;

const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const PHONE = { width: 390, height: 664 };

const newPlayer = async (browser: Browser, viewport = PHONE) => {
  const context = await browser.newContext({ viewport, hasTouch: true });
  return context.newPage();
};

const takeSpices = async (page: Page, labels: readonly string[]): Promise<void> => {
  for (const label of labels) {
    await page.getByRole('button', { name: new RegExp(`^${label}: \\d+ left`) }).click();
  }
  await page.getByRole('button', { name: 'Take spices' }).click();
};

const waitForMyTurn = (page: Page) =>
  expect(page.locator('.topbar__turn')).toHaveText('Your turn', { timeout: 15_000 });

test('two friends play, undo, chat and reconnect', async ({ browser }) => {
  const ana = await newPlayer(browser, { width: 1280, height: 860 });
  await ana.goto('/');
  await ana.getByLabel('Your merchant name').fill('Ana');
  await shot(ana, '01-home');
  await ana.getByRole('button', { name: 'Host a new game' }).click();
  await expect(ana).toHaveURL(/\/r\/[A-Z0-9]{5}$/);
  const roomUrl = ana.url();

  const budi = await newPlayer(browser);
  await budi.goto(roomUrl);
  await budi.getByLabel('Your merchant name').fill('Budi');
  await budi.getByRole('button', { name: 'Enter' }).click();

  await expect(ana.locator('.seat__name', { hasText: 'Budi' })).toBeVisible();
  await shot(ana, '02-lobby');
  await ana.getByRole('button', { name: 'Open the market' }).click();

  await waitForMyTurn(ana);
  await expect(budi.locator('.topbar__turn')).toHaveText("Ana's turn");
  await ana.waitForTimeout(800);
  await shot(ana, '03-table-start');
  await shot(budi, '03-table-mobile');

  await takeSpices(ana, ['Saffron', 'Cardamom', 'Sumac']);
  await waitForMyTurn(budi);
  await expect(ana.getByLabel('1 Saffron tokens')).toBeVisible();

  await takeSpices(budi, ['Pepper', 'Pepper']);
  await waitForMyTurn(ana);

  await ana.locator('.market__row--t1 .market__slot button.card').first().click();
  await expect(ana.locator('.detail')).toBeVisible();
  await shot(ana, '04-card-selected');
  await ana.getByRole('button', { name: /^Reserve/ }).click();
  await waitForMyTurn(budi);
  await expect(ana.locator('.dock .reserve-thumb')).toHaveCount(1);
  await ana.locator('.dock .reserve-thumb').first().click();
  await expect(ana.locator('.detail')).toBeVisible();
  await shot(ana, '04b-reserved-detail');
  await ana.getByRole('button', { name: 'Close' }).click();

  await ana.getByRole('button', { name: /Take back my turn/ }).click();
  await expect(budi.getByRole('button', { name: 'Allow' })).toBeVisible();
  await shot(budi, '05-undo-vote');
  await budi.getByRole('button', { name: 'Allow' }).click();
  await waitForMyTurn(ana);
  await expect(ana.locator('.dock .reserve-thumb')).toHaveCount(0);

  await ana.getByRole('button', { name: /^Chat/ }).click();
  await ana.getByLabel('Chat message').fill('Good luck, Budi!');
  await ana.getByRole('button', { name: 'Send' }).click();
  await expect(budi.locator('.icon-btn__dot')).toBeVisible();
  await budi.getByRole('button', { name: /^Chat/ }).click();
  await expect(budi.locator('.chat__text', { hasText: 'Good luck, Budi!' })).toBeVisible();
  await shot(budi, '05b-chat-sheet');
  await budi.getByRole('button', { name: 'Close' }).click();
  await ana.getByRole('button', { name: 'Close' }).click();

  await budi.reload();
  await expect(budi.locator('.topbar__turn')).toHaveText("Ana's turn", { timeout: 15_000 });
  await expect(budi.getByRole('button', { name: /^Ana, \d+ prestige/ })).toBeVisible();
  await expect(budi.locator('.dock')).toBeVisible();

  await takeSpices(ana, ['Salt', 'Pepper', 'Saffron']);
  await waitForMyTurn(budi);
  await ana.waitForTimeout(400);
  await shot(ana, '06-after-turns');
});

const playOneTurn = async (page: Page): Promise<void> => {
  const returnButton = page.getByRole('button', { name: 'Return tokens' });
  if (await returnButton.isVisible()) {
    const plus = page.getByRole('button', { name: /^Return one / });
    for (let i = 0; i < (await plus.count()) && (await returnButton.isDisabled()); i++) {
      for (let k = 0; k < 3 && (await returnButton.isDisabled()); k++) await plus.nth(i).click();
    }
    await returnButton.click();
    return;
  }
  const guildChoice = page.locator('.guild-choice button.guild-option');
  if ((await guildChoice.count()) > 0) {
    await guildChoice.first().click();
    return;
  }
  const affordableCard = page
    .locator('.market button.card.card--affordable, .dock .reserve-thumb:has(.card--affordable)')
    .last();
  if ((await affordableCard.count()) > 0) {
    await affordableCard.click();
    await page.getByRole('button', { name: 'Buy' }).click();
    return;
  }
  const pile = page.locator('button.pile.pile--available');
  if ((await pile.count()) > 0) {
    for (let i = 0; i < 3 && (await pile.count()) > 0; i++) await pile.first().click();
    await page.getByRole('button', { name: 'Take spices' }).click();
    return;
  }
  const pass = page.getByRole('button', { name: 'Pass' });
  if (await pass.isVisible()) {
    await pass.click();
    return;
  }
  await page.locator('.market button.card').first().click();
  await page.getByRole('button', { name: /^Reserve/ }).click();
};

test('a full game against a bot reaches the end screen', async ({ browser }) => {
  test.setTimeout(420_000);
  const page = await newPlayer(browser);
  await page.goto('/');
  await page.getByLabel('Your merchant name').fill('Dewi');
  await page.getByRole('button', { name: 'Host a new game' }).click();
  await page.getByRole('button', { name: 'Add a bot' }).click();
  await page.getByRole('button', { name: 'Open the market' }).click();

  const end = page.locator('.end');
  let midShot = false;
  for (let turn = 0; turn < 200; turn++) {
    await expect(page.locator('.topbar__turn:text("Your turn"), .end').first()).toBeVisible({
      timeout: 30_000,
    });
    if (await end.isVisible()) break;
    await page.waitForTimeout(150);
    if (!midShot && turn === 12) {
      midShot = true;
      await shot(page, '08-mid-game');
    }
    await playOneTurn(page);
    await expect(page.locator('.topbar__turn:text("Your turn")'))
      .toBeHidden({ timeout: 5_000 })
      .catch(() => undefined);
  }
  await expect(end).toBeVisible();
  await expect(page.locator('.end__rank')).toHaveCount(2);
  await page.waitForTimeout(2500);
  await shot(page, '09-end-screen');
});

test('solo game against a bot advances automatically', async ({ browser }) => {
  const solo = await newPlayer(browser);
  await solo.goto('/');
  await solo.getByLabel('Your merchant name').fill('Citra');
  await solo.getByRole('button', { name: 'Host a new game' }).click();
  await solo.getByRole('button', { name: 'Add a bot' }).click();
  await solo.getByRole('button', { name: 'Add a bot' }).click();
  await solo.getByRole('button', { name: 'Open the market' }).click();
  await waitForMyTurn(solo);
  await takeSpices(solo, ['Saffron', 'Sumac', 'Salt']);
  await expect(solo.locator('.topbar__turn')).not.toHaveText('Your turn');
  await waitForMyTurn(solo);
  await solo.getByRole('button', { name: 'Move log' }).click();
  await expect(solo.locator('.log__line')).toHaveCount(3);
  await shot(solo, '07-vs-bots');
});
