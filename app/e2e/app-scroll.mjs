// Match the user-visible scroll surface; document scrolling is locked because
// the persistent navigation owns its own layout row.
export async function scrollApp(page, edge = 'start') {
  await page.locator('.app-scroll-area').evaluate(async (area, where) => {
    area.scrollTo(0, where === 'end' ? area.scrollHeight : 0);
    // WebKit paints nested overflow asynchronously. Raw mouse coordinates must
    // be used only after the scrolled layer has reached the displayed frame.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  }, edge);
}
