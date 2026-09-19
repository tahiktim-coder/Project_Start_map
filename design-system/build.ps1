$ErrorActionPreference = 'Stop'
$root = 'C:\Users\farha\Claude\Project_Star_Map\Project_Start_map'
$css  = Get-Content (Join-Path $root 'style.css') -Raw
$dist = Join-Path $root 'design-system\dist'
foreach ($d in @('foundations','components','screens')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $dist $d) | Out-Null
}

$fontLinks = @'
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
'@

$stageCss = @'
<style>
  html,body{height:auto;min-height:100%;overflow:auto;}
  body{padding:0;}
  .card-stage{position:relative;z-index:20;padding:28px;min-height:100%;}
  .card-stage .stage-title{font-family:var(--font-display);color:var(--color-primary-dim);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;}
  .swatch-row{display:flex;flex-wrap:wrap;gap:14px;}
  .swatch{width:120px;}
  .swatch .chip{height:60px;border:1px solid rgba(255,255,255,.15);border-radius:4px;}
  .swatch .lbl{font-family:var(--font-mono);font-size:11px;color:var(--color-text);margin-top:6px;text-transform:uppercase;letter-spacing:1px;}
  .swatch .val{font-family:var(--font-mono);font-size:10px;color:var(--color-text-dim);}
</style>
'@

