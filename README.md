# TechDad CLT website

A dependency-free, generated static website. **Do not deploy the repository root.**

## Edit

- `scripts/build_pages.py`: shared navigation/footer, page copy and original HTML/CSS-stage markup. Public `.html` files are generated, checked in for familiar route continuity and local review.
- `assets/site.css`: responsive blue/ink design system, warm senior stage, opaque focal cards, acrylic layers and bounded entry motion. No continuous animation, paid media or copied Iru assets.
- `assets/site.js`: intake, local plan finder and existing-vendor analytics with opt-in.
- `data/products.json`: single editorial source of product prices, billing, platform scope, checked date, limitations and official sources. The build copies it to `assets/products.json`; comparison and finder consume the same facts.
- `scripts/build.py`: explicit public-file allowlist. Private notes, tests, source data and scripts never ship.

## Build and verify

```sh
python3 scripts/build.py
python3 scripts/test_site.py
node --check assets/site.js
python3 scripts/test_browser.py
python3 scripts/test_analytics.py
```

The build/static tests need Python standard library only. Browser tests additionally use Python Playwright and its Chromium install. The analytics check needs network access to download the **real existing vendor scripts**; all analytics collection requests are intercepted before transmission. It overrides the PostHog automation/bot filter **only inside the test**, then invokes the site's real configured load callback. It does not enable bot capture in production. It validates the actual decoded PostHog pageview and revocation. Local Vercel runtime loading is checked, but hosted ingestion/dashboard reporting is not verified here.

`test_browser.py` creates and closes its own loopback-only server. Its Formspark calls are intercepted: 400, 429, 500, success and transport failure are simulated responses, **not real provider acceptance or inbox delivery tests**. Never remove interception to test production without separate authorization. It also covers all route layouts, finder permutations, no-JS essentials, reduced motion, data-load failure and analytics exclusions. Evidence is written to ignored `qa/`, outside the build.

Local preview:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

## Preserved contracts

- Existing public HTML routes retained, plus `kids.html`, `seniors.html`, `privacy.html` and `/blog/`.
- Existing `https://submit-form.com/rkMLUXlZj` action; successful navigation only after `response.ok`. An acceptance marker contains no intake answers. A direct receipt-page visit does not claim a submission.
- Shared exact-once linked `Built by AMP IT LLC` credit remains governed by the existing footer generator/tests.
- Existing PostHog project, Vercel Analytics and Speed Insights only. No new analytics vendors. Consent defaults off; no runtime on intake/receipt or parameterized/hash URLs. No autocapture, replay, custom form events or persistent PostHog identity. Pageview properties are explicitly allowlisted, including the ingestion-required token.
- Existing visible phone `(980) 399-6020` and email retained. The old malformed masked `tel:`/schema token was replaced using the separately displayed complete phone number, not guessed digits.
- Approximately 45-minute free onsite assessment only. Quoted implementation, hardware and subscriptions remain separate. No new labor prices, subscription plans, staffing promises, testimonials or guarantees.

## Release review

- Source/product review is based on the supplied November 25, 2026 official-source audit, not checkout or installed-product testing. Seasonal pricing and exact OS support must be rechecked before purchases. Unknown renewal prices remain explicitly unknown; no additive coverage scores or invented totals.
- Browser checks use Chromium emulation, not physical iOS/Safari. Review service/guide/finder pages at desktop and phone sizes before release.
- Vercel output is `dist`; aliases `/index.html` and `/blog/index.html` permanently redirect to their canonical forms. www metadata/sitemap is consistent. Production host redirects, provider inbox delivery, hosted analytics and field performance require post-release checks.
- No commits, pushes or deployments are performed by these scripts. The unrelated iOS article in the other worktree is neither read nor copied into this site.
