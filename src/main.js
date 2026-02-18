import './style.css';
import defaultData from './data/promotions.json';
import { fetchBNAPromotions, fetchBERSAPromotions } from './services/scraper.js';

// ---- State ----
const state = {
    currentBank: 'bna',
    selectedCard: 'Todas',
    selectedCategory: 'Todos',
    selectedDay: 'Todos',
    data: loadData(),
    isLoading: false
};

// ---- Days of week ----
const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_ABBREVIATIONS = {
    'Lunes': 'LUN',
    'Martes': 'MAR',
    'Miércoles': 'MIÉ',
    'Jueves': 'JUE',
    'Viernes': 'VIE',
    'Sábado': 'SÁB',
    'Domingo': 'DOM'
};

// ---- Data persistence ----
function loadData() {
    try {
        const saved = localStorage.getItem('appahorro_data');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.bna && parsed.bersa && parsed.galicia) return parsed;
        }
    } catch (e) {
        console.warn('Error loading saved data:', e);
    }
    return JSON.parse(JSON.stringify(defaultData));
}

function saveData() {
    try {
        localStorage.setItem('appahorro_data', JSON.stringify(state.data));
    } catch (e) {
        console.warn('Error saving data:', e);
    }
}

// ---- DOM References ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const bankTabs = $$('.bank-tab');
const cardSelect = $('#card-select');
const categoryChipsContainer = $('#category-chips');
const dayChipsContainer = $('#day-chips');
const btnClearCategory = $('#btn-clear-category');
const btnClearDay = $('#btn-clear-day');
const promotionsList = $('#promotions-list');
const btnRefresh = $('#btn-refresh');
const statusText = $('#status-text');
const promoCount = $('#promo-count');
const loadingOverlay = $('#loading-overlay');
const toastEl = $('#toast');

// ---- Category icons ----
const CATEGORY_ICONS = {
    'Combustible': '⛽',
    'Supermercado': '🛒',
    'Indumentaria': '👕',
    'Farmacia': '💊',
    'Librería': '📚',
    'Entretenimiento': '🎬',
    'Tecnología': '💻',
    'Gastronomía': '🍔',
    'Viajes': '✈️',
    'Otros': '📌'
};

const CATEGORY_CLASSES = {
    'Combustible': 'cat-combustible',
    'Supermercado': 'cat-supermercado',
    'Indumentaria': 'cat-indumentaria',
    'Farmacia': 'cat-farmacia',
    'Librería': 'cat-libreria',
    'Entretenimiento': 'cat-entretenimiento',
    'Tecnología': 'cat-tecnologia',
    'Gastronomía': 'cat-gastronomia',
    'Viajes': 'cat-viajes',
    'Otros': 'cat-otros'
};

// ---- Initialize ----
function init() {
    // Bank tab listeners
    bankTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const bank = tab.dataset.bank;
            if (bank !== state.currentBank) {
                state.currentBank = bank;
                state.selectedCard = 'Todas';
                state.selectedCategory = 'Todos';
                state.selectedDay = 'Todos';
                updateAccentColors();
                updateBankTabs();
                renderCardSelect();
                renderCategoryChips();
                renderDayChips();
                renderPromotions();
            }
        });
    });

    // Card select dropdown
    cardSelect.addEventListener('change', (e) => {
        state.selectedCard = e.target.value;
        renderPromotions();
    });

    // Refresh button
    btnRefresh.addEventListener('click', handleRefresh);

    // Clear filters
    btnClearCategory.addEventListener('click', () => {
        state.selectedCategory = 'Todos';
        renderCategoryChips();
        renderPromotions();
    });

    btnClearDay.addEventListener('click', () => {
        state.selectedDay = 'Todos';
        renderDayChips();
        renderPromotions();
    });

    // Initial render
    updateAccentColors();
    renderCardSelect();
    renderCategoryChips();
    renderDayChips();
    renderPromotions();
}

