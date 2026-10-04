// Run with BetterWright from the repository root:
// betterwright run --no-daemon --close --no-auto-ui scripts/research/capture_gojoe.js
//
// This browser pass verifies the dynamically rendered public homepage and
// records visible product headings and calls to action. It does not log in or
// submit forms.
(async () => {
  await page.goto("https://www.gojoe.com/us", {
    waitUntil: "commit",
    timeout: 15_000,
  });
  await page.waitForTimeout(5_000);

  const headings = (await page.locator("h1,h2,h3").allTextContents())
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const callsToAction = await page.locator("a").evaluateAll((anchors) =>
    anchors
      .map((anchor) => ({
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
        href: anchor.href,
      }))
      .filter((item) => item.text && item.href)
      .slice(0, 200),
  );

  return {
    capturedAt: new Date().toISOString(),
    title: await page.title(),
    url: page.url(),
    headings: [...new Set(headings)],
    callsToAction,
  };
})()
