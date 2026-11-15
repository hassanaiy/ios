import { Place, Coordinates } from '../types';
import { Language } from '../contexts/LanguageContext';

interface BilingualPlace {
  id: string;
  coords: { lat: number; lng: number };
  name: { en: string; ar: string };
  address: { en: string; ar: string };
}

type ScoredPlace = Place & { _score?: number };

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    countrycode?: string;
    name?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_type?: string;
    osm_id?: string | number;
  };
}

interface NominatimItem {
  place_id?: string | number;
  display_name?: string;
  name?: string;
  lat: string;
  lon: string;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Comprehensive Egyptian Places Database (Qena, Upper Egypt, Cairo, Giza, Alexandria, Red Sea, etc.)
const EGYPT_PLACES_RAW: BilingualPlace[] = [
  // Qena Governorate
  { id: 'q1', name: { en: 'Dendera Temple', ar: 'معبد دندرة' }, address: { en: 'Dendera, Qena', ar: 'دندرة، قنا' }, coords: { lat: 26.1689, lng: 32.6705 } },
  { id: 'q2', name: { en: 'Sidi Abdel-Rahim Mosque', ar: 'مسجد سيدي عبد الرحيم القناوي' }, address: { en: 'El-Shoun, Qena', ar: 'الشؤون، قنا' }, coords: { lat: 26.1578, lng: 32.7214 } },
  { id: 'q3', name: { en: 'Qena Nile Corniche', ar: 'كورنيش النيل بقنا' }, address: { en: 'Corniche El Nil, Qena', ar: 'كورنيش النيل، قنا' }, coords: { lat: 26.1625, lng: 32.7300 } },
  { id: 'q4', name: { en: 'South Valley University', ar: 'جامعة جنوب الوادي' }, address: { en: 'Kilo 6, Qena', ar: 'الكيلو ٦، قنا' }, coords: { lat: 26.1950, lng: 32.7350 } },
  { id: 'q5', name: { en: 'Prince Youssef Kamal Palace', ar: 'قصر الأمير يوسف كمال' }, address: { en: 'Nag Hammadi, Qena', ar: 'نجع حمادي، قنا' }, coords: { lat: 26.0495, lng: 32.2415 } },
  { id: 'q6', name: { en: 'Qena Railway Station', ar: 'محطة قطار قنا' }, address: { en: 'Downtown, Qena', ar: 'وسط البلد، قنا' }, coords: { lat: 26.1600, lng: 32.7180 } },
  { id: 'q7', name: { en: 'Nag Hammadi', ar: 'نجع حمادي' }, address: { en: 'North Qena', ar: 'شمال قنا' }, coords: { lat: 26.0495, lng: 32.2415 } },
  { id: 'q8', name: { en: 'Nag Saeed', ar: 'نجع سعيد' }, address: { en: 'Qena', ar: 'قنا' }, coords: { lat: 26.1834, lng: 32.7483 } },
  { id: 'q9', name: { en: 'Nag El Arab', ar: 'نجع العرب' }, address: { en: 'Qena', ar: 'قنا' }, coords: { lat: 26.1205, lng: 32.7123 } },
  { id: 'q10', name: { en: 'Nag El Sheikh', ar: 'نجع الشيخ' }, address: { en: 'Qena', ar: 'قنا' }, coords: { lat: 26.1402, lng: 32.7214 } },
  { id: 'q11', name: { en: 'Fever Hospital Qena', ar: 'مستشفى الحميات قنا' }, address: { en: 'Downtown Qena', ar: 'وسط البلد، قنا' }, coords: { lat: 26.1620, lng: 32.7150 } },
  { id: 'q12', name: { en: 'Republic Street', ar: 'شارع الجمهورية' }, address: { en: 'Downtown, Qena', ar: 'وسط البلد، قنا' }, coords: { lat: 26.1650, lng: 32.7200 } },
  { id: 'q13', name: { en: 'Qift', ar: 'قفط' }, address: { en: 'South Qena', ar: 'جنوب قنا' }, coords: { lat: 25.9984, lng: 32.8152 } },
  { id: 'q14', name: { en: 'Qus', ar: 'قوص' }, address: { en: 'South Qena', ar: 'جنوب قنا' }, coords: { lat: 25.9228, lng: 32.7663 } },
  { id: 'q15', name: { en: 'Dishna', ar: 'دشنا' }, address: { en: 'North Qena', ar: 'شمال قنا' }, coords: { lat: 26.1202, lng: 32.4789 } },
  { id: 'q16', name: { en: 'Farshout', ar: 'فرشوط' }, address: { en: 'North Qena', ar: 'شمال قنا' }, coords: { lat: 26.0594, lng: 32.1465 } },
  { id: 'q17', name: { en: 'Abu Tesht', ar: 'أبو تشت' }, address: { en: 'North Qena', ar: 'شمال قنا' }, coords: { lat: 26.1158, lng: 31.9961 } },
  { id: 'q18', name: { en: 'Maana', ar: 'المعنا' }, address: { en: 'Qena', ar: 'قنا' }, coords: { lat: 26.1655, lng: 32.7525 } },
  { id: 'q19', name: { en: 'Al Marashda', ar: 'المراشدة' }, address: { en: 'Waqf, Qena', ar: 'الوقف، قنا' }, coords: { lat: 26.1420, lng: 32.4571 } },
  { id: 'q20', name: { en: 'Al Ashraf', ar: 'الأشراف' }, address: { en: 'Qena', ar: 'قنا' }, coords: { lat: 26.1102, lng: 32.7305 } },
  { id: 'q21', name: { en: 'Qena General Hospital', ar: 'مستشفى قنا العام' }, address: { en: 'Qena', ar: 'قنا' }, coords: { lat: 26.1662, lng: 32.7230 } },
  { id: 'q22', name: { en: 'Qena University Hospital', ar: 'مستشفى قنا الجامعي' }, address: { en: 'South Valley University, Qena', ar: 'جامعة جنوب الوادي، قنا' }, coords: { lat: 26.1912, lng: 32.7385 } },
  { id: 'q23', name: { en: 'Al Waqf', ar: 'الوقف' }, address: { en: 'North Qena', ar: 'شمال قنا' }, coords: { lat: 26.0825, lng: 32.3924 } },
  { id: 'q24', name: { en: 'Naqada', ar: 'نقادة' }, address: { en: 'West Qena', ar: 'غرب قنا' }, coords: { lat: 25.9016, lng: 32.7222 } },
  { id: 'q25', name: { en: 'New Qena City', ar: 'مدينة قنا الجديدة' }, address: { en: 'East Qena', ar: 'شرق قنا' }, coords: { lat: 26.2248, lng: 32.8054 } },
  { id: 'q26', name: { en: 'Qena Bus Station (El-Mawkef)', ar: 'موقف قنا العمومي' }, address: { en: 'Qena', ar: 'قنا' }, coords: { lat: 26.1535, lng: 32.7248 } },
  { id: 'q27', name: { en: 'El Saa Square', ar: 'ميدان الساعة' }, address: { en: 'Downtown, Qena', ar: 'وسط البلد، قنا' }, coords: { lat: 26.1563, lng: 32.7166 } },
  { id: 'q28', name: { en: 'Dishna Railway Station', ar: 'محطة قطار دشنا' }, address: { en: 'Dishna, Qena', ar: 'دشنا، قنا' }, coords: { lat: 26.1235, lng: 32.4765 } },
  { id: 'q29', name: { en: 'Nag Hammadi Railway Station', ar: 'محطة قطار نجع حمادي' }, address: { en: 'Nag Hammadi, Qena', ar: 'نجع حمادي، قنا' }, coords: { lat: 26.0488, lng: 32.2409 } },

  // Cairo & Giza
  { id: 'c1', name: { en: 'Cairo Festival City', ar: 'كايرو فيستيفال سيتي' }, address: { en: 'New Cairo, Cairo', ar: 'التجمع الخامس، القاهرة' }, coords: { lat: 30.0318, lng: 31.4087 } },
  { id: 'c2', name: { en: 'City Stars Mall', ar: 'سيتي ستارز' }, address: { en: 'Nasr City, Cairo', ar: 'مدينة نصر، القاهرة' }, coords: { lat: 30.0619, lng: 31.3465 } },
  { id: 'c3', name: { en: 'Mall of Egypt', ar: 'مول مصر' }, address: { en: '6th of October, Giza', ar: '٦ أكتوبر، الجيزة' }, coords: { lat: 29.9722, lng: 31.0163 } },
  { id: 'c4', name: { en: 'Giza Pyramids', ar: 'أهرامات الجيزة' }, address: { en: 'Al Haram, Giza', ar: 'الهرم، الجيزة' }, coords: { lat: 29.9792, lng: 31.1342 } },
  { id: 'c5', name: { en: 'Cairo Tower', ar: 'برج القاهرة' }, address: { en: 'Zamalek, Cairo', ar: 'الزمالك، القاهرة' }, coords: { lat: 30.0459, lng: 31.2243 } },
  { id: 'c6', name: { en: 'Tahrir Square / Downtown', ar: 'ميدان التحرير / وسط البلد' }, address: { en: 'Cairo', ar: 'القاهرة' }, coords: { lat: 30.0444, lng: 31.2357 } },
  { id: 'c7', name: { en: 'Cairo International Airport', ar: 'مطار القاهرة الدولي' }, address: { en: 'Heliopolis, Cairo', ar: 'مصر الجديدة، القاهرة' }, coords: { lat: 30.1219, lng: 31.4056 } },
  { id: 'c8', name: { en: 'Ramses Railway Station', ar: 'محطة مصر (رمسيس)' }, address: { en: 'Ramses, Cairo', ar: 'رمسيس، القاهرة' }, coords: { lat: 30.0636, lng: 31.2471 } },
  { id: 'c9', name: { en: 'Maadi', ar: 'المعادي' }, address: { en: 'South Cairo', ar: 'جنوب القاهرة' }, coords: { lat: 29.9602, lng: 31.2569 } },
  { id: 'c10', name: { en: 'Nasr City', ar: 'مدينة نصر' }, address: { en: 'East Cairo', ar: 'شرق القاهرة' }, coords: { lat: 30.0511, lng: 31.3656 } },

  // Alexandria
  { id: 'a1', name: { en: 'Bibliotheca Alexandrina', ar: 'مكتبة الإسكندرية' }, address: { en: 'Shatby, Alexandria', ar: 'الشاطبي، الإسكندرية' }, coords: { lat: 31.2089, lng: 29.9092 } },
  { id: 'a2', name: { en: 'Stanley Bridge', ar: 'كوبري ستانلي' }, address: { en: 'Stanley, Alexandria', ar: 'ستانلي، الإسكندرية' }, coords: { lat: 31.2349, lng: 29.9482 } },
  { id: 'a3', name: { en: 'Citadel of Qaitbay', ar: 'قلعة قايتباي' }, address: { en: 'Anfoushi, Alexandria', ar: 'الأنفوشي، الإسكندرية' }, coords: { lat: 31.2140, lng: 29.8853 } },
  { id: 'a4', name: { en: 'San Stefano Grand Plaza', ar: 'سان ستيفانو' }, address: { en: 'San Stefano, Alexandria', ar: 'سان ستيفانو، الإسكندرية' }, coords: { lat: 31.2465, lng: 29.9620 } },

  // Luxor
  { id: 'l1', name: { en: 'Karnak Temple', ar: 'معبد الكرنك' }, address: { en: 'Karnak, Luxor', ar: 'الكرنك، الأقصر' }, coords: { lat: 25.7188, lng: 32.6573 } },
  { id: 'l2', name: { en: 'Luxor Temple', ar: 'معبد الأقصر' }, address: { en: 'Corniche, Luxor', ar: 'الكورنيش، الأقصر' }, coords: { lat: 25.7000, lng: 32.6398 } },
  { id: 'l3', name: { en: 'Valley of the Kings', ar: 'وادي الملوك' }, address: { en: 'West Bank, Luxor', ar: 'البر الغربي، الأقصر' }, coords: { lat: 25.7402, lng: 32.6014 } },
  { id: 'l4', name: { en: 'Luxor International Airport', ar: 'مطار الأقصر الدولي' }, address: { en: 'Luxor', ar: 'الأقصر' }, coords: { lat: 25.6703, lng: 32.7063 } },
  { id: 'l5', name: { en: 'Luxor Railway Station', ar: 'محطة قطار الأقصر' }, address: { en: 'Downtown, Luxor', ar: 'وسط البلد، الأقصر' }, coords: { lat: 25.6969, lng: 32.6433 } },

  // Aswan, Sohag, Hurghada
  { id: 'as1', name: { en: 'Philae Temple', ar: 'معبد فيلة' }, address: { en: 'Agilkia Island, Aswan', ar: 'جزيرة أجيليكا، أسوان' }, coords: { lat: 24.0255, lng: 32.8842 } },
  { id: 'as2', name: { en: 'The High Dam', ar: 'السد العالي' }, address: { en: 'Aswan', ar: 'أسوان' }, coords: { lat: 23.9704, lng: 32.8774 } },
  { id: 'as3', name: { en: 'Aswan Railway Station', ar: 'محطة قطار أسوان' }, address: { en: 'Downtown, Aswan', ar: 'وسط البلد، أسوان' }, coords: { lat: 24.0933, lng: 32.9015 } },
  { id: 'so1', name: { en: 'Sohag University', ar: 'جامعة سوهاج' }, address: { en: 'Sohag', ar: 'سوهاج' }, coords: { lat: 26.5648, lng: 31.7095 } },
  { id: 'so2', name: { en: 'Sohag Railway Station', ar: 'محطة قطار سوهاج' }, address: { en: 'Sohag', ar: 'سوهاج' }, coords: { lat: 26.5572, lng: 31.6948 } },
  { id: 'hr1', name: { en: 'Hurghada International Airport', ar: 'مطار الغردقة الدولي' }, address: { en: 'Hurghada, Red Sea', ar: 'الغردقة، البحر الأحمر' }, coords: { lat: 27.1783, lng: 33.7994 } },
  { id: 'hr2', name: { en: 'Hurghada Marina', ar: 'مارينا الغردقة' }, address: { en: 'Hurghada, Red Sea', ar: 'الغردقة، البحر الأحمر' }, coords: { lat: 27.2248, lng: 33.8414 } },
];

const mapToPlace = (raw: BilingualPlace, lang: Language): Place => ({
  id: raw.id,
  name: raw.name[lang],
  address: raw.address[lang],
  coords: raw.coords,
  type: 'place',
});

export const normalizeSearchText = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // strip Arabic diacritics & tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[،,._\-/\\()[\]{}:;"'!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getRecencyTimestamp = (p: Place): number => {
  if (typeof p.updatedAt === 'number' && !isNaN(p.updatedAt)) return p.updatedAt;
  const match = String(p.id || '').match(/(\d{10,13})/);
  if (match) {
    const val = Number(match[1]);
    return match[1].length === 10 ? val * 1000 : val;
  }
  return 0;
};

