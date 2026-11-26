'use strict';
(() => {
  // Intake answers are neither persisted nor sent to analytics.
  const intake = document.querySelector('#intake');
  if (intake) {
    const submit = document.querySelector('#send-request');
    const status = document.querySelector('#form-status');
    submit.disabled = false;
    intake.dataset.transportReady = 'true';
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

  // Preserve the existing three measurement services, with explicit opt-in,
  // no intake/receipt loading, no session replay and no free-text events.
  const consentKey = 'techdad-analytics';
  const status = document.querySelector('#analytics-status');
  const allow = document.querySelector('#analytics-allow');
  const off = document.querySelector('#analytics-off');
  const privatePage = /\/(Intakeform|ThankYou|stack-builder)\.html$/i.test(location.pathname);
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
