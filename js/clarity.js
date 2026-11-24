// Microsoft Clarity (heatmaps and session replays). Paste the project ID from clarity.microsoft.com between the quotes.
// Left empty, nothing loads. The lead form and calculator are marked data-clarity-mask so what people type is never recorded.
(function (id) {
  if (!id || /^\/admin/.test(location.pathname)) return;
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', id);
})('ziupqsb0p7');