const isValidPlace = (p: Place | null | undefined): p is Place => {
  return Boolean(
    p &&
      p.name &&
      String(p.name).trim() &&
      p.coords &&
      typeof p.coords.lat === 'number' &&
      !isNaN(p.coords.lat) &&
      typeof p.coords.lng === 'number' &&
      !isNaN(p.coords.lng) &&
      (p.coords.lat !== 0 || p.coords.lng !== 0)
  );
};

// Merge multiple history/favorite sources cleanly without losing older items
export const mergePlacesHistory = (...lists: (Place[] | undefined)[]): Place[] => {
  const byKey = new Map<string, Place>();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!isValidPlace(raw)) continue;
      const normName = normalizeSearchText(raw.name);
      const latKey = raw.coords.lat.toFixed(3);
      const lngKey = raw.coords.lng.toFixed(3);
      const dedupeKey = `${normName}_${latKey}_${lngKey}`;
      const existing = byKey.get(dedupeKey);
      const ts = getRecencyTimestamp(raw);

      if (!existing) {
        byKey.set(dedupeKey, {
          ...raw,
          updatedAt: ts || raw.updatedAt,
        });
      } else {
        const existingTs = getRecencyTimestamp(existing);
        byKey.set(dedupeKey, {
          ...(ts >= existingTs ? raw : existing),
          isFavorite: Boolean(existing.isFavorite || raw.isFavorite),
          updatedAt: Math.max(ts, existingTs) || undefined,
        });
      }
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => getRecencyTimestamp(b) - getRecencyTimestamp(a)
  );
};

