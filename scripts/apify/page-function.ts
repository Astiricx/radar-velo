/**
 * Fonction de page commune à Troc-Vélo et Decathlon Occasion, exécutée par
 * l'acteur gratuit apify/cheerio-scraper (HTML sans navigateur, quelques secondes
 * de calcul).
 *
 * Sur une page de liste, elle repère les liens d'annonces (customData.linkPattern)
 * et ne garde que celles dont la vignette mentionne un groupe utile et un prix dans
 * le budget (customData.prefilter, priceMin, priceMax) : on n'ouvre que les annonces
 * prometteuses, au plus customData.maxListings. Sur une page d'annonce, elle renvoie
 * le titre, le JSON-LD, les métadonnées, les caractéristiques et le texte.
 *
 * Écrite en JavaScript simple : elle est envoyée telle quelle à Apify.
 */
/** Résultat d'une page de liste. */
export interface ListPage {
  kind: 'list'
  url: string
  found: number
  kept: number
  pageTitle?: string
  size?: number
  samples?: string[]
  /** Appels JSON relevés par le navigateur (Puppeteer Scraper seulement). */
  apis?: string[]
  /** Code HTTP de la page de liste (navigateur). */
  status?: number | null
  /** Annonces lues dans les réponses JSON du site plutôt que dans la page. */
  fromJson?: boolean
}

export const PAGE_FUNCTION = `async function pageFunction(context) {
  const { $, request, enqueueRequest, customData, log } = context;
  const base = request.loadedUrl || request.url;
  const abs = (href) => { try { return new URL(href, base).href.split('#')[0]; } catch (e) { return null; } };
  const fold = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  // Texte d'un bloc avec une espace entre chaque élément (.text() colle « Di2 » et « 3 200 € »).
  const textOf = (node) => (node.html() || '')
    .replace(/<(script|style)[\\s\\S]*?<\\/\\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&amp;/g, '&')
    .replace(/\\s+/g, ' ')
    .trim();

  if (!request.userData || request.userData.label !== 'DETAIL') {
    const pattern = new RegExp(customData.linkPattern);
    const prefilter = customData.prefilter ? new RegExp(customData.prefilter) : null;
    const cards = new Map();
    $('a[href]').each((_, a) => {
      const url = abs($(a).attr('href'));
      if (!url || !pattern.test(new URL(url).pathname)) return;
      // Texte de la vignette : on remonte jusqu'au bloc qui contient le prix.
      let node = $(a);
      let text = textOf(node);
      for (let i = 0; i < 5 && !/\\d\\s?€/.test(text); i++) { node = node.parent(); text = textOf(node); }
      text = text.slice(0, 600);
      if (!cards.has(url) || cards.get(url).length < text.length) cards.set(url, text);
    });
    let kept = Array.from(cards.entries()).filter(([, text]) => {
      const t = fold(text);
      if (prefilter && !prefilter.test(t)) return false;
      const m = t.match(/(\\d{1,2}[\\s\\u202f.]?\\d{3})(?:[.,]\\d{2})?\\s?€/);
      const price = m ? Number(m[1].replace(/[\\s\\u202f.]/g, '')) : null;
      return price === null || (price >= customData.priceMin && price <= customData.priceMax);
    }).map(([url]) => url);
    kept = kept.slice(0, customData.maxListings);
    log.info(customData.label + ' : ' + cards.size + ' annonces sur la page, ' + kept.length + ' prometteuses ouvertes');
    for (const url of kept) await enqueueRequest({ url, userData: { label: 'DETAIL' } });
    // Diagnostic : titre de la page et premières vignettes lues, affichés dans le journal de GitHub.
    const samples = Array.from(cards.values()).slice(0, 3).map((t) => t.slice(0, 140));
    return { kind: 'list', url: base, found: cards.size, kept: kept.length, pageTitle: $('title').first().text().trim().slice(0, 120), size: ($.html() || '').length, samples };
  }

  const meta = (name) => $('meta[property="' + name + '"]').attr('content') || $('meta[name="' + name + '"]').attr('content') || '';
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, s) => { try { jsonLd.push(JSON.parse($(s).contents().text())); } catch (e) {} });
  const attributes = {};
  $('dt').each((_, dt) => { const dd = $(dt).next('dd'); if (dd.length) attributes[$(dt).text().trim()] = dd.text().trim(); });
  $('tr').each((_, tr) => { const cells = $(tr).children('th,td'); if (cells.length === 2) attributes[$(cells[0]).text().trim()] = $(cells[1]).text().trim(); });
  const images = [];
  $('img').each((_, img) => {
    const src = abs($(img).attr('data-src') || $(img).attr('src') || '');
    if (src && /^https?:/.test(src) && !/logo|icon|avatar|sprite|flag|\\.svg/i.test(src) && !images.includes(src)) images.push(src);
  });
  return {
    kind: 'ad',
    url: base,
    title: $('h1').first().text().trim(),
    ogTitle: meta('og:title'),
    description: meta('og:description') || meta('description'),
    image: meta('og:image'),
    images: images.slice(0, 6),
    jsonLd,
    attributes,
    text: ($('main').text() || $('body').text()).replace(/\\s+/g, ' ').trim().slice(0, 8000),
  };
}`
