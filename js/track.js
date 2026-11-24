// Anonymous page and visit counter for Jerry's dashboard. No cookies, no names, no numbers, no IP addresses stored.
(function () {
  function send(o) {
    try { fetch('/api/track', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }).catch(function () {}); } catch (x) {}
  }
  window.jcTrack = function (e) { send({ e: e }); };
  var first = false;
  try { if (!sessionStorage.getItem('jc-v')) { sessionStorage.setItem('jc-v', '1'); first = true; } } catch (x) { first = true; }
  var src = '', ref = '';
  try { src = new URLSearchParams(location.search).get('utm_source') || ''; } catch (x) {}
  try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (x) {}
  send({ e: 'view', p: location.pathname, v: first ? 1 : 0, r: ref, s: src });
})();