const scoreTextMatch = (fields: string[], normQ: string, tokens: string[]): number => {
  if (!normQ) return 1;
  const normalizedFields = fields.map((f) => normalizeSearchText(f)).filter(Boolean);
  if (normalizedFields.length === 0) return 0;

  const primary = normalizedFields[0] || '';
  const combined = normalizedFields.join(' ');
  const primaryWords = primary.split(' ').filter(Boolean);
  const allWords = combined.split(' ').filter(Boolean);

  // Check if every token matches at least somewhere in combined
  const allTokensMatch = tokens.every((tok) => combined.includes(tok));
  if (!allTokensMatch) return 0;

  let score = 50;

  if (primary === normQ) score += 1000;
  else if (primary.startsWith(normQ)) score += 650;
  else if (primaryWords.some((w) => w.startsWith(normQ))) score += 450;
  else if (primary.includes(normQ)) score += 280;
  else if (allWords.some((w) => w.startsWith(normQ))) score += 180;
  else if (combined.includes(normQ)) score += 120;

  // Token word-prefix bonuses
  for (const tok of tokens) {
    if (primaryWords.some((w) => w.startsWith(tok))) score += 80;
    else if (allWords.some((w) => w.startsWith(tok))) score += 40;
  }

  return score;
};

const attachDistanceAndFav = (
  places: Place[],
  favKeys: Set<string>,
  favIds: Set<string>,
  userLocation?: Coordinates
): (Place & { dist?: number })[] => {
  return places.map((p) => {
    let dist = p.dist;
    if (
      userLocation &&
      typeof userLocation.lat === 'number' &&
      typeof userLocation.lng === 'number' &&
      p.coords
    ) {
      dist = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        p.coords.lat,
        p.coords.lng
      );
    }
    const normKey = `${normalizeSearchText(p.name)}_${p.coords.lat.toFixed(3)}_${p.coords.lng.toFixed(3)}`;
    return {
      ...p,
      dist,
      isFavorite: Boolean(p.isFavorite || favIds.has(p.id) || favKeys.has(normKey)),
    };
  });
};

export const getSuggestedPlaces = (
  lang: Language = 'en',
  userLocation?: Coordinates,
  maxResults: number = 50
): Place[] => {
  const places = EGYPT_PLACES_RAW.map((p) => mapToPlace(p, lang));
  const favorites = getFavoritePlaces();
  const favIds = new Set(favorites.map((f) => f.id));
  const favKeys = new Set(
    favorites.map(
      (f) => `${normalizeSearchText(f.name)}_${f.coords.lat.toFixed(3)}_${f.coords.lng.toFixed(3)}`
    )
  );

  let results: Place[] = places;
  if (userLocation && userLocation.lat && userLocation.lng) {
    results = places
      .map((p) => ({
        ...p,
        dist: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          p.coords.lat,
          p.coords.lng
        ),
      }))
      .sort((a, b) => (a.dist ?? 9999) - (b.dist ?? 9999));
  }

  const withFav = attachDistanceAndFav(results, favKeys, favIds, userLocation);
  const favWithDist = attachDistanceAndFav(favorites, favKeys, favIds, userLocation);
  const combined = [
    ...favWithDist,
    ...withFav.filter(
      (r) =>
        !favIds.has(r.id) &&
        !favKeys.has(
          `${normalizeSearchText(r.name)}_${r.coords.lat.toFixed(3)}_${r.coords.lng.toFixed(3)}`
        )
    ),
  ];
  return combined.slice(0, maxResults);
};

// In-memory cache for remote geocoding/autocomplete results
const remoteSearchCache = new Map<string, Place[]>();