// ---- Update accent colors based on selected bank ----
function updateAccentColors() {
    const root = document.documentElement;
    const colors = {
        bna: ['var(--accent-bna)', 'var(--accent-bna-glow)'],
        bersa: ['var(--accent-bersa)', 'var(--accent-bersa-glow)'],
        galicia: ['var(--accent-galicia)', 'var(--accent-galicia-glow)']
    };
    const [active, glow] = colors[state.currentBank] || colors.bna;
    root.style.setProperty('--accent-active', active);
    root.style.setProperty('--accent-glow', glow);
}

// ---- Update bank tabs ----
function updateBankTabs() {
    bankTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.bank === state.currentBank);
    });
}

// ---- Render card select dropdown ----
function renderCardSelect() {
    const bankData = state.data[state.currentBank];
    const cards = bankData?.tarjetas || ['Todas'];

    cardSelect.innerHTML = '';
    cards.forEach(card => {
        const option = document.createElement('option');
        option.value = card;
        option.textContent = card;
        option.selected = card === state.selectedCard;
        cardSelect.appendChild(option);
    });
}

// ---- Get categories sorted by max discount ----
function getCategoriesSortedByDiscount() {
    const bankData = state.data[state.currentBank];
    if (!bankData?.promotions) return [];

    // Group promotions by category and find max discount per category
    const catMap = {};
    bankData.promotions.forEach(p => {
        const cat = p.categoria || 'Otros';
        const disc = p.descuento || 0;
        if (!catMap[cat]) {
            catMap[cat] = { maxDiscount: disc, count: 1 };
        } else {
            catMap[cat].maxDiscount = Math.max(catMap[cat].maxDiscount, disc);
            catMap[cat].count++;
        }
    });

    // Sort categories: highest max discount first
    return Object.entries(catMap)
        .sort((a, b) => b[1].maxDiscount - a[1].maxDiscount)
        .map(([cat, info]) => ({
            name: cat,
            maxDiscount: info.maxDiscount,
            count: info.count
        }));
}

// ---- Render category filter chips ----
function renderCategoryChips() {
    const categories = getCategoriesSortedByDiscount();

    categoryChipsContainer.innerHTML = '';

    // "Todos" chip
    const allChip = document.createElement('button');
    allChip.className = `card-chip ${state.selectedCategory === 'Todos' ? 'active' : ''}`;
    allChip.textContent = 'Todos';
    allChip.addEventListener('click', () => {
        state.selectedCategory = 'Todos';
        renderCategoryChips();
        renderPromotions();
    });
    categoryChipsContainer.appendChild(allChip);

    // Category chips sorted by discount
    categories.forEach(cat => {
        const chip = document.createElement('button');
        const isActive = cat.name === state.selectedCategory;
        chip.className = `card-chip category-chip ${isActive ? 'active' : ''}`;

        const icon = CATEGORY_ICONS[cat.name] || '📌';
        const discountLabel = cat.maxDiscount > 0 ? ` ${cat.maxDiscount}%` : '';
        chip.innerHTML = `${icon} ${cat.name}<span class="chip-discount">${discountLabel}</span>`;

        chip.addEventListener('click', () => {
            state.selectedCategory = cat.name;
            renderCategoryChips();
            renderPromotions();
        });
        categoryChipsContainer.appendChild(chip);
    });

    btnClearCategory.style.display = state.selectedCategory !== 'Todos' ? 'block' : 'none';
}

