const UA_REGIONS = [
  "Вінницька область","Волинська область","Дніпропетровська область","Донецька область",
  "Житомирська область","Закарпатська область","Запорізька область","Івано-Франківська область",
  "Київська область","м. Київ","Кіровоградська область","Луганська область","Львівська область",
  "Миколаївська область","Одеська область","Полтавська область","Рівненська область",
  "Сумська область","Тернопільська область","Харківська область","Херсонська область",
  "Хмельницька область","Черкаська область","Чернівецька область","Чернігівська область","АР Крим"
];

const BODY_TYPES_BY_TRANSPORT = {
  car: ["Седан","Хетчбек","Купе","Позашляховик / SUV","Універсал","Мінівен","Пікап","Кабріолет","Лімузин"],
  moto: ["Спортбайк","Круізер","Чоппер","Ендуро","Скутер","Класичний мотоцикл","Квадроцикл","Мотоцикл турер"],
  truck: ["Бортовий","Тентований","Рефрижератор","Самоскид","Тягач","Фургон","Автовоз","Цистерна"],
  trailer: ["Бортовий причіп","Тентований причіп","Рефрижератор","Низькорамний","Причіп-цистерна"],
  special: ["Екскаватор","Кран","Бульдозер","Навантажувач","Грейдер","Каток","Екскаватор-навантажувач"],
  agro: ["Трактор","Комбайн","Сівалка","Обприскувач","Причіп сільгосп","Прес-підбирач"],
  bus: ["Міський","Міжміський","Мікроавтобус","Шкільний","Туристичний"],
  water: ["Катер","Яхта","Гідроцикл","Катамаран","Човен","Вітрильник"],
  air: ["Літак","Вертоліт","Планер","Дирижабль"],
  motorhome: ["Інтегрований","Напівінтегрований","На базі фургона","Причіп-дача"]
};

/* ---------- Марки/моделі (NHTSA vPIC API) ---------- */

let _brandsCache = null;

async function fetchAllBrands() {
  if (_brandsCache) return _brandsCache;
  const types = ["car", "multipurpose passenger vehicle (mpv)", "truck"];
  const results = await Promise.all(types.map(t =>
    fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/${encodeURIComponent(t)}?format=json`)
      .then(r => r.json())
      .then(d => d.Results || [])
      .catch(() => [])
  ));
  const namesSet = new Set();
  results.flat().forEach(item => { if (item.MakeName) namesSet.add(item.MakeName.trim()); });
  _brandsCache = Array.from(namesSet).sort((a, b) => a.localeCompare(b));
  return _brandsCache;
}

async function fetchModelsForBrand(brand) {
  try {
    const resp = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(brand)}?format=json`);
    const data = await resp.json();
    const names = (data.Results || []).map(m => m.Model_Name).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  } catch (e) {
    return [];
  }
}

async function populateBrandSelect(selectEl) {
  selectEl.innerHTML = '<option value="">Завантаження марок...</option>';
  selectEl.disabled = true;
  const brands = await fetchAllBrands();
  selectEl.innerHTML = '<option value="">Марка — оберіть</option>' +
    brands.map(b => `<option value="${b}">${b}</option>`).join('');
  selectEl.disabled = false;
}

async function populateModelSelect(selectEl, brand, placeholder) {
  if (!brand) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    selectEl.disabled = true;
    return;
  }
  selectEl.innerHTML = '<option value="">Завантаження моделей...</option>';
  selectEl.disabled = true;
  const models = await fetchModelsForBrand(brand);
  selectEl.innerHTML = `<option value="">${placeholder}</option>` +
    models.map(m => `<option value="${m}">${m}</option>`).join('');
  selectEl.disabled = models.length === 0;
}

