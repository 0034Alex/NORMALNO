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
  results.flat().forEach(item => {
    if (item.MakeName) namesSet.add(item.MakeName.trim());
  });

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
