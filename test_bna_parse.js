import { JSDOM } from "jsdom";

async function scrape() {
  const html = `
    <h2>Gratis por 9 meses - 100% online</h2>
    Si cobrás en BNA, extendemos tu bonificación.
    <h2>YPF</h2>
    20% de descuento
    <h2>TIENDA BNA+</h2>
    Hasta 18 cuotas sin interés
  `;
  const doc = new JSDOM(html).window.document;
  
  const allH2 = doc.querySelectorAll('h2');
  allH2.forEach((h2, i) => {
      const text = h2.textContent.trim();
      let desc = '';
      if (h2.nextSibling && h2.nextSibling.nodeType === 3) {
          desc = h2.nextSibling.textContent.trim();
      } else if (h2.nextElementSibling) {
          desc = h2.nextElementSibling.textContent.trim();
      }
      console.log(`title: ${text}, desc: ${desc}`);
  });
}

scrape();
