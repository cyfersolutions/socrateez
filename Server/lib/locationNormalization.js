/* eslint-disable no-unused-vars */
const STATE_TO_CODE = new Map([
  ["alabama", "AL"], ["alaska", "AK"], ["arizona", "AZ"], ["arkansas", "AR"],
  ["california", "CA"], ["colorado", "CO"], ["connecticut", "CT"], ["delaware", "DE"],
  ["florida", "FL"], ["georgia", "GA"], ["hawaii", "HI"], ["idaho", "ID"],
  ["illinois", "IL"], ["indiana", "IN"], ["iowa", "IA"], ["kansas", "KS"],
  ["kentucky", "KY"], ["louisiana", "LA"], ["maine", "ME"], ["maryland", "MD"],
  ["massachusetts", "MA"], ["michigan", "MI"], ["minnesota", "MN"], ["mississippi", "MS"],
  ["missouri", "MO"], ["montana", "MT"], ["nebraska", "NE"], ["nevada", "NV"],
  ["new hampshire", "NH"], ["new jersey", "NJ"], ["new mexico", "NM"], ["new york", "NY"],
  ["north carolina", "NC"], ["north dakota", "ND"], ["ohio", "OH"], ["oklahoma", "OK"],
  ["oregon", "OR"], ["pennsylvania", "PA"], ["rhode island", "RI"], ["south carolina", "SC"],
  ["south dakota", "SD"], ["tennessee", "TN"], ["texas", "TX"], ["utah", "UT"],
  ["vermont", "VT"], ["virginia", "VA"], ["washington", "WA"], ["west virginia", "WV"],
  ["wisconsin", "WI"], ["wyoming", "WY"], ["district of columbia", "DC"],
]);

const COUNTRY_VARIANTS = new Map([
  ["usa", "US"], ["u.s.a.", "US"], ["u.s.a", "US"], ["u.s.", "US"], ["u.s", "US"],
  ["united states", "US"], ["united states of america", "US"], ["america", "US"],
  ["uk", "GB"], ["u.k.", "GB"], ["united kingdom", "GB"], ["great britain", "GB"], ["england", "GB"],
  ["canada", "CA"], ["can", "CA"],
  ["australia", "AU"], ["aus", "AU"],
  ["germany", "DE"], ["deutschland", "DE"],
  ["france", "FR"],
  ["india", "IN"],
  ["japan", "JP"],
  ["china", "CN"],
  ["brazil", "BR"],
  ["mexico", "MX"],
  ["spain", "ES"],
  ["italy", "IT"],
  ["netherlands", "NL"], ["holland", "NL"],
  ["sweden", "SE"],
  ["norway", "NO"],
  ["denmark", "DK"],
  ["finland", "FI"],
  ["ireland", "IE"],
  ["singapore", "SG"],
  ["south korea", "KR"], ["korea", "KR"],
  ["israel", "IL"],
  ["new zealand", "NZ"],
  ["switzerland", "CH"],
  ["poland", "PL"],
  ["portugal", "PT"],
  ["argentina", "AR"],
  ["colombia", "CO"],
  ["chile", "CL"],
  ["philippines", "PH"],
  ["taiwan", "TW"],
  ["uae", "AE"], ["united arab emirates", "AE"],
]);

