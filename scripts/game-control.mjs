// Use the same menu path players use, while supporting the official-mode UI.
export async function gameControl(page, selector) {
  const control = page.locator(selector);
  if (!(await control.isVisible()) && await page.locator('#play-menu-btn').isVisible())
    await page.locator('#play-menu-btn').click();
  await control.click();
  if (['#mute-btn', '#theme-btn'].includes(selector) && await page.locator('#playMenu.active').count())
    await page.keyboard.press('Escape');
}
