/* ============================================================
   PWA Install Gatekeeper — app.js  (standard, framework-free)
   ------------------------------------------------------------
   State machine:
     • standalone (installed)  → show #app-content, hide #install-screen
     • browser mode            → hide #app-content, show #install-screen
         – Chrome/Edge/Brave…  → bind captured `beforeinstallprompt`
                                 to #gk-install-button
         – iOS Safari          → step-by-step "Add to Home Screen"
                                 instructions (no install button)
         – other/unsupported   → manual desktop instructions
   The initial show/hide is applied pre-paint by a tiny inline
   script in index.html (sets <html data-mode>); this file owns
   everything after that.
   ============================================================ */
(function () {
  'use strict'

  var SESSION_KEY = 'my-obligations:gate'
  var GRACE_MS = 2500

  var html = document.documentElement

  // وصل السكربت ⇒ لا حاجة للحارس الزمني الذي نصّبه index.html
  window.__gkReady = true
  if (window.__gkWatchdog) {
    clearTimeout(window.__gkWatchdog)
    window.__gkWatchdog = null
  }

  var screenEl = document.getElementById('install-screen')
  var installBtn = document.getElementById('gk-install-button')
  var continueBtn = document.getElementById('gk-continue')
  if (!screenEl || !installBtn || !continueBtn) return

  /* decorative stylesheet (precached by the SW; critical state CSS is inline) */
  if (!document.getElementById('gk-style')) {
    var link = document.createElement('link')
    link.id = 'gk-style'
    link.rel = 'stylesheet'
    link.href = './gatekeeper/style.css'
    document.head.appendChild(link)
  }

  /* ---------- detection ---------- */
  function mq(query) {
    return window.matchMedia ? window.matchMedia(query) : null
  }
  var mqStandalone = mq('(display-mode: standalone)')
  var mqWCO = mq('(display-mode: window-controls-overlay)')

  function isStandalone() {
    return Boolean(
      (mqStandalone && mqStandalone.matches) ||
        (mqWCO && mqWCO.matches) ||
        window.navigator.standalone === true,
    )
  }

  function isIOSSafari() {
    var ua = window.navigator.userAgent || ''
    var iDevice =
      /iPhone|iPad|iPod/i.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
    if (!iDevice) return false
    var webkit = /WebKit/i.test(ua)
    var thirdParty = /CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua)
    return webkit && !thirdParty
  }

  /* ---------- helpers ---------- */
  function setUI(mode) {
    screenEl.setAttribute('data-ui', mode)
  }

  function reveal(reason) {
    dismiss('dismissed', reason, true)
  }

  /* فتح بلا تسجيل: من فقد الشبكة يفتح التطبيق فورًا، وإذا عادت الشبكة في زيارة
     لاحقة تُمنح البوابة فرصتها — فلا نطالب بالإنترنت إلا عند الضرورة. */
  function revealOffline() {
    dismiss('offline', 'offline', false)
  }

  function dismiss(attr, reason, remember) {
    html.setAttribute('data-gate', attr)
    if (remember) {
      try {
        window.sessionStorage.setItem(SESSION_KEY, 'dismissed')
      } catch {
        /* private mode — ignore */
      }
    }
    setUI('done')
    window.dispatchEvent(new CustomEvent('pwa:gate-revealed', { detail: { reason: reason } }))
  }

  function isDismissed() {
    var g = html.getAttribute('data-gate')
    return g === 'dismissed' || g === 'offline'
  }

  /* ---------- beforeinstallprompt ---------- */
  var deferred = window.__gkDeferred || null // captured by the inline head script

  function bindPrompt(event) {
    deferred = event
    setUI('prompt')
    window.dispatchEvent(new CustomEvent('pwa:installprompt', { detail: event }))
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault()
    bindPrompt(event)
  })

  installBtn.addEventListener('click', function () {
    if (!deferred) return
    var used = deferred
    deferred = null
    var result = used.prompt()
    if (result && typeof result.catch === 'function') result.catch(function () {})
    Promise.resolve(used.userChoice)
      .catch(function () {
        return { outcome: 'dismissed' }
      })
      .then(function (choice) {
        if (choice && choice.outcome === 'accepted') reveal('accepted')
        else reveal('prompt-dismissed')
      })
  })

  continueBtn.addEventListener('click', function (event) {
    event.preventDefault()
    reveal('continue')
  })

  // انقطعت الشبكة ونحن على البوابة ⇒ لا نترك التطبيق معلَّقًا
  window.addEventListener('offline', function () {
    if (!isDismissed()) revealOffline()
  })

  window.addEventListener('appinstalled', function () {
    window.dispatchEvent(new CustomEvent('pwa:installed'))
    reveal('installed')
  })

  // if the OS flips to standalone while we sit on the gate (e.g. after install)
  function watchMode(m) {
    if (!m) return
    var onChange = function (ev) {
      if (ev.matches) {
        html.setAttribute('data-mode', 'standalone')
        reveal('standalone')
      }
    }
    if (typeof m.addEventListener === 'function') m.addEventListener('change', onChange)
    else if (typeof m.addListener === 'function') m.addListener(onChange)
  }
  watchMode(mqStandalone)
  watchMode(mqWCO)

  /* ---------- boot ---------- */
  if (isStandalone()) {
    html.setAttribute('data-mode', 'standalone')
    return
  }

  html.setAttribute('data-mode', 'browser')
  if (window.navigator.onLine === false) {
    revealOffline()
    return
  }
  if (isDismissed()) return

  if (deferred) {
    setUI('prompt')
    return
  }

  if (isIOSSafari()) {
    setUI('ios')
    return
  }

  // Desktop / other: give the browser a grace period to fire
  // beforeinstallprompt, otherwise fall back to manual instructions.
  setUI('loading')
  window.setTimeout(function () {
    if (deferred || isStandalone() || isDismissed()) return
    setUI(screenEl.getAttribute('data-ui') === 'prompt' ? 'prompt' : 'manual')
  }, GRACE_MS)
})()