// ---- Render day of week chips ----
function renderDayChips() {
    dayChipsContainer.innerHTML = '';

    // "Todos" chip
    const allChip = document.createElement('button');
    allChip.className = `day-chip ${state.selectedDay === 'Todos' ? 'active' : ''}`;
    allChip.innerHTML = `<span class="day-short">HOY</span>`;
    allChip.addEventListener('click', () => {
        // Toggle: if already "Todos", set to today's day
        const todayIndex = new Date().getDay();
        // JS: 0=Sun, 1=Mon... → convert
        const todayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][todayIndex];
        if (state.selectedDay === 'Todos') {
            state.selectedDay = todayName;
        } else {
            state.selectedDay = 'Todos';
        }
        renderDayChips();
        renderPromotions();
    });
    dayChipsContainer.appendChild(allChip);

    // Day chips
    DAYS_OF_WEEK.forEach(day => {
        const chip = document.createElement('button');
        const isActive = day === state.selectedDay;
        const isToday = isTodayDay(day);
        chip.className = `day-chip ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`;
        chip.innerHTML = `<span class="day-short">${DAY_ABBREVIATIONS[day]}</span>`;
        chip.addEventListener('click', () => {
            state.selectedDay = state.selectedDay === day ? 'Todos' : day;
            renderDayChips();
            renderPromotions();
        });
        dayChipsContainer.appendChild(chip);
    });

    btnClearDay.style.display = state.selectedDay !== 'Todos' ? 'block' : 'none';
}

// ---- Check if a day name matches today ----
function isTodayDay(dayName) {
    const todayIndex = new Date().getDay();
    const todayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][todayIndex];
    return dayName === todayName;
}

// ---- Filter promotions ----
function getFilteredPromotions() {
    const bankData = state.data[state.currentBank];
    if (!bankData?.promotions) return [];

    let promos = bankData.promotions;

    // Filter by card
    if (state.selectedCard !== 'Todas') {
        promos = promos.filter(p => {
            if (p.tarjetas.includes('todas')) return true;
            return p.tarjetas.some(t =>
                t.toLowerCase().includes(state.selectedCard.toLowerCase())
            );
        });
    }

    // Filter by category
    if (state.selectedCategory !== 'Todos') {
        promos = promos.filter(p => p.categoria === state.selectedCategory);
    }

    // Filter by day
    if (state.selectedDay !== 'Todos') {
        promos = promos.filter(p => {
            if (!p.dias || p.dias.length === 0) return true; // no day restriction
            if (p.dias.length === 7) return true; // every day
            return p.dias.includes(state.selectedDay);
        });
    }

    // Sort by discount (highest first)
    promos = [...promos].sort((a, b) => (b.descuento || 0) - (a.descuento || 0));

    return promos;
}