function Build($path, $group, $bodyMarkup, $extraHead) {
  if ($null -eq $extraHead) { $extraHead = '' }
  $card  = '<!-- @dsCard group="' + $group + '" -->' + "`n"
  $card += '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' + "`n"
  $card += $fontLinks + "`n"
  $card += '<style>' + "`n" + $css + "`n" + '</style>' + "`n"
  $card += $stageCss + "`n" + $extraHead + "`n"
  $card += '</head><body>' + "`n"
  $card += '<div class="crt-overlay"></div><div class="vignette"></div>' + "`n"
  $card += $bodyMarkup + "`n</body></html>"
  $full = Join-Path $dist $path
  [System.IO.File]::WriteAllText($full, $card, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "wrote $path"
}

# Reusable ship-hull markup
$shipHull = @'
<div class="ship-hull">
  <div class="ship-deck deck-bridge"><div class="deck-label">BRIDGE</div><div class="deck-sub">NAV / COMMS</div></div>
  <div class="ship-deck deck-lab"><div class="deck-label">LABORATORY</div><div class="deck-sub">SCAN / BIO</div></div>
  <div class="ship-deck deck-quarters"><div class="deck-label">CREW QUARTERS</div><div class="deck-sub">REST / MORGUE</div>
    <div class="deck-crew-status"><span class="crew-dot healthy"></span><span class="crew-dot injured"></span><span class="crew-dot stressed"></span><span class="crew-dot dead"></span></div>
  </div>
  <div class="ship-deck deck-cargo"><div class="deck-label">CARGO HOLD</div><div class="deck-sub">SALVAGE / STORAGE</div></div>
  <div class="ship-deck deck-engineering deck-damaged"><div class="deck-label">ENGINEERING</div><div class="deck-sub">PROBES / DRIVES</div></div>
  <div class="ship-deck deck-upgrades"><div class="deck-label">FABRICATION</div><div class="deck-sub">UPGRADES</div></div>
</div>
'@

# Reusable status-bar markup
$statusBar = @'
<header class="status-bar" style="position:relative">
  <div class="ship-info">
    <span class="vessel-name">VESSEL: EXODUS-9</span>
    <span class="sector-name" style="color:var(--color-accent);font-size:0.85em;">/// SECTOR 1: THE GRAVEYARD</span>
    <span class="date">DATE: 2342.05.12</span>
  </div>
  <div class="resource-cluster">
    <div class="res-item"><label>ENERGY</label><span>100%</span></div>
    <div class="res-item"><label>SALVAGE</label><span>50</span></div>
    <div class="res-item"><label>RATIONS</label><span>20</span></div>
    <div class="res-item"><label>DATA</label><span>0</span></div>
  </div>
  <button style="background:#000;border:1px solid var(--color-primary-dim);color:var(--color-primary-dim);font-family:var(--font-mono);padding:2px 10px;font-size:0.8em;opacity:0.6;">&#9834; AUDIO</button>
</header>
'@

# ---------- 1. FOUNDATIONS / TOKENS ----------
$tokens = @'
<div class="card-stage">
  <div class="stage-title">/// FOUNDATIONS &mdash; PALETTE</div>
  <div class="swatch-row">
    <div class="swatch"><div class="chip" style="background:#00ff41"></div><div class="lbl">primary</div><div class="val">#00ff41</div></div>
    <div class="swatch"><div class="chip" style="background:#008f11"></div><div class="lbl">primary-dim</div><div class="val">#008f11</div></div>
    <div class="swatch"><div class="chip" style="background:#ffb000"></div><div class="lbl">accent</div><div class="val">#ffb000</div></div>
    <div class="swatch"><div class="chip" style="background:#ff3333"></div><div class="lbl">danger</div><div class="val">#ff3333</div></div>
    <div class="swatch"><div class="chip" style="background:#e0ffee"></div><div class="lbl">text</div><div class="val">#e0ffee</div></div>
    <div class="swatch"><div class="chip" style="background:#4a7a5f"></div><div class="lbl">text-dim</div><div class="val">#4a7a5f</div></div>
    <div class="swatch"><div class="chip" style="background:#0a140f"></div><div class="lbl">bg-dim</div><div class="val">#0a140f</div></div>
    <div class="swatch"><div class="chip" style="background:#050a07"></div><div class="lbl">bg</div><div class="val">#050a07</div></div>
  </div>
  <div class="stage-title" style="margin-top:30px">/// TYPOGRAPHY</div>
  <div style="font-family:var(--font-display);color:var(--color-primary);font-size:30px;letter-spacing:3px;text-shadow:var(--glow-strength) var(--color-primary)">ORBITRON &mdash; DISPLAY</div>
  <div style="font-family:var(--font-mono);color:var(--color-text);font-size:15px;margin-top:10px">Share Tech Mono &mdash; body &amp; data readouts &middot; 0123456789</div>
  <div class="panel-header" style="display:inline-block;margin-top:16px">/// SECTION HEADER</div>
  <div class="stage-title" style="margin-top:30px">/// SIGNATURE TREATMENT</div>
  <div style="font-family:var(--font-mono);color:var(--color-text-dim);font-size:12px;line-height:1.7">Phosphor-green CRT terminal &middot; scanline + vignette overlays &middot; text glow &middot; sharp edges (no anti-aliasing)</div>
</div>
'@
Build 'foundations/tokens.html' 'Foundations' $tokens

# ---------- 2. STATUS BAR ----------
$statusCard = $statusBar + @'

<div class="card-stage" style="padding-top:18px"><div class="stage-title">/// STATUS BAR &mdash; top HUD: vessel &middot; sector &middot; date &middot; resource cluster</div></div>
'@
Build 'components/status-bar.html' 'Components' $statusCard

# ---------- 3. SHIP SCHEMATIC ----------
$shipCard = @'
<div class="card-stage">
  <div class="stage-title">/// SHIP SCHEMATIC &mdash; 6 decks (engineering shown damaged; crew dots on quarters)</div>
  <aside class="left-panel" style="width:280px;height:560px;border:1px solid var(--color-primary-dim)">
    <div class="panel-header">/// SHIP SCHEMATIC</div>
    <div class="panel-content" style="display:block;padding:0">
__SHIPHULL__
    </div>
  </aside>
</div>
'@
$shipCard = $shipCard.Replace('__SHIPHULL__', $shipHull)
Build 'components/ship-schematic.html' 'Components' $shipCard

# ---------- 4. MISSION LOG ----------
$logCard = @'
<div class="card-stage">
  <div class="stage-title">/// MISSION LOG &mdash; entry types</div>
  <footer class="console-log" style="height:320px;max-height:320px;min-height:320px;border:1px solid var(--color-primary-dim)">
    <div class="log-header">/// MISSION LOG ///</div>
    <div class="log-container">
      <div class="log-entry">Probe launched toward ROCKY-7. Integrity nominal.</div>
      <div class="log-entry"><span style="color:var(--color-accent)">JAXON:</span> This bucket won't hold much longer.</div>
      <div class="log-entry log-warning">WARNING: Hull integrity at 42%.</div>
      <div class="log-entry log-critical">CRITICAL: Reactor breach detected in ENGINEERING.</div>
      <div class="log-entry log-sector">/// ENTERING SECTOR 2: THE VOID</div>
      <div class="log-entry log-anomaly">Anomaly detected. Signal origin: unknown.</div>
      <div class="log-entry log-death">Crew member VANCE has died.</div>
      <div class="log-entry log-victory">COLONY VIABLE &mdash; Stellar Ascendancy achieved.</div>
    </div>
  </footer>
</div>
'@
Build 'components/mission-log.html' 'Components' $logCard

# ---------- 5. EVENT MODAL ----------
$modalHead = @'
<style>
  .choice-btn{display:block;width:100%;text-align:left;margin-top:10px;padding:10px 14px;background:rgba(0,255,65,.04);border:1px solid var(--color-primary-dim);color:var(--color-text);font-family:var(--font-mono);font-size:13px;cursor:pointer;transition:all .15s;}
  .choice-btn:hover{border-color:var(--color-primary);background:rgba(0,255,65,.12);box-shadow:0 0 12px rgba(0,255,65,.15);}
  .event-body{padding:20px;color:var(--color-text);font-family:var(--font-mono);font-size:14px;line-height:1.6;}
</style>
'@
$modalCard = @'
<div class="modal-overlay" style="position:absolute">
  <div class="modal-content">
    <div class="modal-header"><span>/// SECTOR EVENT &mdash; THE CAMPFIRE</span><span class="close-modal">[X]</span></div>
    <div class="event-body">
      The crew is arguing about the dwindling food supplies. Jaxon wants to open the emergency reserves. Dr. Aris says we need to save them for the colony.
      <button class="choice-btn">&#9656; Open the reserves &nbsp; <span style="color:var(--color-accent)">(+Morale, &minus;Rations)</span></button>
      <button class="choice-btn">&#9656; Stay the course &nbsp; <span style="color:var(--color-danger)">(&minus;Morale)</span></button>
    </div>
  </div>
</div>
'@
Build 'components/event-modal.html' 'Components' $modalCard $modalHead

# ---------- 6. CREW ----------
$crewCard = @'
<div class="card-stage">
  <div class="stage-title">/// CREW STATUS &mdash; indicator dots</div>
  <div class="deck-crew-status" style="display:inline-flex;background:rgba(0,0,0,.4)">
    <span class="crew-dot healthy"></span><span class="crew-dot injured"></span><span class="crew-dot stressed"></span><span class="crew-dot critical"></span><span class="crew-dot sedated"></span><span class="crew-dot dead"></span>
  </div>
  <div style="font-family:var(--font-mono);font-size:11px;color:var(--color-text-dim);margin-top:8px">healthy &middot; injured &middot; stressed &middot; critical &middot; sedated &middot; dead</div>
  <div class="stage-title" style="margin-top:28px">/// CREW ROSTER CARDS</div>
  <div class="crew-list" style="padding:0;grid-template-columns:repeat(2,minmax(230px,1fr))">
    <div class="crew-card"><div class="crew-icon">&#9881;</div><div><div class="crew-name">JAXON</div><div class="crew-meta">Engineer &middot; The Pessimist</div><div class="crew-tags">"This bucket won't hold."</div></div></div>
    <div class="crew-card"><div class="crew-icon">&#10133;</div><div><div class="crew-name">DR. ARIS</div><div class="crew-meta">Medic &middot; The Humanist</div><div class="crew-tags">"They need rest, Commander."</div></div></div>
    <div class="crew-card"><div class="crew-icon">&#10052;</div><div><div class="crew-name">VANCE</div><div class="crew-meta">Specialist &middot; The Survivor</div><div class="crew-tags">"Oxygen is for the living."</div></div></div>
    <div class="crew-card"><div class="crew-icon">&#9673;</div><div><div class="crew-name">A.U.R.A.</div><div class="crew-meta">AI &middot; Glitched Optimist</div><div class="crew-tags">"Survival probability: 4%. Have a nice day!"</div></div></div>
  </div>
</div>
'@
Build 'components/crew.html' 'Components' $crewCard

# ---------- 7. PLANET VISUALS ----------
$planets = @(
  @('VITAL','Vital'), @('VOLCANIC','Volcanic'), @('ICE_WORLD','Ice'), @('GAS_GIANT','Gas Giant'),
  @('TOXIC','Toxic'), @('OCEANIC','Oceanic'), @('ROCKY','Rocky'), @('DESERT','Desert'),
  @('EDEN','Eden'), @('STRUCTURE','The Structure'), @('WRONG_PLACE','The Wrong Place'), @('STATION','Station')
)
$cells = ''
foreach ($p in $planets) {
  $cells += '<div style="text-align:center"><div class="planet-visual type-' + $p[0] + '" style="width:120px;height:120px"></div><div style="font-family:var(--font-mono);font-size:11px;color:var(--color-text-dim);margin-top:34px">' + $p[1] + '</div></div>' + "`n"
}
$planetCard = '<div class="card-stage"><div class="stage-title">/// PLANET VISUALS &mdash; pure-CSS celestial bodies (12 of 33)</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:48px;justify-items:center;padding-top:10px">' + "`n" + $cells + '</div></div>'
Build 'screens/planet-types.html' 'Screens' $planetCard

# ---------- 8. FULL DASHBOARD ----------
$dash = @'
<div class="app-container">
__STATUS__
  <aside class="left-panel">
    <div class="panel-header">/// SHIP SCHEMATIC</div>
    <div class="panel-content" style="display:block;padding:0">
__SHIPHULL__
    </div>
  </aside>
  <main class="main-viewport sector-map-bg">
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">
      <div class="planet-visual type-VITAL" style="width:180px;height:180px"></div>
      <div style="font-family:var(--font-display);color:var(--color-primary);margin-top:46px;letter-spacing:2px;text-shadow:var(--glow-strength) var(--color-primary)">VITAL-3 // "NEW EDEN?"</div>
      <div style="font-family:var(--font-mono);color:var(--color-text-dim);font-size:12px;margin-top:8px">METALS 85 &middot; ENERGY 20 &middot; GRAV 1.1g &middot; TEMP 14&deg;C</div>
    </div>
  </main>
  <aside class="right-panel">
    <div class="panel-header">/// TACTICAL DATA</div>
    <div class="panel-content" style="display:block">
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--color-text);line-height:2">
        TARGET: VITAL-3<br>TYPE: VITAL<br>TAGS: <span style="color:var(--color-accent)">ANCIENT_RUINS</span><br>BIO-SIG: INTELLIGENT<br>PROBE RISK: <span style="color:var(--color-accent)">MODERATE</span>
      </div>
    </div>
  </aside>
  <footer class="console-log">
    <div class="log-header">/// MISSION LOG ///</div>
    <div class="log-container">
      <div class="log-entry log-sector">/// SECTOR 1: THE GRAVEYARD</div>
      <div class="log-entry">Orbit established around VITAL-3.</div>
      <div class="log-entry"><span style="color:var(--color-accent)">A.U.R.A.:</span> Habitability 91%. Probability it's a trap: 88%.</div>
      <div class="log-entry log-warning">WARNING: Probe integrity at 60%.</div>
    </div>
  </footer>
</div>
'@
$dash = $dash.Replace('__STATUS__', $statusBar).Replace('__SHIPHULL__', $shipHull)
Build 'screens/full-dashboard.html' 'Screens' $dash

Write-Host '---- DONE ----'
Get-ChildItem -Recurse $dist -Filter *.html | ForEach-Object { $_.FullName.Replace($dist + '\','') }
