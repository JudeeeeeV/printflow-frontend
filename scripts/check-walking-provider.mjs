// Public Berlin example points from the OSRM documentation; no device location.
const url = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/13.388860,52.517037;13.397634,52.529407?overview=full&geometries=geojson&radiuses=200;200';
const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'PrintFlow-development-routing-check' } });
const data = await response.json();
console.log(JSON.stringify({ status: response.status, cors: response.headers.get('access-control-allow-origin'), code: data.code, geometry: data.routes?.[0]?.geometry?.type, points: data.routes?.[0]?.geometry?.coordinates?.length }));
if (!response.ok || data.code !== 'Ok' || data.routes?.[0]?.geometry?.type !== 'LineString') process.exitCode = 1;
