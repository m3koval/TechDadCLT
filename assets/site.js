'use strict';
(() => {
  // Intake answers are neither persisted nor sent to analytics.
  const intake = document.querySelector('#intake');
  if (intake) {
    const submit = document.querySelector('#send-request');
    const status = document.querySelector('#form-status');
    submit.disabled = false;
    let pending = false;
    intake.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending) return;
      for (const control of intake.querySelectorAll('input[required], textarea[required]')) {
        control.setCustomValidity(control.value.trim() ? '' : 'Please enter a value, not only spaces.');
        control.addEventListener('input', () => control.setCustomValidity(''), { once: true });
      }
      if (!intake.reportValidity()) return;
      pending = true;
      submit.disabled = true;
      submit.textContent = 'Sending request…';
      status.textContent = 'Sending your assessment request…';
      const fields = ['name', 'email', 'area', 'phone', 'who_for', 'main_concern'];
      const values = new FormData(intake);
      const body = Object.fromEntries(fields.map(key => [key, String(values.get(key) || '').trim()]));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(intake.action, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'
        });
        if (!response.ok) throw new Error('Provider did not confirm acceptance');
        try { sessionStorage.setItem('techdad-request-accepted', 'yes'); } catch (_) { /* acknowledgment still has truthful fallback */ }
        window.location.assign('/ThankYou.html');
      } catch (_) {
        status.textContent = 'We couldn’t confirm your submission. Your answers are still here. Please call (980) 399-6020 if you’re unsure whether it went through, or try again.';
        pending = false;
        submit.disabled = false;
        submit.textContent = 'Try sending again';
      } finally { clearTimeout(timeout); }
    });
  }
  if (document.querySelector('#thanks-message')) {
    try {
      if (sessionStorage.getItem('techdad-request-accepted') === 'yes') {
        document.querySelector('#thanks-title').textContent = 'Thanks for reaching out.';
        document.querySelector('#thanks-message').textContent = 'Your assessment request has been submitted. We’ll contact you to discuss the next step and arrange a time. Your appointment is not booked yet.';
        sessionStorage.removeItem('techdad-request-accepted');
      }
    } catch (_) { /* leave the direct-visit wording in place */ }
  }

  // All vendor display facts come from the same source used by the comparison.
  const finder = document.querySelector('#finder');
  if (finder) {
    let facts;
    const result = document.querySelector('#finder-result');
    const add = (tag, text, parent = result, className = '') => {
      const node = document.createElement(tag); node.textContent = text;
      if (className) node.className = className;
      parent.append(node); return node;
    };
    const link = (text, href, parent = result) => {
      const node = add('a', text, parent, 'text-link'); node.href = href; return node;
    };
    finder.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = finder.querySelector('button');
      if (submit.disabled) return;
      submit.disabled = true;
      try {
        if (!facts) {
          const response = await fetch('/assets/products.json', { credentials: 'omit' });
          if (!response.ok) throw new Error('Facts unavailable');
          facts = await response.json();
        }
        const byId = Object.fromEntries(facts.products.map(p => [p.id, p]));
        const values = new FormData(finder);
        const household = values.get('household'), device = values.get('device'), goal = values.get('goal'), sync = values.get('sync');
        result.replaceChildren();
        add('span', 'Your starting point · not a purchase recommendation', result, 'eyebrow');
        if (household === 'adult') {
          add('h2', 'Confidence before subscriptions.');
          add('p', 'Start with updates, unique passwords, account recovery and explicitly enrolled two-step verification or suitable passkeys. Review supported call filtering and practice a known-number callback routine.');
          add('p', 'Agree directly with the adult on changes and any sharing. Child-supervision tools are not the default for an independent adult, even if a relative pays for help.');
          if (goal === 'messages') add('p', 'Do not install message monitoring without informed consent. Agree on a specific concern and the least intrusive way to address it; a supported alert is not a complete transcript or fraud guarantee.');
          if (goal === 'web') add('p', 'For a self-directed content-filtering goal, review your exact device and accessibility needs first. A web filter is not scam-proof browsing or an all-app monitor.');
          add('h3', 'If a financial-alert gap remains');
          add('p', 'Discuss bank-native alerts first. Optional tools such as EverSafe or Aura have different account, consent, plan and insurance requirements. No subscription is required to start with safer habits.');
          link('Review optional adult tools →', '/solutions-comparison.html#senior');
        } else {
          const nativeMap = { ios: 'apple', mac: 'apple', android: 'google', chrome: 'google', windows: 'microsoft', xbox: 'microsoft' };
          const nativeIds = device === 'mixed' ? ['apple', 'google', 'microsoft'] : nativeMap[device] ? [nativeMap[device]] : [];
          add('h2', nativeIds.length ? 'Build on the native controls.' : 'Identify the device before buying.');
          if (nativeIds.length) nativeIds.forEach(id => {
            const p = byId[id]; add('h3', p.name); add('p', p.coverage); add('p', p.limits);
          });
          else add('p', 'Identify the model, OS version and child account first. For Fire tablets, consoles and shared TVs, review the manufacturer’s own family settings. We cannot infer coverage from a parent’s phone.');
          let optional = null;
          if (goal === 'messages' && ['ios','android','mixed'].includes(device)) optional = byId.bark;
          if (goal === 'web' && ['ios','mac','android','chrome','windows','mixed'].includes(device)) optional = byId.canopy;
          if (goal === 'messages' && ['mac','chrome','windows','xbox'].includes(device)) add('p', 'This device choice does not establish supported device-message scans. First identify the messaging app and any linked mobile device or cloud account; do not buy a monitoring subscription on the assumption it reads every chat here.');
          if (device === 'xbox' && goal === 'web') add('p', 'A phone or desktop filtering app is not an Xbox filter. Start with Microsoft’s supported family controls and review your existing router only for network-access needs.');
          if (optional) {
            const card = add('div', '', result, 'result-product');
            add('span', 'One optional candidate—not an added stack', card, 'eyebrow');
            add('h3', optional.name, card);
            add('p', optional.coverage, card);
            add('p', optional.price, card);
            add('p', optional.billing, card);
            add('p', optional.devices, card);
            add('p', optional.limits, card);
            if (optional.id === 'bark' && ['ios','mixed'].includes(device)) {
              add('p', sync === 'yes' ? 'iOS: check the existing computer against Bark’s requirements and establish when it will be available to scan. Do not assume off-network scans are continuous.' : 'iOS: without a confirmed compatible computer, device-content alerts require another supported collection method, such as optional Bark Sync. Confirm its separate cost and workflow before buying. Filtering alone does not create message scans.', card);
            }
            if (optional.id === 'canopy') add('p', 'Choose the tier by the number of supported devices, and verify OS compatibility before subscribing. The quoted monthly amounts are annual-billing equivalents; no annual invoice has been calculated from them.', card);
            link('Read the official product details →', optional.source, card);
          } else {
            add('h3', 'No paid filter recommended by default.');
            add('p', goal === 'scams' ? 'For suspicious calls or account risks, focus on recovery, passkeys/two-step verification, updates and callback habits. A child content filter is not a complete fraud defense.' : 'Set app approvals, content rules and time schedules, then test the important scenarios before deciding something is missing.');
          }
          if (household === 'mixed') {
            add('h3', 'A separate adult track');
            add('p', 'For adults, use consent-led account safety and scam-response habits, not the child’s supervision rules. Discuss any financial-alert sharing directly with the adult.');
          }
        }
        add('h3', 'What still needs checking');
        add('p', 'Test on the actual device: home Wi-Fi, cellular where applicable, restart, profile/removal settings and alert delivery. Keep existing router controls where useful. Do not combine consumer VPN-based filters without explicit vendor-supported compatibility.');
        add('p', `Product snapshot: ${facts.checked}. ${facts.basis} TechDad implementation is quoted separately; hardware and subscriptions are separate.`, result, 'small');
        link('Compare all tools and limitations →', '/solutions-comparison.html');
        const action = add('div', '', result, 'actions');
        const cta = add('a', 'Discuss this in a free assessment →', action, 'button'); cta.href = '/Intakeform.html';
        result.focus({ preventScroll: true });
      } catch (_) {
        result.replaceChildren();
        add('h2', 'The product details could not load.');
        add('p', 'Nothing has been sent or saved. Use the static comparison or try again.');
        link('Read the comparison →', '/solutions-comparison.html');
      } finally { submit.disabled = false; }
    });
  }

  // Preserve the existing three measurement services, with explicit opt-in,
  // no intake/receipt loading, no session replay and no free-text events.
  const consentKey = 'techdad-analytics';
  const status = document.querySelector('#analytics-status');
  const allow = document.querySelector('#analytics-allow');
  const off = document.querySelector('#analytics-off');
  const privatePage = /\/(Intakeform|ThankYou)\.html$/i.test(location.pathname);
  const privacySignal = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  let enabled = false;
  try { enabled = localStorage.getItem(consentKey) === 'yes'; } catch (_) { /* off by default */ }
  const safePage = !privatePage && !location.search && !location.hash && !privacySignal;
  const describe = () => {
    if (status) status.textContent = privacySignal ? 'Optional analytics are off for your browser privacy preference.' : privatePage ? 'Optional analytics never load on this request page.' : enabled ? 'Optional analytics allowed. You can turn them off here.' : 'Optional analytics are off.';
    if (allow) allow.hidden = enabled || privacySignal || privatePage;
    if (off) off.textContent = enabled ? 'Turn analytics off' : 'Keep analytics off';
  };
  const load = src => { const script = document.createElement('script'); script.src = src; script.async = true; document.head.append(script); return script; };
  if (enabled && safePage) {
    const cleanURL = location.origin + location.pathname;
    window.va = window.va || function (...args) { (window.vaq = window.vaq || []).push(args); };
    window.si = window.si || function (...args) { (window.siq = window.siq || []).push(args); };
    const sanitize = event => ({ ...event, url: cleanURL, referrer: '' });
    window.va('beforeSend', sanitize); window.si('beforeSend', sanitize);
    load('/_vercel/insights/script.js'); load('/_vercel/speed-insights/script.js');
    const analytics = load('https://us.i.posthog.com/static/array.js');
    analytics.onload = () => {
      if (!window.posthog || typeof window.posthog.init !== 'function') return;
      window.posthog.init('phc_Cp4Ph3JUfeN63Mc2do2iLX4cVfU8HZdoznGbotcBZBUQ', {
        api_host: 'https://us.i.posthog.com', person_profiles: 'identified_only', autocapture: false,
        request_batching: false, advanced_disable_feature_flags: true, persistence: 'memory',
        capture_pageview: false, capture_pageleave: false, disable_session_recording: true,
        disable_surveys: true, disable_external_dependency_loading: true,
        save_referrer: false, store_google: false,
        property_denylist: ['$referrer', '$referring_domain', '$initial_referrer', '$initial_referring_domain', '$initial_current_url'],
        before_send: event => {
          if (!event || event.event !== '$pageview') return null;
          const permitted = ['token', 'distinct_id', '$device_id', '$lib', '$lib_version', '$browser', '$browser_version', '$os', '$os_version', '$device_type', '$screen_height', '$screen_width', '$viewport_height', '$viewport_width', '$process_person_profile', '$session_id', '$window_id'];
          event.properties = Object.fromEntries(permitted.filter(key => key in event.properties).map(key => [key, event.properties[key]]));
          event.properties.$current_url = cleanURL;
          event.properties.$pathname = location.pathname;
          return event;
        },
        loaded: instance => instance.capture('$pageview', { $current_url: cleanURL, $pathname: location.pathname })
      });
    };
  }
  if (allow) allow.addEventListener('click', () => {
    try { localStorage.setItem(consentKey, 'yes'); location.reload(); }
    catch (_) { status.textContent = 'Your browser could not save a preference. Analytics remain off.'; }
  });
  if (off) off.addEventListener('click', () => {
    try { localStorage.setItem(consentKey, 'no'); } catch (_) { /* current page still reloads without in-memory permission */ }
    if (enabled) { enabled = false; location.reload(); } else describe();
  });
  describe();
})();