const isInEgyptBounds = (lat: number, lng: number) =>
  lat >= 21.5 && lat <= 32.0 && lng >= 24.5 && lng <= 37.2;

const dedupePlaces = (places: (Place & { _score?: number })[]): (Place & { _score?: number })[] => {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: (Place & { _score?: number })[] = [];

  for (const p of places) {
    if (!isValidPlace(p)) continue;
    const normName = normalizeSearchText(p.name);
    const key = `${normName}_${p.coords.lat.toFixed(3)}_${p.coords.lng.toFixed(3)}`;
    if ((p.id && seenIds.has(p.id)) || seenKeys.has(key)) continue;
    if (p.id) seenIds.add(p.id);
    seenKeys.add(key);
    out.push(p);
  }
  return out;
};

// Instant synchronous search over ALL history, favorites, and Egypt places DB
export const searchLocalPlacesSync = (
  query: string,
  lang: Language = 'en',
  userLocation?: Coordinates,
  extraHistoryPlaces: Place[] = []
): (Place & { dist?: number })[] => {
  const localHistory = getLocalRecentSearches();
  const favorites = getFavoritePlaces();
  const favIds = new Set(favorites.map((f) => f.id));
  const favKeys = new Set(
    favorites.map(
      (f) => `${normalizeSearchText(f.name)}_${f.coords.lat.toFixed(3)}_${f.coords.lng.toFixed(3)}`
    )
  );

  const mergedHistory = mergePlacesHistory(extraHistoryPlaces, localHistory);
  const rawQ = (query || '').trim();
  const normQ = normalizeSearchText(rawQ);
  const tokens = normQ ? normQ.split(' ').filter(Boolean) : [];

  // When query is empty: show Favorites + Full Merged History + Nearby Suggested Places
  if (!normQ) {
    const suggested = getSuggestedPlaces(lang, userLocation, 50);
    const fullInitial = dedupePlaces([
      ...favorites.map((f) => ({ ...f, isFavorite: true })),
      ...mergedHistory,
      ...suggested,
    ]);
    return attachDistanceAndFav(fullInitial, favKeys, favIds, userLocation);
  }

  // 1. Score & match all Favorites + Full History
  const allPersonal = dedupePlaces([
    ...favorites.map((f) => ({ ...f, isFavorite: true })),
    ...mergedHistory,
  ]);

  const matchedPersonal: (Place & { _score: number; _isPersonal: boolean })[] = [];
  for (const p of allPersonal) {
    const score = scoreTextMatch([p.name, p.address], normQ, tokens);
    if (score > 0) {
      matchedPersonal.push({ ...p, _score: score + 200, _isPersonal: true });
    }
  }

  // 2. Score & match all static bilingual Egypt places (checks both Arabic & English!)
  const matchedStatic: (Place & { _score: number; _isPersonal: boolean })[] = [];
  for (const raw of EGYPT_PLACES_RAW) {
    const score = scoreTextMatch(
      [raw.name[lang], raw.name.en, raw.name.ar, raw.address[lang], raw.address.en, raw.address.ar],
      normQ,
      tokens
    );
    if (score > 0) {
      matchedStatic.push({ ...mapToPlace(raw, lang), _score: score, _isPersonal: false });
    }
  }

  const merged = dedupePlaces([...matchedPersonal, ...matchedStatic]) as (ScoredPlace & {
    _isPersonal?: boolean;
  })[];

  const withDist = attachDistanceAndFav(merged, favKeys, favIds, userLocation) as ScoredPlace[];
  withDist.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    const aScore = a._score || 0;
    const bScore = b._score || 0;
    if (Math.abs(aScore - bScore) >= 100) return bScore - aScore;
    if (a.dist !== undefined && b.dist !== undefined) return a.dist - b.dist;
    return bScore - aScore;
  });

  return withDist;
};

const fetchPhotonPlaces = async (
  rawQ: string,
  userLocation?: Coordinates,
  externalSignal?: AbortSignal
): Promise<Place[]> => {
  const biasLat = userLocation?.lat || 26.1551;
  const biasLng = userLocation?.lng || 32.7160;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 3500);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(tid);
      return [];
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(rawQ)}&limit=30&lat=${biasLat}&lon=${biasLng}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];

    const mapped = features
      .map((f: PhotonFeature): (Place & { _inEgypt: boolean }) | null => {
        const coords = f?.geometry?.coordinates;
        const props = f?.properties || {};
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (isNaN(lat) || isNaN(lng)) return null;

        const inEgypt =
          String(props.countrycode || '').toUpperCase() === 'EG' ||
          isInEgyptBounds(lat, lng);

        const primaryName =
          props.name ||
          props.street ||
          props.district ||
          props.locality ||
          props.city ||
          props.state;
        if (!primaryName) return null;

        const addrParts = [
          props.street && props.street !== primaryName ? props.street : '',
          props.district && props.district !== primaryName ? props.district : '',
          props.locality && props.locality !== primaryName ? props.locality : '',
          props.city && props.city !== primaryName ? props.city : '',
          props.state && props.state !== props.city && props.state !== primaryName ? props.state : '',
          props.country && props.country !== primaryName ? props.country : '',
        ].filter(Boolean);

        return {
          id: `ph_${props.osm_type || 'N'}_${props.osm_id || `${lat.toFixed(5)}_${lng.toFixed(5)}`}`,
          name: String(primaryName),
          address: addrParts.join('، ') || String(props.state || props.country || ''),
          coords: { lat, lng },
          type: 'place',
          isGooglePlace: false,
          _inEgypt: inEgypt,
        };
      })
      .filter((x): x is Place & { _inEgypt: boolean } => x !== null);

    const egyptOnly = mapped.filter((m) => m._inEgypt);
    // For short 1-2 char queries, strictly prefer Egypt results so random global hits don't pollute
    const selected = egyptOnly.length > 0 || rawQ.length < 3 ? egyptOnly : mapped;
    return selected.map((item) => {
      const { _inEgypt: _, ...rest } = item;
      void _;
      return rest;
    });
  } catch {
    return [];
  } finally {
    clearTimeout(tid);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
};

