// Match the user-visible scroll surface; document scrolling is locked because
// the persistent navigation owns its own layout row.
export async function scrollApp(page, edge = 'start') {
  await page.locator('.app-scroll-area').evaluate((area, where) => {
    area.scrollTo(0, where === 'end' ? area.scrollHeight : 0);
  }, edge);
}
