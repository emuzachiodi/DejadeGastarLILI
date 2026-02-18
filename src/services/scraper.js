/**
 * Scraper service — fetches promotions from BNA and BERSA pages
 * Uses CORS proxy to bypass CORS restrictions from the browser
 */

const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url='
];

const BNA_URL = 'https://www.bna.com.ar/Personas/DescuentosYPromociones';
const BERSA_URL = 'https://www.bancoentrerios.com.ar/personas/beneficios';

/**
 * Try fetching a URL through multiple CORS proxies
 */
async function fetchWithProxy(url) {
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(url), {
        headers: { 'Accept': 'text/html' },
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        return await response.text();
      }
    } catch (e) {
      console.warn(`Proxy ${proxy} failed for ${url}:`, e.message);
      continue;
    }
  }
  throw new Error('No se pudo acceder a la página. Probá más tarde.');
}

/**
 * Parse BNA promotions from HTML
 */
function parseBNAPromotions(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const promos = [];

  // BNA uses divs/sections with promotion cards
  // Look for promo blocks
  const promoElements = doc.querySelectorAll('.promocion, .card-promocion, .slick-slide, [class*="promo"], [class*="beneficio"]');
  
  if (promoElements.length > 0) {
    promoElements.forEach((el, i) => {
      const title = el.querySelector('h2, h3, h4, .title, .comercio, strong')?.textContent?.trim();
      const desc = el.querySelector('p, .descripcion, .desc, .detalle')?.textContent?.trim();
      if (title && title.length > 1) {
        promos.push({
          id: i + 1,
          comercio: title,
          descripcion: desc || title,
          tarjetas: ['todas'],
          vigencia: 'Vigente',
          categoria: categorizeBNA(title),
          detalle: desc || ''
        });
      }
    });
  }

  // Also try parsing simple text blocks
  if (promos.length === 0) {
    const allH2 = doc.querySelectorAll('h2');
    allH2.forEach((h2, i) => {
      const text = h2.textContent.trim();
      if (text && text.length > 2 && text.length < 100 && !text.includes('Descuentos y Promociones')) {
        const nextP = h2.nextElementSibling;
        const desc = nextP?.textContent?.trim() || '';
        promos.push({
          id: i + 1,
          comercio: text,
          descripcion: desc || text,
          tarjetas: ['todas'],
          vigencia: 'Vigente',
          categoria: categorizeBNA(text),
          detalle: desc
        });
      }
    });
  }

  return promos;
}

/**
 * Parse BERSA promotions from HTML
 */
function parseBERSAPromotions(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const promos = [];

  // BERSA uses cards for promotions
  const promoElements = doc.querySelectorAll('.card, .promocion, [class*="beneficio"], [class*="promo"], .slick-slide');
  
  if (promoElements.length > 0) {
    promoElements.forEach((el, i) => {
      const title = el.querySelector('h2, h3, h4, .title, .nombre, strong')?.textContent?.trim();
      const desc = el.querySelector('p, .descripcion, .texto, .detalle')?.textContent?.trim();
      const vigencia = el.querySelector('.vigencia, .fecha, [class*="vigencia"]')?.textContent?.trim();
      if (title && title.length > 1) {
        promos.push({
          id: 100 + i + 1,
          comercio: title,
          descripcion: desc || title,
          tarjetas: ['todas'],
          vigencia: vigencia || 'Vigente',
          categoria: categorizeBERSA(title),
          detalle: desc || ''
        });
      }
    });
  }

  // Fallback: parse h3 headings
  if (promos.length === 0) {
    const allH3 = doc.querySelectorAll('h3');
    allH3.forEach((h3, i) => {
      const text = h3.textContent.trim();
      if (text && text.length > 2 && text.length < 100) {
        promos.push({
          id: 100 + i + 1,
          comercio: text,
          descripcion: text,
          tarjetas: ['todas'],
          vigencia: 'Vigente',
          categoria: categorizeBERSA(text),
          detalle: ''
        });
      }
    });
  }

  return promos;
}

/**
 * Categorize BNA promotions by commerce name
 */
function categorizeBNA(name) {
  const n = name.toLowerCase();
  if (n.includes('shell') || n.includes('ypf') || n.includes('axion')) return 'Combustible';
  if (n.includes('coto') || n.includes('vital') || n.includes('carrefour') || n.includes('disco') || n.includes('jumbo')) return 'Supermercado';
  if (n.includes('grimoldi') || n.includes('montagne') || n.includes('ropa') || n.includes('city')) return 'Indumentaria';
  if (n.includes('farmaplus') || n.includes('parfum') || n.includes('farma')) return 'Farmacia';
  if (n.includes('yenny') || n.includes('cuspide') || n.includes('libr')) return 'Librería';
  if (n.includes('juguete') || n.includes('cine') || n.includes('teatro')) return 'Entretenimiento';
  if (n.includes('tienda') || n.includes('tech') || n.includes('electro')) return 'Tecnología';
  if (n.includes('mcdonald') || n.includes('burger') || n.includes('gastro') || n.includes('restaur')) return 'Gastronomía';
  return 'Otros';
}

/**
 * Categorize BERSA promotions by commerce name
 */
function categorizeBERSA(name) {
  const n = name.toLowerCase();
  if (n.includes('mcdonald') || n.includes('burger') || n.includes('gastro') || n.includes('restaur')) return 'Gastronomía';
  if (n.includes('aerolínea') || n.includes('aerolinea') || n.includes('vuelo') || n.includes('viaj') || n.includes('transporte') || n.includes('modo')) return 'Viajes';
  if (n.includes('super') || n.includes('mayorista')) return 'Supermercado';
  if (n.includes('cine') || n.includes('carnaval') || n.includes('festival') || n.includes('experiencia') || n.includes('recital')) return 'Entretenimiento';
  if (n.includes('city') || n.includes('ropa') || n.includes('indumentaria')) return 'Indumentaria';
  if (n.includes('shell') || n.includes('ypf') || n.includes('combust')) return 'Combustible';
  if (n.includes('farma') || n.includes('parfum')) return 'Farmacia';
  return 'Otros';
}

/**
 * Fetch and parse BNA promotions
 */
export async function fetchBNAPromotions() {
  const html = await fetchWithProxy(BNA_URL);
  const promos = parseBNAPromotions(html);
  if (promos.length === 0) {
    throw new Error('No se pudieron extraer promociones de BNA. Es posible que la página haya cambiado de formato.');
  }
  return promos;
}

/**
 * Fetch and parse BERSA promotions
 */
export async function fetchBERSAPromotions() {
  const html = await fetchWithProxy(BERSA_URL);
  const promos = parseBERSAPromotions(html);
  if (promos.length === 0) {
    throw new Error('No se pudieron extraer promociones de BERSA. Es posible que la página haya cambiado de formato.');
  }
  return promos;
}