const fetchNominatimPlaces = async (
  rawQ: string,
  lang: Language,
  userLocation?: Coordinates,
  externalSignal?: AbortSignal
): Promise<Place[]> => {
  if (rawQ.length < 2) return [];
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 3500);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(tid);
      return [];
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    let viewboxParam = '';
    if (userLocation?.lat && userLocation?.lng) {
      const delta = 0.6;
      viewboxParam = `&viewbox=${userLocation.lng - delta},${userLocation.lat + delta},${userLocation.lng + delta},${userLocation.lat - delta}`;
    }
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(rawQ)}&countrycodes=eg&format=json&accept-language=${lang}&limit=20&addressdetails=1${viewboxParam}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? (data as NominatimItem[]) : []).map((p) => {
      const nameParts = String(p.display_name || '').split(',');
      return {
        id: `osm_${p.place_id}`,
        name: p.name || nameParts[0]?.trim() || 'Location',
        address: nameParts.slice(1).join(',').trim() || p.display_name || '',
        coords: { lat: parseFloat(p.lat), lng: parseFloat(p.lon) },
        type: 'place' as const,
        isGooglePlace: false,
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(tid);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
};

export const searchPlaces = async (
  query: string,
  lang: Language = 'en',
  userLocation?: Coordinates,
  extraHistoryPlaces: Place[] = [],
  externalSignal?: AbortSignal
): Promise<(Place & { dist?: number })[]> => {
  const localMatches = searchLocalPlacesSync(query, lang, userLocation, extraHistoryPlaces);
  const rawQ = (query || '').trim();
  const normQ = normalizeSearchText(rawQ);
  const tokens = normQ ? normQ.split(' ').filter(Boolean) : [];

  if (!rawQ) {
    return localMatches;
  }

  const favorites = getFavoritePlaces();
  const favIds = new Set(favorites.map((f) => f.id));
  const favKeys = new Set(
    favorites.map(
      (f) => `${normalizeSearchText(f.name)}_${f.coords.lat.toFixed(3)}_${f.coords.lng.toFixed(3)}`
    )
  );

  // Check remote cache first (keyed by query + lang + coarse 0.1deg location bias)
  const locKey = userLocation
    ? `${userLocation.lat.toFixed(1)}_${userLocation.lng.toFixed(1)}`
    : 'eg';
  const cacheKey = `${normQ}_${lang}_${locKey}`;

  let remoteResults: Place[] = [];
  if (remoteSearchCache.has(cacheKey)) {
    remoteResults = remoteSearchCache.get(cacheKey)!;
  } else {
    // Query Photon (supports 1-letter + prefix autocomplete!) and Nominatim in parallel
    const [photonRes, nominatimRes] = await Promise.all([
      fetchPhotonPlaces(rawQ, userLocation, externalSignal),
      fetchNominatimPlaces(rawQ, lang, userLocation, externalSignal),
    ]);
    remoteResults = dedupePlaces([...photonRes, ...nominatimRes]);
    if (!externalSignal?.aborted && remoteResults.length > 0) {
      remoteSearchCache.set(cacheKey, remoteResults);
    }
  }

  const scoredRemote: ScoredPlace[] = remoteResults.map((p) => {
    const score = scoreTextMatch([p.name, p.address], normQ, tokens);
    return {
      ...p,
      _score: Math.max(score, 30),
    };
  });

  const scoredLocal: ScoredPlace[] = (localMatches as ScoredPlace[]).map((p) => ({
    ...p,
    _score: p._score ?? scoreTextMatch([p.name, p.address], normQ, tokens) + (p.type === 'history' ? 200 : 0),
  }));

  const combined = dedupePlaces([...scoredLocal, ...scoredRemote]);
  const withDist = attachDistanceAndFav(combined, favKeys, favIds, userLocation) as ScoredPlace[];

  withDist.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;

    const aIsHist = a.type === 'history' || a.type === 'home' || a.type === 'work';
    const bIsHist = b.type === 'history' || b.type === 'home' || b.type === 'work';
    if (aIsHist && !bIsHist) return -1;
    if (!aIsHist && bIsHist) return 1;

    const aScore = a._score || 0;
    const bScore = b._score || 0;
    if (Math.abs(aScore - bScore) >= 120) return bScore - aScore;

    if (a.dist !== undefined && b.dist !== undefined) {
      return a.dist - b.dist;
    }
    return bScore - aScore;
  });

  return withDist.slice(0, 60);
};

export const getPlaceDetails = async (placeId: string): Promise<Coordinates | null> => {
  void placeId;
  return null;
};

export interface DetailedGeocodeResult {
  address: string;
  city: string;
  district: string;
  street: string;
  poi: string;
  isCoarseOnly?: boolean;
}

interface ParsedReverseParts {
  poi: string;
  street: string;
  microArea: string;
  mesoArea: string;
  district: string;
  city: string;
  state: string;
  extraParts: string[];
}

interface NominatimReverseAddress {
  house_number?: string;
  road?: string;
  street?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  cycleway?: string;
  track?: string;
  trunk?: string;
  amenity?: string;
  building?: string;
  shop?: string;
  office?: string;
  tourism?: string;
  leisure?: string;
  healthcare?: string;
  historic?: string;
  craft?: string;
  landuse?: string;
  commercial?: string;
  industrial?: string;
  man_made?: string;
  emergency?: string;
  club?: string;
  neighbourhood?: string;
  quarter?: string;
  city_block?: string;
  hamlet?: string;
  isolated_dwelling?: string;
  residential?: string;
  allotments?: string;
  farm?: string;
  locality?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city_district?: string;
  county?: string;
  municipality?: string;
  state_district?: string;
  city?: string;
  state?: string;
  region?: string;
  country?: string;
  country_code?: string;
}

interface NominatimReverseResponse {
  name?: string;
  display_name?: string;
  namedetails?: Record<string, string>;
  address?: NominatimReverseAddress;
}

interface PhotonReverseFeature {
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    locality?: string;
    county?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

interface BigDataCloudAdminEntry {
  name?: string;
  description?: string;
  order?: number;
  adminLevel?: number;
}

interface BigDataCloudResponse {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  localityInfo?: {
    administrative?: BigDataCloudAdminEntry[];
    informative?: BigDataCloudAdminEntry[];
  };
}

const reverseGeocodeCache = new Map<string, DetailedGeocodeResult>();
const inFlightReverseRequests = new Map<string, Promise<DetailedGeocodeResult>>();

const hasArabicScript = (str: string): boolean => /[\u0600-\u06FF]/.test(str || '');

const isLatinOnlySegment = (str: string): boolean =>
  Boolean(str) && /[A-Za-z]/.test(str) && !hasArabicScript(str);

const cleanGeoSegment = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}[\s،,-]*/i, '') // strip Plus Codes
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (/^\d{4,6}$/.test(cleaned)) return ''; // standalone postal code
  const norm = normalizeSearchText(cleaned);
  if (
    !norm ||
    norm === 'مصر' ||
    norm === 'egypt' ||
    norm === 'arab republic of egypt' ||
    norm === 'جمهوريه مصر العربيه' ||
    norm === 'unnamed road' ||
    norm === 'طريق غير مسمي' ||
    norm === 'شارع بدون اسم' ||
    norm === 'unknown' ||
    norm === 'غير معروف'
  ) {
    return '';
  }
  return cleaned;
};

const filterSegmentForLang = (raw: unknown, lang: Language): string => {
  const cleaned = cleanGeoSegment(raw);
  if (!cleaned) return '';
  if (lang === 'ar' && isLatinOnlySegment(cleaned)) {
    return '';
  }
  return cleaned;
};

