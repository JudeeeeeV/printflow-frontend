# Shop maps

Before deploying this frontend and backend, apply
`printflow-backend/supabase/migrations/20260924_shop_locations.sql` to Supabase
using the project's normal migration process or SQL editor. It adds nullable
address, description and coordinate columns and enforces a valid coordinate pair.
Existing shops have no pin until staff set one in **Shop Settings** and save.

For storefront photos, also apply
`printflow-backend/supabase/migrations/20260924010000_shop_photos.sql` before
deploying the updated API. The backend creates the private `shop_photos` bucket
on first upload. In **Shop Settings → Shop photo**, choose a JPEG, PNG or WebP
(up to 5 MB / 20 megapixels), review the preview, and click **Upload Photo**.
The upload publishes immediately, separately from **Save Changes** for the pin.
Students see the photo, shop name and address when hovering over the pin or
clicking/tapping it; keyboard users can focus the pin and press Enter or Space.
Shop settings use the same popup to preview the published photo.

Photos are decoded, resized to at most 1600 × 1600, converted to WebP and stripped
of metadata on the server. Original filenames and arbitrary photo URLs are never
stored. Only authenticated shop accounts can upload to their own shop; uploads
are limited to 10 per hour per IP. Replacement uses a conditional database update
to handle concurrent uploads and removes unused objects. Browser access to the
private bucket is denied even if older broad storage policies exist. Public shop
listings expose signed photo URLs valid for one hour, not raw storage paths;
refresh the page if a photo URL expires. A photo does not verify a shop's identity.

Then apply `printflow-backend/supabase/migrations/20260924_shop_locations_security.sql`.
This preserves the backend-only database access model and removes legacy browser
write grants on location columns. It must run after the location-column migration.

In **Shop Settings → Pickup location**, click **Set location on map** or
**Edit location** to open the map modal. Click the map, drag the pin,
use **Place pin at map center**, or click the location arrow to place a pin at
the device's current position with permission. Check the entrance, then click
**Apply location**, then **Save Changes** on the settings page. Cancel, Escape,
the close button, and clicking the backdrop discard changes made in the modal.
The settings card shows whether the pin has unsaved changes. Location
lookup does not publish anything automatically. Exact coordinates are available
in an expandable section, and **Remove map pin** takes effect only after saving.

Writes go through `PATCH /shops/me`: Supabase validates the session, the server
loads the role, and only CLERK/MANAGER accounts can update their own shop row.
The API rejects supplied shop IDs, role/verification fields, invalid numbers and
incomplete coordinate pairs. Saves are limited to 20 per minute per IP by the
existing global rate limiter. The existing origin checks protect cookie-based
writes. No new database privileges are granted to browser sessions.

Clicking a shop in a new order or draft selects it and smoothly expands its
pickup location card directly beneath that shop. Clicking it again collapses
the details while keeping it selected for the order. Only one card expands at
a time; changing pages collapses details without changing the selected shop.
Shop selection keeps the page in place instead of jumping to the upload section.
Click **View on map** to open its map modal. Students can pan,
zoom, enable the location-arrow control to follow their live device position,
or click **Get directions** to request their current position and draw a walking
route in the map. A previously granted permission is reused by the browser;
denied permission needs to be changed in browser settings. The route shows a
starting-location marker, distance, and estimated walking time. Dotted links
connect the exact device/shop position to the nearest mapped path and are not
verified walkways. **Refresh directions** requests a new starting position;
this is a route preview, not automatic turn-by-turn navigation. Closing the modal
or cancelling aborts outstanding route requests and clears the position watch.
Google Maps remains an explicitly clicked fallback if routing fails.
The map loads only after an explicit open action, for students and shop staff.
The modal keeps actions visible with a scrollable body on small screens, traps
focus using a native dialog, locks background scrolling, and restores focus to
the opener on close. Shop settings stack on mobile and use two columns on desktop.
Location permission is requested only when the location control or directions
button is clicked. PrintFlow does not send student coordinates to its API or
store them. Routing sends origin and destination directly to the routing provider,
as disclosed next to **Get directions**. Device geolocation
requires HTTPS (or localhost), permission and device/browser support.

Maps use MapLibre GL JS and OpenFreeMap's Liberty style, with provider attribution
retained. Map resources are requested from the tile provider. To use another
provider, set `VITE_MAP_STYLE_URL` to its MapLibre-compatible style URL and rebuild.
Only public browser-safe configuration belongs in Vite environment variables.

Walking routes default to FOSSGIS's public OSRM foot endpoint. Its public service
is limited to light use and one request per second; the client prevents rapid
repeated requests within a tab and makes no background route polls. For production
traffic, configure a dedicated OSRM-compatible **walking** provider using
`VITE_WALKING_ROUTE_URL` (complete endpoint through `/route/v1/driving`, with no
coordinate suffix or query string). The route profile is determined by the
provider's server, not the word `driving` in this OSRM compatibility path. Rebuild
after configuration. The service must support browser CORS. Do not put private
API keys in Vite variables. Provider requests have a 15-second timeout and
locations must be within 200 metres of a routable path.

Provider policy and privacy: https://routing.openstreetmap.de/about.html
Routing tests: `node --test scripts/directions.test.mjs`.
Optional live check using public example coordinates:
`node scripts/check-walking-provider.mjs`.

References: https://openfreemap.org/quick_start/ and
https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/

Verification: select two different shops and check each pin/address; test a shop
without coordinates; allow and deny location access; hide and reopen the map;
check mobile layout; set, save, reload and clear an owner pin. Map rendering
requires WebGL and network access to the tile provider.
