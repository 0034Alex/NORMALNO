const CAR_BRANDS = {
  "Toyota": ["Camry","Corolla","RAV4","Land Cruiser","Prius","Yaris","Highlander","C-HR","Avalon","Sienna"],
  "BMW": ["1 Series","3 Series","5 Series","7 Series","X1","X3","X5","X6","X7"],
  "Mercedes-Benz": ["A-Class","C-Class","E-Class","S-Class","CLA","GLA","GLC","GLE","G-Class"],
  "Volkswagen": ["Golf","Passat","Polo","Jetta","Tiguan","Touareg","Arteon","Caddy"],
  "Audi": ["A3","A4","A6","A8","Q3","Q5","Q7","Q8"],
  "Ford": ["Fiesta","Focus","Mondeo","Kuga","Explorer","Escape","Fusion","EcoSport"],
  "Hyundai": ["Accent","Elantra","Sonata","Tucson","Santa Fe","i30","Kona","Creta"],
  "Kia": ["Rio","Cerato","Optima","Sportage","Sorento","Picanto","Soul","Stinger"],
  "Skoda": ["Fabia","Octavia","Superb","Rapid","Kodiaq","Karoq"],
  "Renault": ["Logan","Sandero","Duster","Megane","Clio","Kadjar","Talisman"],
  "Nissan": ["Micra","Almera","Qashqai","X-Trail","Juke","Leaf","Murano"],
  "Chevrolet": ["Aveo","Lacetti","Cruze","Captiva","Niva","Tahoe"],
  "Honda": ["Civic","Accord","CR-V","Pilot","Fit","HR-V"],
  "Mazda": ["Mazda2","Mazda3","Mazda6","CX-3","CX-5","CX-9"],
  "Opel": ["Corsa","Astra","Insignia","Zafira","Vectra","Mokka"],
  "Peugeot": ["208","308","408","3008","5008"],
  "Mitsubishi": ["Lancer","Outlander","ASX","Pajero","Eclipse Cross"],
  "Volvo": ["S60","S90","V40","V60","XC40","XC60","XC90"],
  "Lexus": ["ES","IS","RX","NX","GX","LX","LS"],
  "Subaru": ["Impreza","Forester","Outback","XV","Legacy"],
  "Suzuki": ["Swift","SX4","Vitara","Jimny"],
  "Fiat": ["500","Punto","Tipo","Doblo"],
  "Citroen": ["C3","C4","C5","Berlingo"],
  "Land Rover": ["Range Rover","Range Rover Sport","Range Rover Evoque","Discovery","Defender"],
  "Porsche": ["911","Cayenne","Macan","Panamera","Taycan"],
  "Jeep": ["Cherokee","Grand Cherokee","Compass","Wrangler","Renegade"],
  "Dacia": ["Duster","Logan","Sandero"],
  "Daewoo": ["Lanos","Sens","Nexia","Matiz"],
  "ВАЗ (Lada)": ["2107","2109","2110","Priora","Vesta","Granta","Niva"],
  "Infiniti": ["Q50","Q60","QX50","QX60","QX80"],
  "Jaguar": ["XE","XF","F-Pace","E-Pace"],
  "Tesla": ["Model 3","Model S","Model X","Model Y"]
};

const UA_REGIONS = [
  "Вінницька область","Волинська область","Дніпропетровська область","Донецька область",
  "Житомирська область","Закарпатська область","Запорізька область","Івано-Франківська область",
  "Київська область","м. Київ","Кіровоградська область","Луганська область","Львівська область",
  "Миколаївська область","Одеська область","Полтавська область","Рівненська область",
  "Сумська область","Тернопільська область","Харківська область","Херсонська область",
  "Хмельницька область","Черкаська область","Чернівецька область","Чернігівська область","АР Крим"
];

function populateBrandSelect(selectEl) {
  selectEl.innerHTML = '<option value="">Марка — оберіть</option>' +
    Object.keys(CAR_BRANDS).map(b => `<option value="${b}">${b}</option>`).join('');
}

function populateModelSelect(selectEl, brand, placeholder) {
  const models = CAR_BRANDS[brand] || [];
  selectEl.innerHTML = `<option value="">${placeholder}</option>` +
    models.map(m => `<option value="${m}">${m}</option>`).join('');
  selectEl.disabled = models.length === 0;
}

function populateRegionSelect(selectEl, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>` +
    UA_REGIONS.map(r => `<option value="${r}">${r}</option>`).join('');
}