const normalizeAdminForDedupe = (s: string): string =>
  normalizeSearchText(s)
    .replace(/^(محافظه|gov\.?)\s+/i, '')
    .replace(/\s+(governorate|gov\.?)$/i, '')
    .trim();

const pushUniqueGeoPart = (target: string[], raw: unknown, lang?: Language): void => {
  const cleaned = lang ? filterSegmentForLang(raw, lang) : cleanGeoSegment(raw);
  if (!cleaned) return;
  const norm = normalizeSearchText(cleaned);
  const adminNorm = normalizeAdminForDedupe(cleaned);
  if (!norm) return;

  for (const existing of target) {
    const existingNorm = normalizeSearchText(existing);
    const existingAdmin = normalizeAdminForDedupe(existing);
    if (existingNorm === norm || (adminNorm && existingAdmin === adminNorm)) {
      return;
    }
  }
  target.push(cleaned);
};

const pickBestTextForLang = (primary: string, secondary: string, lang: Language): string => {
  const a = filterSegmentForLang(primary, lang);
  const b = filterSegmentForLang(secondary, lang);
  if (!a) return b;
  if (!b) return a;
  if (lang === 'ar') {
    const aAr = hasArabicScript(a);
    const bAr = hasArabicScript(b);
    if (aAr && !bAr) return a;
    if (!aAr && bAr) return b;
  }
  return a;
};

const parseNominatimReverse = (
  data: NominatimReverseResponse,
  lang: Language
): (ParsedReverseParts & { rawFallbackParts: string[] }) | null => {
  if (!data || (!data.address && !data.display_name && !data.name)) return null;
  const addr = data.address || {};

  const localizedFeatureName = filterSegmentForLang(
    (lang === 'ar'
      ? data.namedetails?.['name:ar'] ||
        data.namedetails?.['name:arz'] ||
        data.namedetails?.['official_name:ar'] ||
        data.namedetails?.['alt_name:ar'] ||
        data.namedetails?.['short_name:ar'] ||
        data.namedetails?.name
      : data.namedetails?.['name:en'] ||
        data.namedetails?.['int_name'] ||
        data.namedetails?.name) ||
      data.name ||
      '',
    lang
  );

  const poiFromAddr = filterSegmentForLang(
    addr.amenity ||
      addr.building ||
      addr.shop ||
      addr.office ||
      addr.tourism ||
      addr.leisure ||
      addr.healthcare ||
      addr.historic ||
      addr.craft ||
      addr.emergency ||
      addr.club ||
      addr.man_made ||
      addr.commercial ||
      addr.industrial ||
      '',
    lang
  );

  const rawStreet = filterSegmentForLang(
    addr.road ||
      addr.street ||
      addr.pedestrian ||
      addr.footway ||
      addr.residential ||
      addr.path ||
      addr.cycleway ||
      addr.track ||
      addr.trunk ||
      '',
    lang
  );
  const houseNumber = typeof addr.house_number === 'string' ? addr.house_number.trim() : '';
  const street = houseNumber && rawStreet ? `${houseNumber} ${rawStreet}` : rawStreet;

  const microArea = filterSegmentForLang(
    addr.neighbourhood ||
      addr.quarter ||
      addr.city_block ||
      addr.hamlet ||
      addr.isolated_dwelling ||
      addr.allotments ||
      addr.farm ||
      addr.locality ||
      '',
    lang
  );

  const mesoArea = filterSegmentForLang(addr.suburb || addr.village || addr.town || '', lang);
  const district = filterSegmentForLang(
    addr.city_district || addr.county || addr.municipality || addr.state_district || '',
    lang
  );
  const city = filterSegmentForLang(addr.city || addr.town || addr.village || addr.county || '', lang);
  const state = filterSegmentForLang(addr.state || addr.region || '', lang);

  let poi = poiFromAddr;
  if (
    localizedFeatureName &&
    normalizeSearchText(localizedFeatureName) !== normalizeSearchText(street) &&
    normalizeSearchText(localizedFeatureName) !== normalizeSearchText(microArea) &&
    normalizeSearchText(localizedFeatureName) !== normalizeSearchText(mesoArea) &&
    normalizeSearchText(localizedFeatureName) !== normalizeSearchText(city) &&
    normalizeAdminForDedupe(localizedFeatureName) !== normalizeAdminForDedupe(state)
  ) {
    poi = poi || localizedFeatureName;
  }

  // Extract fallback segments from display_name in case OSM put rural hamlet/street there
  const extraParts: string[] = [];
  const rawFallbackParts: string[] = [];
  if (typeof data.display_name === 'string') {
    const segs = data.display_name.split(/[،,]/);
    for (const seg of segs) {
      if (extraParts.length < 4) {
        pushUniqueGeoPart(extraParts, seg, lang);
      }
      if (rawFallbackParts.length < 4) {
        pushUniqueGeoPart(rawFallbackParts, seg);
      }
    }
  }

  return {
    poi,
    street,
    microArea,
    mesoArea,
    district,
    city,
    state,
    extraParts,
    rawFallbackParts,
  };
};

const parsePhotonReverse = (
  data: { features?: PhotonReverseFeature[] } | null,
  lang: Language
): ParsedReverseParts | null => {
  const props = data?.features?.[0]?.properties;
  if (!props) return null;

  const poi = filterSegmentForLang(props.name || '', lang);
  const rawStreet = filterSegmentForLang(props.street || '', lang);
  const houseNumber = typeof props.housenumber === 'string' ? props.housenumber.trim() : '';
  const street = houseNumber && rawStreet ? `${houseNumber} ${rawStreet}` : rawStreet;
  const microArea = filterSegmentForLang(props.district || props.locality || '', lang);
  const district = filterSegmentForLang(props.county || '', lang);
  const city = filterSegmentForLang(props.city || '', lang);
  const state = filterSegmentForLang(props.state || '', lang);

  if (!poi && !street && !microArea && !district && !city && !state) {
    return null;
  }

  return {
    poi:
      poi &&
      normalizeSearchText(poi) !== normalizeSearchText(street) &&
      normalizeSearchText(poi) !== normalizeSearchText(microArea) &&
      normalizeSearchText(poi) !== normalizeSearchText(city) &&
      normalizeAdminForDedupe(poi) !== normalizeAdminForDedupe(state)
        ? poi
        : '',
    street,
    microArea,
    mesoArea: '',
    district,
    city,
    state,
    extraParts: [],
  };
};