function populateRegionSelect(selectEl, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>` +
    UA_REGIONS.map(r => `<option value="${r}">${r}</option>`).join('');
}

function populateBodyTypeSelect(selectEl, transportType, placeholder) {
  if (!transportType) {
    selectEl.innerHTML = '<option value="">Спочатку оберіть тип транспорту</option>';
    selectEl.disabled = true;
    return;
  }
  const types = BODY_TYPES_BY_TRANSPORT[transportType] || [];
  selectEl.innerHTML = `<option value="">${placeholder}</option>` +
    types.map(t => `<option value="${t}">${t}</option>`).join('');
  selectEl.disabled = types.length === 0;
}

/* ---------- Багатомовний пошук (укр/рос/англ, нечіткий) ---------- */

const CYR_TO_LAT = {
  'а':'a','б':'b','в':'v','г':'g','ґ':'g','д':'d','е':'e','є':'ie','ж':'zh','з':'z',
  'и':'y','і':'i','ї':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p',
  'р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'shch',
  'ь':'','ъ':'','ы':'y','э':'e','ю':'iu','я':'ia'
};

const BRAND_ALIASES = {
  "BMW": ["бмв"], "MERCEDES-BENZ": ["мерседес","мерс"], "VOLKSWAGEN": ["фольксваген","вольксваген","vw"],
  "HYUNDAI": ["хюндай","хендай","хундай"], "KIA": ["киа","кіа"], "SKODA": ["шкода"], "RENAULT": ["рено"],
  "NISSAN": ["ниссан","нісан"], "CHEVROLET": ["шевроле"], "HONDA": ["хонда"], "MAZDA": ["мазда"],
  "OPEL": ["опель"], "PEUGEOT": ["пежо"], "MITSUBISHI": ["мітсубісі","митсубиси"], "VOLVO": ["вольво"],
  "LEXUS": ["лексус"], "SUBARU": ["субару"], "SUZUKI": ["сузукі","сузуки"], "FIAT": ["фіат","фиат"],
  "CITROEN": ["сітроен","ситроен"], "LAND ROVER": ["ленд ровер","лендровер"], "PORSCHE": ["порше"],
  "JEEP": ["джип"], "TOYOTA": ["тойота","тайота"], "FORD": ["форд"], "AUDI": ["ауді","ауди"],
  "CHRYSLER": ["крайслер"], "CADILLAC": ["кадилак","кадиллак"], "DODGE": ["додж"], "JAGUAR": ["ягуар","джагуар"],
  "MASERATI": ["мазераті","мазерати"], "BENTLEY": ["бентлі","бентли"], "TESLA": ["тесла"],
  "MINI": ["міні","мини"], "ACURA": ["акура"], "INFINITI": ["інфініті","инфинити"], "DACIA": ["дачія","дачия"]
};

function transliterate(text) {
  return text.toLowerCase().split('').map(ch => CYR_TO_LAT[ch] !== undefined ? CYR_TO_LAT[ch] : ch).join('');
}

function normalizeSearch(text) {
  return (text || '').toLowerCase().replace(/[\s\-]/g, '');
}

function matchesQuery(fieldValue, query) {
  if (!query) return true;
  if (!fieldValue) return false;
  const qNorm = normalizeSearch(query);
  const fNorm = normalizeSearch(fieldValue);
  if (fNorm.includes(qNorm)) return true;
  const qTranslit = normalizeSearch(transliterate(query));
  if (fNorm.includes(qTranslit)) return true;
  const aliasKey = Object.keys(BRAND_ALIASES).find(k => k === fieldValue.toUpperCase());
  if (aliasKey) {
    const hit = BRAND_ALIASES[aliasKey].some(alias => normalizeSearch(alias).includes(qNorm));
    if (hit) return true;
  }
  return false;
}

async function suggestBrands(query, limit) {
  const brands = await fetchAllBrands();
  if (!query) return brands.slice(0, limit || 15);
  return brands.filter(b => matchesQuery(b, query)).slice(0, limit || 15);
}

/* ---------- Статуси клієнта ---------- */

const STATUS_TIERS = [
  { min: 0,  max: 2,  name: 'Новачок',            freeQuota: 3,  extraPrice: 5 },
  { min: 3,  max: 4,  name: 'Активний продавець',  freeQuota: 4,  extraPrice: 4 },
  { min: 5,  max: 9,  name: 'Авто-бізнесмен',      freeQuota: 6,  extraPrice: 3 },
  { min: 10, max: 19, name: 'Про-дилер',           freeQuota: 10, extraPrice: 2 },
  { min: 20, max: Infinity, name: 'Автосалон',     freeQuota: null, extraPrice: null }
];

function getStatusForCount(soldCount) {
  const n = soldCount || 0;
  return STATUS_TIERS.find(t => n >= t.min && n <= t.max) || STATUS_TIERS[0];
}

/* ---------- Картка авто ---------- */

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'щойно';
  if (mins < 60) return mins + ' хв тому';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' год тому';
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчора';
  return days + ' дн тому';
}

const TRANSMISSION_LABELS = { manual: 'Механіка', automatic: 'Автомат', variator: 'Варіатор' };
const FUEL_LABELS = { petrol: 'Бензин', diesel: 'Дизель', hybrid: 'Гібрид', gas: 'Газ', electric: 'Електро' };
const CONDITION_LABELS = { new: 'Нове', used: 'Б/у', imported: 'Пригон' };

function carPhotos(car, limit) {
  const arr = (car.photos && car.photos.length) ? car.photos : (car.photo_url ? [car.photo_url] : []);
  return limit ? arr.slice(0, limit) : arr;
}

function renderCarCard(car, currentUserId, favoritedIds) {
  const transmission = TRANSMISSION_LABELS[car.transmission] || '';
  const fuel = FUEL_LABELS[car.fuel_type] || '';
  const condition = CONDITION_LABELS[car.condition] || '';

  const badges = [];
  if (condition) badges.push(condition);
  if (car.exchange_possible) badges.push('Можливий обмін');
  if (car.customs_cleared) badges.push('Розмитнено');
  if (car.sold) badges.push('Продано');

  const isFav = favoritedIds && favoritedIds.has(car.id);
  const heartChar = isFav ? '❤️' : '♡';
  const photos = carPhotos(car, 4);

  const photoHtml = photos.length
    ? `<div class="ncard-photo-scroll">${photos.map(p => `<img src="${p}" onerror="this.style.display='none'">`).join('')}</div>` +
      (photos.length > 1 ? `<div class="ncard-dots">${photos.map(() => '<span></span>').join('')}</div>` : '')
    : `<div class="ncard-noimg">🚗</div>`;

  return `
    <div class="ncard ${car.sold ? 'ncard-sold' : ''}" onclick="window.location.href='car.html?id=${car.id}'">
      <div class="ncard-photo">
        ${photoHtml}
        <div class="ncard-watermark">NORMALNO</div>
        <div class="ncard-heart" onclick="event.stopPropagation(); if(window.toggleFavorite) window.toggleFavorite(${car.id})">${heartChar}</div>
      </div>
      <div class="ncard-body">
        <div class="ncard-title">${car.brand} ${car.model}, ${car.year}</div>
        <div class="ncard-subtitle">${[fuel, car.engine_volume ? car.engine_volume + ' л' : '', transmission].filter(Boolean).join(' · ')}</div>
        <div class="ncard-price">${Number(car.price).toLocaleString('uk-UA')} ${car.currency || ''}${(() => { const uah = convertToUAH(car.price, car.currency); return uah ? ` <span class="ncard-price-uah">(≈ ${uah.toLocaleString('uk-UA')} грн)</span>` : ''; })()}</div>
        <div class="ncard-specs">
          <span>🛣️ ${car.mileage ? Number(car.mileage).toLocaleString('uk-UA') + ' км' : '—'}</span>
          <span>⚙️ ${transmission || '—'}</span>
          <span>⛽ ${fuel || '—'}</span>
          <span>📍 ${car.region || '—'}</span>
        </div>
        ${badges.length ? `<div class="ncard-badges">${badges.map(b => `<span class="ncard-badge">${b}</span>`).join('')}</div>` : ''}
        <div class="ncard-time">🕐 ${timeAgo(car.created_at)}</div>
      </div>
    </div>
  `;
}

/* ---------- Курс валют (НБУ) ---------- */

let _exchangeRates = null;
let _exchangeRatesPromise = null;

async function ensureRatesLoaded() {
  if (_exchangeRates) return _exchangeRates;
  if (_exchangeRatesPromise) return _exchangeRatesPromise;

  _exchangeRatesPromise = fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json')
    .then(r => r.json())
    .then(list => {
      const map = { UAH: 1 };
      (list || []).forEach(item => {
        if (item.cc === 'USD' || item.cc === 'EUR') map[item.cc] = item.rate;
      });
      _exchangeRates = map;
      return map;
    })
    .catch(() => {
      _exchangeRates = { UAH: 1 };
      return _exchangeRates;
    });

  return _exchangeRatesPromise;
}

function convertToUAH(amount, currency) {
  if (!_exchangeRates || !amount) return null;
  if (currency === 'UAH') return null;
  const rate = _exchangeRates[currency];
  if (!rate) return null;
  return Math.round(amount * rate);
}

/* ---------- Калькулятор лізингу ---------- */

const LEASING_DOWN_PAYMENT_PCT = 0.25;
const LEASING_ANNUAL_RATE_PCT = 0.36;

function calcLeasing(priceUAH, months) {
  const downPayment = Math.round(priceUAH * LEASING_DOWN_PAYMENT_PCT);
  const financed = priceUAH - downPayment;
  const monthlyRate = LEASING_ANNUAL_RATE_PCT / 12;
  const factor = Math.pow(1 + monthlyRate, months);
  const monthlyPayment = Math.round(financed * monthlyRate * factor / (factor - 1));
  const totalPayment = downPayment + monthlyPayment * months;

  return { downPayment, monthlyPayment, totalPayment, financed };
}

/* ---------- Telegram Mini App: повноекранний режим ---------- */
(function initTelegramFullscreen() {
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    try { tg.expand(); } catch (e) {}

    if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7') && tg.disableVerticalSwipes) {
      try { tg.disableVerticalSwipes(); } catch (e) {}
    }

    function applyTgSafeArea() {
      const inset = tg.contentSafeAreaInset || tg.safeAreaInset || {};
      document.body.style.paddingTop = (inset.top || 0) + 'px';
    }
    if (tg.onEvent) {
      try {
        tg.onEvent('contentSafeAreaChanged', applyTgSafeArea);
        tg.onEvent('safeAreaChanged', applyTgSafeArea);
        tg.onEvent('fullscreenChanged', applyTgSafeArea);
      } catch (e) {}
    }

    if (tg.isVersionAtLeast && tg.isVersionAtLeast('8.0') && tg.requestFullscreen) {
      try { tg.requestFullscreen(); } catch (e) {}
    }
    applyTgSafeArea();
    setTimeout(applyTgSafeArea, 300);
  }
})();