// ---- Render promotions ----
function renderPromotions() {
    const promos = getFilteredPromotions();
    const bankData = state.data[state.currentBank];
    const bankNames = { bna: 'Banco Nación', bersa: 'Banco Entre Ríos', galicia: 'Banco Galicia' };
    const bankName = bankNames[state.currentBank] || state.currentBank;

    // Status bar
    statusText.textContent = `${bankName} · Actualizado: ${bankData?.lastUpdated || '—'}`;
    promoCount.textContent = `${promos.length} promo${promos.length !== 1 ? 's' : ''}`;

    if (promos.length === 0) {
        const activeFilters = [];
        if (state.selectedCard !== 'Todas') activeFilters.push(`tarjeta: ${state.selectedCard}`);
        if (state.selectedCategory !== 'Todos') activeFilters.push(`rubro: ${state.selectedCategory}`);
        if (state.selectedDay !== 'Todos') activeFilters.push(`día: ${state.selectedDay}`);

        promotionsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">Sin promociones</div>
        <div class="empty-state-desc">No se encontraron promociones con los filtros seleccionados${activeFilters.length ? ':<br><strong>' + activeFilters.join(' · ') + '</strong>' : ''}.<br>Probá cambiando los filtros o presioná "Limpiar".</div>
      </div>
    `;
        return;
    }

    promotionsList.innerHTML = promos.map(p => renderPromoCard(p)).join('');
}

// ---- Render a single promo card ----
function renderPromoCard(promo) {
    const catClass = CATEGORY_CLASSES[promo.categoria] || 'cat-otros';
    const catIcon = CATEGORY_ICONS[promo.categoria] || '📌';

    // Highlight discount percentages in description
    const descHtml = promo.descripcion.replace(
        /(\d+%)/g,
        '<strong class="promo-discount-highlight">$1</strong>'
    );

    const tarjetasTags = promo.tarjetas.includes('todas')
        ? '<span class="promo-tarjeta-tag">Todas las tarjetas</span>'
        : promo.tarjetas.map(t => `<span class="promo-tarjeta-tag">${t}</span>`).join('');

    // Build day badges
    let diasHtml = '';
    if (promo.dias && promo.dias.length > 0 && promo.dias.length < 7) {
        diasHtml = `<div class="promo-dias">
            <span class="promo-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </span>
            ${promo.dias.map(d => {
            const isToday = isTodayDay(d);
            return `<span class="promo-dia-tag ${isToday ? 'dia-today' : ''}">${DAY_ABBREVIATIONS[d] || d}</span>`;
        }).join('')}
        </div>`;
    }

    // Discount badge
    const discountBadge = promo.descuento && promo.descuento > 0
        ? `<span class="promo-discount-badge">${promo.descuento}% OFF</span>`
        : '';

    return `
    <article class="promo-card">
      <div class="promo-card-top">
        <h3 class="promo-comercio">${catIcon} ${promo.comercio}</h3>
        <div class="promo-badges">
          ${discountBadge}
          <span class="promo-category-badge ${catClass}">${promo.categoria}</span>
        </div>
      </div>
      <p class="promo-description">${descHtml}</p>
      ${promo.detalle ? `<p class="promo-description" style="font-size:0.8rem;opacity:0.7;">${promo.detalle}</p>` : ''}
      <div class="promo-meta">
        <span class="promo-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          ${promo.vigencia}
        </span>
      </div>
      ${diasHtml}
      <div class="promo-tarjetas">${tarjetasTags}</div>
    </article>
  `;
}

// ---- Handle refresh ----
async function handleRefresh() {
    if (state.isLoading) return;
    state.isLoading = true;

    btnRefresh.classList.add('spinning');
    loadingOverlay.classList.remove('hidden');

    const results = { bna: null, bersa: null, galicia: null };
    const errors = [];

    // Try fetching all banks in parallel
    try {
        const [bnaResult, bersaResult] = await Promise.allSettled([
            fetchBNAPromotions(),
            fetchBERSAPromotions()
        ]);

        if (bnaResult.status === 'fulfilled' && bnaResult.value.length > 0) {
            results.bna = bnaResult.value;
        } else {
            errors.push('BNA: ' + (bnaResult.reason?.message || 'Sin resultados'));
        }

        if (bersaResult.status === 'fulfilled' && bersaResult.value.length > 0) {
            results.bersa = bersaResult.value;
        } else {
            errors.push('BERSA: ' + (bersaResult.reason?.message || 'Sin resultados'));
        }
        // Galicia: uses pre-loaded data only (no scraper yet)
    } catch (e) {
        errors.push(e.message);
    }

    // Update data if we got results
    const now = new Date().toISOString().split('T')[0];
    if (results.bna) {
        state.data.bna.promotions = results.bna;
        state.data.bna.lastUpdated = now;
    }
    if (results.bersa) {
        state.data.bersa.promotions = results.bersa;
        state.data.bersa.lastUpdated = now;
    }

    if (results.bna || results.bersa) {
        saveData();
        renderCategoryChips();
        renderPromotions();
    }

    state.isLoading = false;
    btnRefresh.classList.remove('spinning');
    loadingOverlay.classList.add('hidden');

    // Show toast
    if (errors.length === 0) {
        showToast('✅ Promociones actualizadas correctamente', 'success');
    } else if (results.bna || results.bersa) {
        showToast('⚠️ Actualización parcial. ' + errors.join('. '), 'warning');
    } else {
        showToast('❌ No se pudo actualizar. Se mantienen los datos guardados. ' + errors.join('. '), 'error');
    }
}

// ---- Toast notification ----
function showToast(message, type = 'info') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type} visible`;
    setTimeout(() => {
        toastEl.classList.remove('visible');
        toastEl.classList.add('hidden');
    }, 4000);
}

// ---- PWA Service Worker Registration ----
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered');
        } catch (e) {
            console.log('Service Worker registration failed:', e);
        }
    });
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', init);