const formatDetailedAddressFromParts = (
  nom: ParsedReverseParts | null,
  pho: ParsedReverseParts | null,
  lang: Language
): DetailedGeocodeResult | null => {
  if (!nom && !pho) return null;

  const poi = pickBestTextForLang(nom?.poi || '', pho?.poi || '', lang);
  const street = pickBestTextForLang(nom?.street || '', pho?.street || '', lang);
  const microArea = pickBestTextForLang(nom?.microArea || '', pho?.microArea || '', lang);
  const mesoArea = pickBestTextForLang(nom?.mesoArea || '', pho?.mesoArea || '', lang);
  const district = pickBestTextForLang(nom?.district || '', pho?.district || '', lang);
  const city = pickBestTextForLang(nom?.city || '', pho?.city || '', lang);
  const state = pickBestTextForLang(nom?.state || '', pho?.state || '', lang);

  const ordered: string[] = [];
  if (poi) pushUniqueGeoPart(ordered, poi, lang);
  if (street) pushUniqueGeoPart(ordered, street, lang);
  if (microArea) pushUniqueGeoPart(ordered, microArea, lang);
  if (mesoArea) pushUniqueGeoPart(ordered, mesoArea, lang);
  if (district && ordered.length < 3) pushUniqueGeoPart(ordered, district, lang);
  if (city && ordered.length < 4) pushUniqueGeoPart(ordered, city, lang);
  if (state && ordered.length < 3) pushUniqueGeoPart(ordered, state, lang);

  // If structured keys only yielded a coarse city/governorate, enrich from display_name segments
  if (ordered.length <= 1 && nom?.extraParts?.length) {
    const merged: string[] = [];
    for (const seg of nom.extraParts) {
      pushUniqueGeoPart(merged, seg, lang);
    }
    for (const existing of ordered) {
      pushUniqueGeoPart(merged, existing, lang);
    }
    ordered.splice(0, ordered.length, ...merged.slice(0, 4));
  } else if (state && ordered.length === 1) {
    pushUniqueGeoPart(ordered, state, lang);
  }

  const finalParts = ordered.slice(0, 4);
  if (finalParts.length === 0) return null;

  const sep = lang === 'ar' ? '، ' : ', ';
  const address = finalParts.join(sep);
  const resolvedCity = city || mesoArea || district || state || '';
  const resolvedDistrict = microArea || mesoArea || district || '';
  const isCoarseOnly =
    finalParts.length <= 1 &&
    !poi &&
    !street &&
    !microArea &&
    !mesoArea;

  return {
    address,
    city: resolvedCity,
    district: resolvedDistrict,
    street,
    poi,
    isCoarseOnly,
  };
};

const fetchJsonWithTimeout = async <T,>(url: string, timeoutMs: number): Promise<T | null> => {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
};

