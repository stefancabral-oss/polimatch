import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import ROSTER from "../../shared/presidential-roster.json" with { type: "json" };
import { categoryPeople } from "../../shared/presidential-curation.js";
import { voteResponseV2 } from "./aggregate-fixture.mjs";
const kind = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const browser = await { chromium, webkit }[kind].launch();
const base = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const screenshots = process.env.POLIMATCH_RACE_SCREENSHOTS;
if (screenshots) await mkdir(screenshots, { recursive: true });
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
  ]) {
    const context = await browser.newContext({
        viewport,
        serviceWorkers: "block",
      }),
      page = await context.newPage();
    const errors = [],
      requests = [],
      pools = new Map(),
      receipts = new Map();
    let dropFirst = true;
    page.on("pageerror", (e) => errors.push(e.message));
    const poolFor = (topic) => {
      if (!pools.has(topic))
        pools.set(topic, {
          version: 0,
          duels: 0,
          stats: new Map(
            categoryPeople(ROSTER, topic).map((p) => [
              p.id,
              {
                id: p.id,
                name: p.name,
                elo: 1000,
                wins: 0,
                losses: 0,
                decisions: 0,
                winRate: 0,
                rank: null,
              },
            ]),
          ),
        });
      return pools.get(topic);
    };
    function snapshot(topic) {
      const pool = poolFor(topic);
      const ranking = [...pool.stats.values()].sort(
        (a, b) => b.elo - a.elo || a.id.localeCompare(b.id),
      );
      let rank = 0,
        last = null;
      ranking.forEach((p, i) => {
        if (p.decisions) {
          if (last !== p.elo) rank = i + 1;
          p.rank = rank;
          last = p.elo;
        }
      });
      return structuredClone({
        version: pool.version,
        duels: pool.duels,
        ranking,
      });
    }
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url()),
        path = url.pathname;
      const send = (json, status = 200) => route.fulfill({ status, json });
      if (path === "/api/player")
        return send({ recoveryKey: "pm2_" + "a".repeat(43) }, 201);
      if (path === "/api/player/state")
        return send(snapshot(url.searchParams.get("topic")));
      if (path !== "/api/round-vote")
        return send({ error: "unexpected " + path }, 404);
      const body = route.request().postDataJSON();
      requests.push(body);
      assert.equal(body.selectionIds.length, 2);
      assert.notEqual(...body.selectionIds);
      assert.equal(body.winnerId, body.selectionIds[0]);
      const expected = categoryPeople(ROSTER, body.topicId).map((p) => p.id);
      assert.ok(body.candidateIds.every((id) => expected.includes(id)));
      if (receipts.has(body.roundId)) {
        const receipt = structuredClone(receipts.get(body.roundId));
        receipt.round.status = receipt.vote.status = "alreadyProcessed";
        return send(receipt);
      }
      const pool = poolFor(body.topicId);
      assert.equal(body.playerVersion, pool.version);
      pool.version++;
      pool.duels++;
      const tier = { id: "contender", label: "No páreo", level: 2 };
      const outcomes = body.candidateIds.map((id) => {
        const order = body.selectionIds.indexOf(id) + 1,
          delta = order === 1 ? 24 : order === 2 ? 8 : -16,
          row = pool.stats.get(id);
        row.elo += delta;
        row.wins += order === 1 ? 3 : order === 2 ? 2 : 0;
        row.losses += order === 2 ? 1 : order ? 0 : 2;
        row.decisions = row.wins + row.losses;
        row.winRate = (row.wins / row.decisions) * 100;
        return {
          id,
          result: order ? "winner" : "loser",
          selectionOrder: order || null,
          delta,
          elo: row.elo,
          previousTier: tier,
          tier,
          tierChange: null,
        };
      });
      const feedback = {
        primaryEvent: "confirm",
        rankingEvent: "confirm",
        zebra: false,
        outcomes,
      };
      const round = {
        id: body.roundId,
        status: "created",
        winnerId: body.winnerId,
        selectionIds: body.selectionIds,
        scoringRuleset: "ordered-two-v1",
        candidateIds: body.candidateIds,
        comparisons: 5,
        feedbackScope: "personal",
        personalFeedback: feedback,
      };
      const payload = voteResponseV2(
        { round, vote: round, player: snapshot(body.topicId) },
        { aggregate: false },
      );
      receipts.set(body.roundId, payload);
      if (dropFirst) {
        dropFirst = false;
        return route.abort("failed");
      }
      return send(payload);
    });
    await page.goto(new URL("duelos-da-corrida.html", base).href);
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-card][aria-disabled="false"]')
          .length === 4,
    );
    if (screenshots)
      await page.screenshot({
        path: `${screenshots}/${kind}-${viewport.width}-inicio.png`,
        fullPage: true,
      });
    const originalSound = await page
      .locator("#race-sound")
      .getAttribute("aria-pressed");
    await page.locator("#race-sound").click();
    assert.notEqual(
      await page.locator("#race-sound").getAttribute("aria-pressed"),
      originalSound,
    );
    await page.locator("#race-sound").click();
    await page.locator("#race-start").click();
    const cards = page.locator("#race-table [data-card]");
    assert.equal(await cards.count(), 4);
    const profile = page.locator("[data-profile]").first();
    await profile.click();
    await page.locator("#race-profile[open]").waitFor();
    const sources = await page
      .locator("#profile-content a")
      .evaluateAll((nodes) => nodes.map((n) => ({ href: n.href, rel: n.rel })));
    assert.ok(
      sources.every(
        (a) => a.href.startsWith("https://") && a.rel.includes("noopener"),
      ),
    );
    await page.keyboard.press("Escape");
    assert.ok(await profile.evaluate((b) => b === document.activeElement));
    await cards.nth(0).click();
    assert.equal(requests.length, 0);
    await cards.nth(0).click();
    assert.equal(await cards.nth(0).getAttribute("aria-pressed"), "false");
    await cards.nth(0).click();
    await cards.nth(1).click();
    await page.locator("#race-retry:visible").waitFor();
    assert.equal(await page.locator("#race-progress").innerText(), "0 / 10");
    await cards.nth(2).evaluate((b) => b.click());
    assert.equal(requests.length, 1);
    await page.locator("#race-back").click();
    assert.equal(await page.locator("[data-category]:disabled").count(), 6);
    await page.locator("#nav-play").click();
    await page.reload();
    await page.locator("#race-start").click();
    await page.locator("#race-retry:visible").waitFor();
    await context.setOffline(true);
    await page.waitForFunction(
      () => !navigator.onLine && document.querySelector("#race-retry").disabled,
    );
    assert.ok(await page.locator("#race-retry").isDisabled());
    await cards.nth(3).evaluate((b) => b.click());
    assert.equal(requests.length, 1);
    await context.setOffline(false);
    await page.waitForFunction(
      () => navigator.onLine && !document.querySelector("#race-retry").disabled,
    );
    await page.locator("#race-retry").click();
    await page.locator("#race-next:visible").waitFor();
    assert.deepEqual(requests[1], requests[0]);
    assert.equal(poolFor("corrida-politicos").duels, 1);
    assert.equal(await page.locator("#race-progress").innerText(), "1 / 10");
    assert.equal(await page.locator(".tcg-outcome:visible").count(), 4);
    assert.equal(await page.locator(".is-muted").count(), 2);
    if (screenshots)
      await page.screenshot({
        path: `${screenshots}/${kind}-${viewport.width}-confirmada.png`,
        fullPage: true,
      });
    for (let round = 2; round <= 10; round++) {
      await page.locator("#race-next").click();
      await cards.nth(0).click();
      await cards.nth(1).click();
      await page.locator("#race-next:visible").waitFor();
      assert.equal(
        await page.locator("#race-progress").innerText(),
        `${round} / 10`,
      );
    }
    await page.locator("#race-next").click();
    await page.locator("#race-finish:visible").waitFor();
    assert.equal(await page.locator("#finish-podium .tcg-card").count(), 3);
    await page.evaluate(() => {
      navigator.share = async (data) => {
        window.lastShare = data;
      };
    });
    await page.locator("#race-share").click();
    assert.match(
      await page.evaluate(() => window.lastShare.text),
      /dez rodadas/,
    );
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.copiedShare = text;
          },
        },
      });
    });
    await page.locator("#race-share").click();
    await page.waitForFunction(() =>
      window.copiedShare?.includes("dez rodadas"),
    );
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      }),
    );
    await page.locator("#race-share").click();
    await page.locator("#share-fallback:visible").waitFor();
    assert.match(
      await page.locator("#share-fallback").inputValue(),
      /dez rodadas/,
    );
    await page.locator("#finish-ranking").click();
    assert.ok((await page.locator("#ranking-list li").count()) > 0);
    await page.locator("#ranking-back").click();
    await page.locator("#race-restart").click();
    assert.equal(await page.locator("#race-progress").innerText(), "0 / 10");
    assert.equal(poolFor("corrida-politicos").duels, 10);
    await page.locator("#race-back").click();
    await page.locator("#race-show-roster").click();
    assert.equal(await page.locator(".roster-person").count(), 104);
    await page.locator('#roster-grid [data-profile="janja"]').click();
    assert.match(
      await page.locator("#profile-content").innerText(),
      /Apoia Lula/,
    );
    await page.locator("#profile-close").click();
    await page.locator("#roster-back").click();
    for (const category of ROSTER.categories) {
      await page.locator(`[data-category="${category.id}"]`).click();
      await page.waitForFunction(
        (topic) =>
          document.querySelector("#category-name")?.textContent === topic &&
          document.querySelectorAll('[data-card][aria-disabled="false"]')
            .length === 4,
        category.name,
      );
      await page.locator("#race-arena:visible").waitFor();
      await page.locator("#nav-roster").click();
      assert.equal(
        await page.locator(".roster-person").count(),
        categoryPeople(ROSTER, category.id).length,
      );
      await page.locator("#roster-search").fill("zzzzunknown");
      assert.equal(await page.locator(".roster-person").count(), 0);
      await page.locator("#roster-search").fill("");
      for (const person of categoryPeople(ROSTER, category.id)) {
        await page
          .locator(`#roster-grid [data-profile="${person.id}"]`)
          .click();
        await page.locator(".profile-tcg img").first().waitFor();
        await page.waitForFunction(() =>
          [...document.querySelectorAll(".profile-tcg img")].every(
            (img) => img.complete && img.naturalWidth > 0,
          ),
        );
        assert.equal(
          await page.locator("#profile-heading").innerText(),
          person.name,
        );
        await page.locator("#profile-close").click();
      }
      await page.locator("#nav-play").click();
      await cards.nth(0).click();
      await cards.nth(1).click();
      await page.locator("#race-next:visible").waitFor();
      await page.locator("#race-back").click();
    }
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator("#nav-play").click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `overflow at ${width}`,
      );
      const boxes = await page.locator(".race-card-wrap").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        }),
      );
      assert.equal(boxes.length, 4);
      if (width <= 640) {
        assert.ok(Math.abs(boxes[0].y - boxes[1].y) < 2);
        assert.ok(boxes[2].y > boxes[0].y);
      } else if (width >= 1000)
        assert.ok(boxes.every((b) => Math.abs(b.y - boxes[0].y) < 2));
      await page.locator("#race-back").click();
    }
    assert.deepEqual(errors, []);
    console.log(
      `${kind} ${viewport.width}: ten rounds, exact replay after lost response/reload, offline, restart, six categories, all profiles, search, source links, sound, share, ranking and responsive geometry passed`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
