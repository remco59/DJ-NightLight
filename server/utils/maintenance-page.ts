function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char]!)
}

/**
 * Self-contained maintenance page shown on every route while the stack is being
 * rebuilt. It polls /api/maintenance and reloads once the site is back; network
 * errors (the web container restarting) just mean "keep waiting".
 */
export function maintenancePageHtml(step: string | null) {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Even geduld — DJ NightLight</title>
<style>
@font-face{font-family:"Archivo Black";src:url("/fonts/ArchivoBlack-Regular.woff2") format("woff2");font-display:swap}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{display:grid;place-items:center;padding:1.5rem;background:radial-gradient(circle at 50% 0,#2a1740 0,#09080b 60%);color:#f6f3fa;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(100%,32rem);text-align:center}
.eyebrow{margin:0 auto .6rem;color:#b58cff;font-size:.75rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
h1{margin:0;font-family:"Archivo Black",system-ui,sans-serif;font-size:clamp(2.2rem,8vw,3.6rem);line-height:1;letter-spacing:-.04em}
p{margin:1rem auto 0;max-width:26rem;color:#aaa4b1;line-height:1.6}
.bar{position:relative;height:4px;margin:2rem auto 0;max-width:16rem;overflow:hidden;border-radius:99px;background:#2b2631}
.bar::after{content:"";position:absolute;inset:0;width:40%;border-radius:inherit;background:linear-gradient(90deg,#7c4dff,#ff4fd8);animation:slide 1.4s ease-in-out infinite}
.step{margin-top:1rem;color:#716a78;font-size:.8rem}
@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
@media (prefers-reduced-motion:reduce){.bar::after{animation:none;width:100%;opacity:.5}}
</style>
</head>
<body>
<main>
<p class="eyebrow">Onderhoud</p>
<h1>We zijn zo terug</h1>
<p>DJ NightLight wordt op dit moment bijgewerkt. Dit duurt meestal een paar minuten; deze pagina ververst vanzelf.</p>
<div class="bar" role="progressbar" aria-label="Bezig met bijwerken"></div>
<p class="step" id="step" aria-live="polite">${step ? escapeHtml(step) : ''}</p>
</main>
<script>
(function(){
  var stepEl=document.getElementById('step')
  function poll(){
    fetch('/api/maintenance',{cache:'no-store'}).then(function(r){
      if(!r.ok)throw new Error('unavailable')
      return r.json()
    }).then(function(data){
      if(!data.maintenance){location.reload();return}
      stepEl.textContent=data.step||''
      setTimeout(poll,3000)
    }).catch(function(){setTimeout(poll,3000)})
  }
  setTimeout(poll,3000)
})()
</script>
</body>
</html>`
}