export const reverseGeocodeDetailed = async (
  coords: Coordinates,
  lang: Language = 'ar',
  externalSignal?: AbortSignal
): Promise<DetailedGeocodeResult> => {
  const emptyResult: DetailedGeocodeResult = {
    address: '',
    city: '',
    district: '',
    street: '',
    poi: '',
    isCoarseOnly: true,
  };

  if (
    !coords ||
    typeof coords.lat !== 'number' ||
    typeof coords.lng !== 'number' ||
    Number.isNaN(coords.lat) ||
    Number.isNaN(coords.lng) ||
    (coords.lat === 0 && coords.lng === 0)
  ) {
    return emptyResult;
  }

  if (externalSignal?.aborted) {
    return emptyResult;
  }

  // ~11m grid cache prevents redundant rate-limited Nominatim calls between moveEnd and Confirm
  const cacheKey = `${coords.lat.toFixed(4)}_${coords.lng.toFixed(4)}_${lang}`;
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const existingPromise = inFlightReverseRequests.get(cacheKey);
  if (existingPromise) {
    return await existingPromise;
  }

  const resolveTask = (async (): Promise<DetailedGeocodeResult> => {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=jsonv2&zoom=18&addressdetails=1&namedetails=1&accept-language=${lang}`;
    const phoLangParam = lang === 'en' ? '&lang=en' : '';
    const phoUrl = `https://photon.komoot.io/reverse?lat=${coords.lat}&lon=${coords.lng}${phoLangParam}`;

    const [nomRaw, phoRaw] = await Promise.all([
      fetchJsonWithTimeout<NominatimReverseResponse>(nomUrl, 2800),
      fetchJsonWithTimeout<{ features?: PhotonReverseFeature[] }>(phoUrl, 2500),
    ]);

    const nomParsed = nomRaw ? parseNominatimReverse(nomRaw, lang) : null;
    const phoParsed = phoRaw ? parsePhotonReverse(phoRaw, lang) : null;
    let best = formatDetailedAddressFromParts(nomParsed, phoParsed, lang);

    // Query BigDataCloud with localized hierarchy if OSM + Photon failed, stayed coarse, or lacked street/POI detail
    if (!best || best.isCoarseOnly || (!best.street && !best.poi)) {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lng}&localityLanguage=${lang}`;
      const bdcData = await fetchJsonWithTimeout<BigDataCloudResponse>(bdcUrl, 2500);
      if (bdcData) {
        const bdcParts: string[] = [];
        if (bdcData.locality) pushUniqueGeoPart(bdcParts, bdcData.locality, lang);

        const adminEntries = Array.isArray(bdcData.localityInfo?.administrative)
          ? [...bdcData.localityInfo.administrative]
              .filter((e) => (e.adminLevel ?? 0) >= 4 || (e.order ?? 0) >= 3)
              .sort((a, b) => (b.adminLevel ?? b.order ?? 0) - (a.adminLevel ?? a.order ?? 0))
          : [];
        for (const entry of adminEntries) {
          pushUniqueGeoPart(bdcParts, entry.name, lang);
          if (bdcParts.length >= 4) break;
        }

        if (bdcParts.length < 2 && Array.isArray(bdcData.localityInfo?.informative)) {
          for (const info of bdcData.localityInfo.informative) {
            const desc = String(info.description || '').toLowerCase();
            if (
              desc.includes('country') ||
              desc.includes('continent') ||
              desc.includes('time zone') ||
              desc.includes('postal')
            ) {
              continue;
            }
            pushUniqueGeoPart(bdcParts, info.name, lang);
            if (bdcParts.length >= 3) break;
          }
        }

        if (bdcData.city) pushUniqueGeoPart(bdcParts, bdcData.city, lang);
        if (bdcData.principalSubdivision && bdcParts.length < 3) {
          pushUniqueGeoPart(bdcParts, bdcData.principalSubdivision, lang);
        }

        if (bdcParts.length > 0) {
          const sep = lang === 'ar' ? '، ' : ', ';
          if (!best || best.isCoarseOnly) {
            if (!best || bdcParts.length > 1) {
              best = {
                address: bdcParts.slice(0, 4).join(sep),
                city: filterSegmentForLang(bdcData.city || bdcData.principalSubdivision || '', lang),
                district: filterSegmentForLang(bdcData.locality || bdcParts[0] || '', lang),
                street: '',
                poi: '',
                isCoarseOnly: bdcParts.length <= 1,
              };
            }
          } else if (lang === 'ar') {
            // Prepend localized Arabic locality if missing from OSM result
            const arabicLoc = filterSegmentForLang(bdcData.locality || '', lang);
            const existingParts = best.address.split(/[،,]/).map((s) => s.trim()).filter(Boolean);
            const combined: string[] = [];
            if (arabicLoc) pushUniqueGeoPart(combined, arabicLoc, lang);
            for (const p of existingParts) pushUniqueGeoPart(combined, p, lang);
            for (const p of bdcParts) {
              if (combined.length >= 4) break;
              pushUniqueGeoPart(combined, p, lang);
            }
            if (combined.length > 0) {
              best = {
                ...best,
                address: combined.slice(0, 4).join(sep),
                district: best.district || arabicLoc,
              };
            }
          }
        }
      }
    }

    // Proximity enrichment against local landmarks only if remote sources stayed coarse or offline
    if (!best || best.isCoarseOnly) {
      let nearestPlace: BilingualPlace | null = null;
      let nearestKm = Infinity;
      for (const rawPlace of EGYPT_PLACES_RAW) {
        const km = calculateDistance(
          coords.lat,
          coords.lng,
          rawPlace.coords.lat,
          rawPlace.coords.lng
        );
        if (km < nearestKm) {
          nearestKm = km;
          nearestPlace = rawPlace;
        }
      }

      if (nearestPlace && nearestKm <= 1.2) {
        const sep = lang === 'ar' ? '، ' : ', ';
        const localName = nearestPlace.name[lang];
        const parts: string[] = [];
        if (nearestKm <= 0.18) {
          pushUniqueGeoPart(parts, localName, lang);
        } else {
          pushUniqueGeoPart(
            parts,
            lang === 'ar' ? `بالقرب من ${localName}` : `Near ${localName}`,
            lang
          );
        }
        if (best?.address) {
          pushUniqueGeoPart(parts, best.address, lang);
        } else if (nearestPlace.address[lang]) {
          pushUniqueGeoPart(parts, nearestPlace.address[lang], lang);
        }
        best = {
          address: parts.join(sep),
          city: best?.city || nearestPlace.address[lang] || '',
          district: localName,
          street: best?.street || '',
          poi: localName,
          isCoarseOnly: false,
        };
      }
    }

    // Last-resort Latin fallback ONLY if zero Arabic parts were available anywhere
    if ((!best || !best.address) && nomParsed?.rawFallbackParts?.length) {
      const sep = lang === 'ar' ? '، ' : ', ';
      best = {
        address: nomParsed.rawFallbackParts.slice(0, 4).join(sep),
        city: nomParsed.rawFallbackParts[nomParsed.rawFallbackParts.length - 1] || '',
        district: nomParsed.rawFallbackParts[0] || '',
        street: '',
        poi: '',
        isCoarseOnly: nomParsed.rawFallbackParts.length <= 1,
      };
    }

    const finalResult = best || emptyResult;
    if (finalResult.address) {
      if (reverseGeocodeCache.size >= 300) {
        const firstKey = reverseGeocodeCache.keys().next().value;
        if (firstKey) reverseGeocodeCache.delete(firstKey);
      }
      reverseGeocodeCache.set(cacheKey, finalResult);
    }
    return finalResult;
  })();

  inFlightReverseRequests.set(cacheKey, resolveTask);
  try {
    return await resolveTask;
  } finally {
    inFlightReverseRequests.delete(cacheKey);
  }
};


// --- Local Storage History ---

export const saveToRecent = (place: Place) => {
  try {
    let safeLat = 0;
    let safeLng = 0;

    if (place.coords) {
      const rawCoords = place.coords as unknown as {
        lat?: number | (() => number);
        lng?: number | (() => number);
      };
      try {
        if (typeof rawCoords.lat === 'function') {
          safeLat = rawCoords.lat();
        } else {
          safeLat = Number(rawCoords.lat);
        }

        if (typeof rawCoords.lng === 'function') {
          safeLng = rawCoords.lng();
        } else {
          safeLng = Number(rawCoords.lng);
        }
      } catch {
        safeLat = 0;
        safeLng = 0;
      }
    }

    if (!safeLat && !safeLng) return;

    const safePlace: Place = {
      id: String(place.id || `loc_${Date.now()}`),
      name: String(place.name || 'Unknown Location'),
      address: String(place.address || ''),
      coords: {
        lat: typeof safeLat === 'number' && !isNaN(safeLat) ? safeLat : 0,
        lng: typeof safeLng === 'number' && !isNaN(safeLng) ? safeLng : 0,
      },
      type: place.type === 'place' || place.type === 'history' ? 'history' : place.type || 'history',
      isGooglePlace: Boolean(place.isGooglePlace),
      updatedAt: Date.now(),
    };

    const raw = localStorage.getItem('places_history');
    let history: Place[] = raw ? JSON.parse(raw) : [];

    const safeNorm = normalizeSearchText(safePlace.name);
    history = history.filter((item) => {
      if (safePlace.id && item.id === safePlace.id) return false;
      const itemNorm = normalizeSearchText(item.name || '');
      if (
        itemNorm === safeNorm &&
        Math.abs((item.coords?.lat || 0) - safePlace.coords.lat) < 0.001 &&
        Math.abs((item.coords?.lng || 0) - safePlace.coords.lng) < 0.001
      ) {
        return false;
      }
      return !(item.name === safePlace.name && item.address === safePlace.address);
    });

    history.unshift(safePlace);

    // Keep full search history (up to 200 unique locations)
    const updated = history.slice(0, 200);
    localStorage.setItem('places_history', JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save recent search', e);
  }
};

export const toggleFavoritePlace = (place: Place): boolean => {
  try {
    const favs = getFavoritePlaces();
    const exists = favs.find((f) => f.id === place.id);

    let newFavs;
    let isNowFavorite = false;

    if (exists) {
      newFavs = favs.filter((f) => f.id !== place.id);
    } else {
      newFavs = [{ ...place, isFavorite: true }, ...favs];
      isNowFavorite = true;
    }

    localStorage.setItem('places_favorites', JSON.stringify(newFavs));
    return isNowFavorite;
  } catch {
    return false;
  }
};

export const getFavoritePlaces = (): Place[] => {
  try {
    const data = localStorage.getItem('places_favorites');
    if (!data) return [];
    return JSON.parse(data).map((p: Place) => ({ ...p, isFavorite: true }));
  } catch {
    return [];
  }
};

export const getLocalRecentSearches = (): Place[] => {
  try {
    const data = localStorage.getItem('places_history');
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.filter(isValidPlace) : [];
  } catch {
    return [];
  }
};
