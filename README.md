# PrintFlow - Student and Shop Portal

## 1. Project Description

This React application is PrintFlow's shared web portal for students and print-shop operators. Students prepare documents, choose a shop, submit/pay for orders, and track fulfillment. Operators review their live queue, verify payments, manage printing, and maintain shop settings.

It communicates with the NestJS backend for business operations and with Supabase Auth for registration, verification, and password recovery. Administrators use a separate application.

## 2. Features and Responsibilities

- Create New Order with availability, nearest-shop sorting, five-shop pagination, file preview, and print settings.
- Save/edit drafts and track submitted orders.
- Local file checks with actionable feedback; definitive validation and DOCX conversion occur on the backend during submit/save.
- GCash receipt submission/review and cash-on-pickup workflows.
- Shop Live Queue, Analytics, Printer Agent, and Settings workspaces.
- Printer discovery and reviewed batch dispatch through registered Windows computers.
- Email verification, password recovery, optional Turnstile, and optional CIT Microsoft sign-in through the backend.
- Live API data events and printer-related Socket.IO communication.

| Important path                                                                                                               | Responsibility                                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/main.tsx`, `src/App.tsx`                                                                                                | Startup, routes, and role-specific workspaces.                     |
| `src/pages/AuthPage/`, `src/pages/NewOrderPage/`                                                                             | Authentication and student order preparation/tracking.             |
| `src/pages/ShopDashboard/`, `src/pages/ShopAnalyticsPage/`, `src/pages/ShopPrinterAgentPage/`, `src/pages/ShopSettingsPage/` | Operator workspaces.                                               |
| `src/components/`, `src/hooks/`, `src/services/`                                                                             | Shared UI, hooks, API clients, and preparation/recovery utilities. |
| `src/config/runtime.ts`, `src/lib/supabaseClient.ts`                                                                         | Backend, CAPTCHA, and Supabase browser configuration.              |

## 3. Technology Stack

| Area         | Technologies                                                        |
| ------------ | ------------------------------------------------------------------- |
| Application  | React 19, TypeScript, Vite 8, React Router.                         |
| UI           | Tailwind CSS 4, Carbon icons, Framer Motion, IBM Plex Sans styling. |
| Integrations | Supabase JS, Socket.IO client, MapLibre, Recharts, `pdf-lib`.       |
| Validation   | TypeScript build, ESLint, Node test-runner regressions.             |

File checks do not provide AI or 300-DPI certification. Optional shop-permit AI review belongs to the backend/admin workflow.

## 4. Prerequisites

- Git, npm, and **Node.js `>=24.14.1 <25`**.
- A running [PrintFlow backend](https://github.com/JudeeeeeV/printflow-backend#5-installation-and-local-setup).
- The same initialized **development Supabase project** as the backend and its browser-safe public key. This checkout does not initialize a database.
- Supabase email/password authentication, confirmation/recovery delivery, and approved redirect settings.
- A Windows agent only for actual shop printing, not for building the web application.

## 5. Installation and Local Setup

```bash
git clone https://github.com/JudeeeeeV/printflow-frontend.git
cd printflow-frontend
npm install
```

Create a local `.env` in the repository root using the inline configuration in Section 6. If it already exists, update only the required settings; do not overwrite unrelated values. Keep this local file out of Git.

Set `VITE_API_URL=http://localhost:3000` explicitly for development. Without it, the runtime falls back to the configured deployed API; avoid accidentally targeting production.

Start the backend in a separate terminal, then run:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite can choose another port if 5173 is occupied. Use its printed address and update backend `FRONTEND_URL` accordingly, or free the intended port.

## 6. Environment Variables

Use this inline example to configure your local `.env`; replace the Supabase placeholders privately:

```dotenv
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=replace-with-your-browser-safe-public-key
# Conditional CAPTCHA setting; blank disables the widget.
VITE_TURNSTILE_SITE_KEY=
# Optional map/routing overrides; blank keeps the built-in providers.
VITE_MAP_STYLE_URL=
VITE_WALKING_ROUTE_URL=
```