const CITY_COORDS = new Map([
  ["new york city,ny,us", { lat: 40.71, lng: -74.01 }],
  ["new york,ny,us", { lat: 40.71, lng: -74.01 }],
  ["los angeles,ca,us", { lat: 34.05, lng: -118.24 }],
  ["chicago,il,us", { lat: 41.88, lng: -87.63 }],
  ["houston,tx,us", { lat: 29.76, lng: -95.37 }],
  ["phoenix,az,us", { lat: 33.45, lng: -112.07 }],
  ["philadelphia,pa,us", { lat: 39.95, lng: -75.17 }],
  ["san antonio,tx,us", { lat: 29.42, lng: -98.49 }],
  ["san diego,ca,us", { lat: 32.72, lng: -117.16 }],
  ["dallas,tx,us", { lat: 32.78, lng: -96.80 }],
  ["san jose,ca,us", { lat: 37.34, lng: -121.89 }],
  ["austin,tx,us", { lat: 30.27, lng: -97.74 }],
  ["san francisco,ca,us", { lat: 37.77, lng: -122.42 }],
  ["seattle,wa,us", { lat: 47.61, lng: -122.33 }],
  ["denver,co,us", { lat: 39.74, lng: -104.99 }],
  ["boston,ma,us", { lat: 42.36, lng: -71.06 }],
  ["nashville,tn,us", { lat: 36.16, lng: -86.78 }],
  ["washington,dc,us", { lat: 38.91, lng: -77.04 }],
  ["atlanta,ga,us", { lat: 33.75, lng: -84.39 }],
  ["miami,fl,us", { lat: 25.76, lng: -80.19 }],
  ["portland,or,us", { lat: 45.52, lng: -122.68 }],
  ["minneapolis,mn,us", { lat: 44.98, lng: -93.27 }],
  ["raleigh,nc,us", { lat: 35.78, lng: -78.64 }],
  ["charlotte,nc,us", { lat: 35.23, lng: -80.84 }],
  ["pittsburgh,pa,us", { lat: 40.44, lng: -79.99 }],
  ["detroit,mi,us", { lat: 42.33, lng: -83.05 }],
  ["salt lake city,ut,us", { lat: 40.76, lng: -111.89 }],
  ["london,,gb", { lat: 51.51, lng: -0.13 }],
  ["toronto,,ca", { lat: 43.65, lng: -79.38 }],
  ["vancouver,,ca", { lat: 49.28, lng: -123.12 }],
  ["sydney,,au", { lat: -33.87, lng: 151.21 }],
  ["melbourne,,au", { lat: -37.81, lng: 144.96 }],
  ["berlin,,de", { lat: 52.52, lng: 13.41 }],
  ["paris,,fr", { lat: 48.86, lng: 2.35 }],
  ["bangalore,,in", { lat: 12.97, lng: 77.59 }],
  ["mumbai,,in", { lat: 19.08, lng: 72.88 }],
  ["hyderabad,,in", { lat: 17.39, lng: 78.49 }],
  ["singapore,,sg", { lat: 1.35, lng: 103.82 }],
  ["tokyo,,jp", { lat: 35.68, lng: 139.69 }],
  ["dublin,,ie", { lat: 53.35, lng: -6.26 }],
  ["amsterdam,,nl", { lat: 52.37, lng: 4.90 }],
]);

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize location fields: state codes, country names, city casing, geocoords.
 * Does NOT affect `isRemote` — that is computed separately before this step.
 */
export function normalizeLocation(raw, tracker) {
  const rulesApplied = [];
  const state = (raw.state == null ? "" : String(raw.state)).trim();
  const city = (raw.city == null ? "" : String(raw.city)).trim();
  const country = (raw.country == null ? "" : String(raw.country)).trim();

  let normalizedState = state;
  let normalizedCity = city;
  let normalizedCountry = country;
  let latitude = null;
  let longitude = null;

  // LOC-01 — Full state name → abbreviation
  if (state) {
    const code = STATE_TO_CODE.get(state.toLowerCase());
    if (code && code !== state) {
      normalizedState = code;
      rulesApplied.push("LOC-01");
      tracker?.record("LOC-01", "location_normalization", "Full state name to code", {
        before: { state }, after: { normalizedState: code },
      });
    }
  }

  // LOC-02 — Country name variants → standard ISO code
  if (country) {
    const std = COUNTRY_VARIANTS.get(country.toLowerCase());
    if (std) {
      normalizedCountry = std;
      rulesApplied.push("LOC-02");
      tracker?.record("LOC-02", "location_normalization", "Country name variants to standard", {
        before: { country }, after: { normalizedCountry: std },
      });
    } else if (country.length === 2) {
      normalizedCountry = country.toUpperCase();
    }
  }

  // LOC-03 — City casing fix
  if (city) {
    const fixed = titleCase(city.toLowerCase());
    if (fixed !== city) {
      normalizedCity = fixed;
      rulesApplied.push("LOC-03");
      tracker?.record("LOC-03", "location_normalization", "City casing fix", {
        before: { city }, after: { normalizedCity: fixed },
      });
    }
  }

  // LOC-04 / LOC-05 / LOC-06 — Geocoordinates lookup
  if (normalizedCity || normalizedState) {
    const key = [
      normalizedCity.toLowerCase(),
      normalizedState.toLowerCase(),
      normalizedCountry.toLowerCase(),
    ].join(",");

    const coords = CITY_COORDS.get(key);
    if (coords) {
      latitude = coords.lat;
      longitude = coords.lng;
      rulesApplied.push("LOC-04");
      tracker?.record("LOC-04", "location_normalization", "Attach geocoordinates", {
        before: { city: normalizedCity, state: normalizedState, country: normalizedCountry },
        after: { latitude, longitude },
      });
    } else {
      rulesApplied.push("LOC-05");
      tracker?.record("LOC-05", "location_normalization", "Unknown city/state combo — skip geocode", {
        before: { city: normalizedCity, state: normalizedState, country: normalizedCountry },
        after: { latitude: null, longitude: null },
      });
    }
  }

  return { normalizedState, normalizedCity, normalizedCountry, latitude, longitude, rulesApplied };
}
