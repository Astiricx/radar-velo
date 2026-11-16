/**
 * Fonction de page pour apify/puppeteer-scraper : un vrai Chrome sans écran, qui
 * exécute le JavaScript du site (pages rendues côté navigateur, protections anti-robot
 * qui vérifient le navigateur).
 *
 * Même logique que la fonction Cheerio (page-function.ts) : sur la liste, repérer les
 * annonces, ne garder que les vignettes prometteuses (groupe et prix), les ouvrir ; sur
 * une annonce, renvoyer titre, JSON-LD, métadonnées, caractéristiques et texte.
 *
 * En plus, sur la page de liste, elle relève les appels JSON (fetch / XHR) faits par le
 * site : s'il existe une API de recherche interne, elle apparaît dans le journal de la
 * veille (champ `apis`), et pourra remplacer le navigateur, beaucoup plus coûteux.
 *
 * Exécutée dans Node par l'acteur ; le code passé à page.evaluate tourne dans la page.
 * Écrite en JavaScript simple : elle est envoyée telle quelle à Apify.
 */
export const BROWSER_PAGE_FUNCTION = `async function pageFunction(context) {
  const { page, request, customData, log } = context;
  const base = request.loadedUrl || request.url;

  if (!request.userData || request.userData.label !== 'DETAIL') {
    // Les annonces sont injectées par le JavaScript du site : on attend qu'elles apparaissent.
    await page.waitForSelector('a[href*="/annonce/"]', { timeout: 30000 }).catch(() => null);
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight)).catch(() => null);
    await new Promise((r) => setTimeout(r, 1500));
    const data = await page.evaluate((cd) => {
      const fold = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
      const pattern = new RegExp(cd.linkPattern);
      const prefilter = cd.prefilter ? new RegExp(cd.prefilter) : null;
      const cards = new Map();
      for (const a of document.querySelectorAll('a[href]')) {
        let url;
        try { url = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
        if (!pattern.test(url.pathname)) continue;
        const href = url.href.split('#')[0];
        // Texte de la vignette : on remonte jusqu'au bloc qui contient le prix.
        let node = a;
        let text = a.innerText || '';
        for (let i = 0; i < 5 && node.parentElement && !/\\d\\s?€/.test(text); i++) { node = node.parentElement; text = node.innerText || ''; }
        text = text.replace(/\\s+/g, ' ').trim().slice(0, 600);
        if (!cards.has(href) || cards.get(href).length < text.length) cards.set(href, text);
      }
      const kept = Array.from(cards.entries()).filter(([, text]) => {
        const t = fold(text);
        if (prefilter && !prefilter.test(t)) return false;
        const m = t.match(/(\\d{1,2}[\\s\\u202f.]?\\d{3})(?:[.,]\\d{2})?\\s?€/);
        const price = m ? Number(m[1].replace(/[\\s\\u202f.]/g, '')) : null;
        return price === null || (price >= cd.priceMin && price <= cd.priceMax);
      }).map(([url]) => url).slice(0, cd.maxListings);
      // Appels JSON du site pendant le chargement : piste pour une API de recherche interne.
      const apis = Array.from(new Set(performance.getEntriesByType('resource')
        .filter((e) => e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest')
        .map((e) => e.name)
        .filter((u) => !/google|facebook|doubleclick|hotjar|criteo|analytics|sentry|datadome|didomi|cookie|tagcommander|pinterest|tiktok|bing/i.test(u))))
        .slice(0, 15);
      return {
        found: cards.size,
        kept,
        pageTitle: document.title.slice(0, 120),
        size: document.documentElement.outerHTML.length,
        samples: Array.from(cards.values()).slice(0, 3).map((t) => t.slice(0, 140)),
        apis,
      };
    }, customData);
    log.info(customData.label + ' : ' + data.found + ' annonces sur la page, ' + data.kept.length + ' prometteuses ouvertes');
    for (const url of data.kept) await context.enqueueRequest({ url, userData: { label: 'DETAIL' } });
    return { kind: 'list', url: base, found: data.found, kept: data.kept.length, pageTitle: data.pageTitle, size: data.size, samples: data.samples, apis: data.apis };
  }

  await page.waitForSelector('h1', { timeout: 20000 }).catch(() => null);
  const ad = await page.evaluate(() => {
    const meta = (name) => (document.querySelector('meta[property="' + name + '"]') || document.querySelector('meta[name="' + name + '"]') || {}).content || '';
    const jsonLd = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { try { jsonLd.push(JSON.parse(s.textContent)); } catch (e) {} }
    const attributes = {};
    for (const dt of document.querySelectorAll('dt')) { const dd = dt.nextElementSibling; if (dd && dd.tagName === 'DD') attributes[dt.innerText.trim()] = dd.innerText.trim(); }
    for (const tr of document.querySelectorAll('tr')) { const c = tr.querySelectorAll('th,td'); if (c.length === 2) attributes[c[0].innerText.trim()] = c[1].innerText.trim(); }
    const images = [];
    for (const img of document.querySelectorAll('img')) {
      const src = img.currentSrc || img.getAttribute('data-src') || img.src || '';
      if (/^https?:/.test(src) && !/logo|icon|avatar|sprite|flag|\\.svg/i.test(src) && !images.includes(src)) images.push(src);
    }
    const h1 = document.querySelector('h1');
    return {
      title: h1 ? h1.innerText.trim() : '',
      ogTitle: meta('og:title'),
      description: meta('og:description') || meta('description'),
      image: meta('og:image'),
      images: images.slice(0, 6),
      jsonLd,
      attributes,
      text: ((document.querySelector('main') || document.body).innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 8000),
    };
  });
  return Object.assign({ kind: 'ad', url: base }, ad);
}`