These are **build-time browser settings**: restart Vite after local changes and rebuild/redeploy static hosting after production changes.

| Variable                  | Requirement and purpose                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`            | Set explicitly per environment. Backend origin without `/admin` or a trailing path; local value `http://localhost:3000`.                                              |
| `VITE_SUPABASE_URL`       | Required by the browser client. Use the initialized development project's URL locally.                                                                                |
| `VITE_SUPABASE_ANON_KEY`  | Required browser-safe public/publishable or compatible legacy `anon` key supplied by the maintainer; never a service-role/secret key.                                 |
| `VITE_TURNSTILE_SITE_KEY` | Conditional public Cloudflare site key. Blank disables the widget; coordinate enabled CAPTCHA with backend `TURNSTILE_SECRET_KEY` and Supabase Auth CAPTCHA settings. |
| `VITE_MAP_STYLE_URL`      | Optional MapLibre style URL; blank uses the built-in OpenFreeMap style.                                                                                               |
| `VITE_WALKING_ROUTE_URL`  | Optional walking-route service URL; blank uses the configured OpenStreetMap routing endpoint.                                                                         |

Never put backend `JWT_SECRET`, `TOTP_ENCRYPTION_KEY`, Microsoft provider secrets, or `SUPABASE_SERVICE_ROLE_KEY` into a `VITE_` setting. Vite includes these values in browser JavaScript. See [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

The backend must allow the exact frontend origin for credentialed requests. `/index.html` is not part of an origin. Optional Microsoft login additionally needs the backend's [Microsoft setup](https://github.com/JudeeeeeV/printflow-backend/blob/main/docs/MICROSOFT_LOGIN.md).

## 7. Running and Building the Application

| Command               | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `npm run dev`         | Vite development server, normally port 5173.                            |
| `npm run build`       | TypeScript checks and production build into `dist/`.                    |
| `npm run preview`     | Preview the build, normally port 4173; not an API or production server. |
| `npm test`            | Existing Node regression suites.                                        |
| `npm run test:daemon` | Focused daemon client tests.                                            |
| `npm run lint`        | ESLint validation.                                                      |

```bash
npm run build
npm run preview
```

For authenticated preview requests, configure the backend to allow the preview origin. A frontend build does not validate migrations, email delivery, payments, or physical printer output.

## 8. Deployment

- **Student/shop portal:** [Open PrintFlow](https://printflow-frontend-aje0.onrender.com/index.html).
- **Configured backend:** [PrintFlow API](https://printflow-backend-wen3.onrender.com); awaiting team confirmation as the official production endpoint. Its [health endpoint](https://printflow-backend-wen3.onrender.com/health) responded successfully during the November 10, 2026 documentation check.

[`render.yaml`](render.yaml) defines a **Render Static Site**: `npm ci && npm run build`, publish `dist`, rewrite application routes to `/index.html`, and Node.js 24.14.1. Configure required `VITE_` settings in the Render build environment, not a committed `.env` file.

Changing API hosts or map/routing providers also requires reviewing Content-Security-Policy `connect-src`, image, and worker permissions in the blueprint. Set backend `FRONTEND_URL` to this site's HTTPS origin and coordinate Supabase redirects, CAPTCHA, and the compatible backend release.

## 9. Related Repositories

- [Project overview](https://github.com/JudeeeeeV/printflow)
- [Student and shop frontend](https://github.com/JudeeeeeV/printflow-frontend)
- [Backend API and Windows printer agent](https://github.com/JudeeeeeV/printflow-backend)
- [Administrator portal](https://github.com/JudeeeeeV/printflow-admin)

## Contributors

- Jude Mikael Valencia
- Karol Vincent Bebedor
- Noeh Arbee Boiser
- Aldrin Suse
