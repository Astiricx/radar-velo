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
/**
 * Exécuté avant chaque navigation : enregistre les réponses JSON du site pendant le
 * chargement (recherche interne, données des annonces). La fonction de page s'en sert
 * si les annonces n'apparaissent pas dans la page.
 */
export const PRE_NAVIGATION_HOOKS = `[
  async ({ page }) => {
    page.__radarJson = [];
    page.on('response', async (res) => {
      try {
        const type = (res.headers()['content-type'] || '').toLowerCase();
        const url = res.url();
        if (!type.includes('json') || /google|facebook|doubleclick|datadome|didomi|sentry|analytics|hotjar|criteo|tiktok|bing/i.test(url)) return;
        const body = await res.text();
        if (page.__radarJson.length < 10 && body.length < 3000000) page.__radarJson.push({ url, status: res.status(), body: body.slice(0, 500000) });
      } catch (e) {}
    });
  },
]`

export const BROWSER_PAGE_FUNCTION = `async function pageFunction(context) {
  const { page, request, customData, log } = context;
  const base = request.loadedUrl || request.url;

  // Annonces trouvées dans les réponses JSON du site (API de recherche interne), si la page reste vide.
  const fromJson = (captured, cd) => {
    const out = [];
    const seen = new Set();
    const pattern = new RegExp(cd.linkPattern);
    const fold = (s) => String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
    const prefilter = cd.prefilter ? new RegExp(cd.prefilter) : null;
    const pick = (o, keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return undefined; };
    const walk = (node, depth) => {
      if (!node || depth > 8 || out.length >= 40) return;
      if (Array.isArray(node)) { for (const x of node) walk(x, depth + 1); return; }
      if (typeof node !== 'object') return;
      const title = pick(node, ['title', 'name', 'titre', 'label', 'subject']);
      let link = pick(node, ['url', 'link', 'href', 'permalink', 'canonical_url', 'slug']);
      let price = pick(node, ['price', 'prix', 'amount', 'price_eur', 'sale_price', 'priceAmount']);
      if (price && typeof price === 'object') price = pick(price, ['amount', 'value', 'price', 'eur']);
      if (typeof title === 'string' && link !== undefined && price !== undefined) {
        try {
          link = String(link);
          link = new URL(/^https?:/.test(link) || link.startsWith('/') ? link : '/fr-fr/annonce/' + link, base).href.split('#')[0];
          let amount = Number(String(price).replace(/[^\\d.,]/g, '').replace(',', '.'));
          if (amount > 50000) amount = amount / 100; // centimes
          const blob = fold(JSON.stringify(node));
          const keep = pattern.test(new URL(link).pathname) && !seen.has(link) && amount > 0 &&
            (!prefilter || prefilter.test(blob)) && amount >= cd.priceMin && amount <= cd.priceMax;
          if (keep) {
            seen.add(link);
            const img = pick(node, ['image', 'imageUrl', 'image_url', 'thumbnail', 'picture', 'photo', 'cover', 'main_image']);
            const imgs = pick(node, ['images', 'photos', 'pictures']);
            out.push({
              kind: 'ad', url: link, title, fromJson: true, jsonLd: [],
              attributes: Object.fromEntries([['taille', pick(node, ['size', 'taille', 'frame_size', 'frameSize'])], ['etat', pick(node, ['condition', 'etat', 'state'])]].filter(([, v]) => typeof v === 'string' || typeof v === 'number')),
              image: typeof img === 'string' ? img : (img && pick(img, ['url', 'src', 'large'])) || '',
              images: Array.isArray(imgs) ? imgs.map((i) => (typeof i === 'string' ? i : i && pick(i, ['url', 'src', 'large']))).filter(Boolean).slice(0, 4) : [],
              postalCode: pick(node, ['zipcode', 'zip_code', 'postal_code', 'postalCode', 'postcode', 'cp']),
              description: JSON.stringify(node).slice(0, 3000),
              text: title + ' ' + amount + ' €',
            });
          }
        } catch (e) {}
      }
      for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, depth + 1);
    };
    for (const c of captured) { try { walk(JSON.parse(c.body), 0); } catch (e) {} }
    return out;
  };

  if (!request.userData || request.userData.label !== 'DETAIL') {
    // Les annonces sont injectées par le JavaScript du site : on leur laisse le temps d'apparaître.
    await page.waitForSelector('a[href*="/annonce/"]', { timeout: 45000 }).catch(() => null);
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight)).catch(() => null);
    await new Promise((r) => setTimeout(r, 2500));
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
      // Tri des vignettes « MARQUE • taille • état 3900 € » : prix dans le budget, puis taille
      // compatible (ou, si la taille manque, un groupe retenu cité dans le titre). Les annonces
      // déjà analysées (cd.skipIds) ne sont pas rouvertes : on ne paie que les nouvelles.
      const skip = new Set(cd.skipIds || []);
      const sizes = (cd.sizes || []).map((s) => fold(String(s)).replace(/\\s|cm/g, ''));
      const stats = { known: 0, price: 0, size: 0, group: 0 };
      const decided = [];
      for (const [url, text] of cards.entries()) {
        const t = fold(text);
        const id = (url.match(/-(\\d+)\\/?$/) || [])[1];
        const m = t.match(/(\\d{1,2}[\\s\\u202f.]?\\d{3}|\\d{2,3})(?:[.,]\\d{2})?\\s?€/);
        const price = m ? Number(m[1].replace(/[\\s\\u202f.]/g, '')) : null;
        const field = (t.match(/•\\s*([^•€]{1,12}?)\\s*•/) || [])[1];
        const size = field ? field.replace(/\\s|cm/g, '') : null;
        const sized = size && /^(xxs|xs|s|m|l|xl|xxl|s\\/m|m\\/l|l\\/xl|\\d{2})$/.test(size) ? size : null;
        const group = prefilter ? prefilter.test(t) : true;
        let why = null;
        if (id && skip.has(id)) { why = 'known'; }
        else if (price !== null && (price < cd.priceMin || price > cd.priceMax)) { why = 'price'; }
        else if (sized && sizes.length && !sizes.includes(sized)) { why = 'size'; }
        else if (!sized && !group) { why = 'group'; }
        if (why) stats[why]++;
        else decided.push({ url, group, sized: !!sized });
      }
      // Les plus prometteuses d'abord : taille connue et groupe cité, puis taille seule, puis groupe seul.
      decided.sort((a, b) => (Number(b.group) + Number(b.sized)) - (Number(a.group) + Number(a.sized)));
      const kept = decided.map((d) => d.url).slice(0, cd.maxListings);
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
        stats,
        candidates: decided.length,
        apis,
      };
    }, customData);
    log.info(customData.label + ' : ' + data.found + ' annonces sur la page, ' + data.kept.length + ' prometteuses ouvertes');
    const captured = page.__radarJson || [];
    const apis = Array.from(new Set(captured.map((c) => c.url + ' (' + c.status + ')').concat(data.apis))).slice(0, 15);
    const status = context.response && typeof context.response.status === 'function' ? context.response.status() : null;
    const list = { kind: 'list', url: base, status, found: data.found, kept: data.kept.length, pageTitle: data.pageTitle, size: data.size, samples: data.samples, apis, stats: data.stats, candidates: data.candidates };
    if (data.found === 0) {
      // Page vide : les annonces sont peut-être seulement dans les réponses JSON du site.
      const ads = fromJson(captured, customData).slice(0, 30);
      log.info(customData.label + ' : aucune annonce dans la page, ' + ads.length + ' trouvées dans ' + captured.length + ' réponses JSON');
      return [Object.assign(list, { found: ads.length, kept: ads.length, fromJson: true })].concat(ads);
    }
    for (const url of data.kept) await context.enqueueRequest({ url, userData: { label: 'DETAIL' } });
    return list;
  }

  await page.waitForSelector('h1', { timeout: 30000 }).catch(() => null);
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
