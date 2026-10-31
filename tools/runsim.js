/* runsim.js — the node run model: plays thousands of whole runs of the new look (?new=1) with the game's own rule code, as
   five kinds of player, and says how runs go: short suppers, crew lost, all four at the light, the reserve, breakdowns,
   minutes, and short stories of how runs were lost. No window, no sound, no browser; it changes nothing in the game.
   These are rules runs with scripted choices, not playthroughs (the depth plan's PART 2, "D. Bot test protocol").

   usage:  node tools/runsim.js [--runs 2000] [--styles careful,greedy,reckless,aura,optimizer] [--seed 1]
                                [--void] [--port] [--unlock] [--off flight,faults,obsessed,hazards,decks]
                                [--out report.txt] [--log runs.jsonl] [--label today] [--from a.jsonl,b.jsonl]
     --void   the dark leg stand-in at the start of sector 5 (careful, A.U.R.A.-heavy and the optimizer wait: one ration a
              person; greedy and reckless push through: the hold breaks)
     --port   no longer changes anything: Last Port is in the game (2026-10-31: the relay's dock on the story trip to the
              disc's wreck, runsim/hands.js relayDock); kept so older pass scripts still run
     --unlock no longer changes anything: since depth step 4 the game itself never locks a trip card (App.tripChoices keeps
              the careful way open) nor a team trip (NSOrbit.pool); kept so older pass scripts still run
     --off    rules cardsim.js left out, turned off (tools/runsim/switches.js): only for the check against its tables
     --log    one JSON line per run (the plan's D3 log);  --from a.jsonl,b.jsonl  writes the report again from such logs
              (one process per player, each with its own --log, then one report: every player found in the logs)
   It runs at low priority (the laptop stays usable); 2,000 runs take about 2 to 6 minutes per player.
   How it works: tools/runsim/game.js loads the rule files into a node vm; tools/runsim/play.js plays one run through the
   game's handlers; tools/runsim/policy.js is each player's hands; tools/runsim/models.js holds the minigame results and the
   seconds per routine (assumptions, named there); tools/runsim/report.js writes the numbers and the stories.
*/
'use strict';
const fs = require('fs'), path = require('path');
const { makeGame } = require('./runsim/game');
const { playRun } = require('./runsim/play');
const { STYLE_ORDER, STYLES } = require('./runsim/models');
const { SWITCHES, parseOff, offGame } = require('./runsim/switches');
const report = require('./runsim/report');

const NOTES = [
    'Five players, scripted (tools/runsim/models.js STYLES, tools/runsim/policy.js). Cards: careful "kind" = the first choice that does not settle, as cardsim.js.',
    'The flown jump: measured (dark-leg tune: careful +4.7 energy, 0.01 decks; careless +0.5, 1.35 decks; A.U.R.A. -4). Landings, the burn gauge and a player docking: assumptions (models.js). The breach is the game\'s own hull hit (App.hullHit: a deck, nobody hurt).',
    "A.U.R.A.'s landings: her own autopilot, run headless on each world's own ground (tools/runsim/lander.js), lands soft on 99.9 % of worlds. The browser check should log 50 to confirm.",
    'Never locked (depth step 4): a trip card whose every way a stress trait struck keeps its careful way open (counted as "locked trip card"), and with fewer than two well the hurt go down, or the one left goes alone.',
    'A trip\'s odds are the game\'s own (src/data/TripOdds.js through App.wayOdds): no death under 30 % hurt, the fit of the two going down, Vance\'s cover, a death chance never above what the card showed.',
    'Docking: a player\'s grade is an assumption (good 70/25/5 soft/rough/crash, poor 30/40/30); a crash breaks a deck within the allowance and A.U.R.A.\'s dock costs 4 energy (the game\'s own App.applyDockResult, the new look\'s Bring Her In). A.U.R.A. docks with her own autopilot run headless (tools/runsim/docking.js): soft on every station tried. A dock\'s seconds are measured (models.js SECONDS.dock: the first of a run the whole approach, later ones routine).',
    'Not modelled: A.U.R.A.\'s ethics and her adversarial acts (vents, locked decks), premonitions, the far scan (2 energy), Eden\'s valley (players fly straight to the light), settling, the copy of Earth beyond "fight out", saves and reloads.',
    'Trips: careful and A.U.R.A.-heavy players make one trip a world (the site first, else a find showing 25 % or less; a clue always), the optimizer up to two finds worth it, greedy and reckless every find.',
    'Station walks use BoardingParty\'s own headless rules (A.U.R.A.\'s guide, except the optimizer, who walks its best plan).',
    'Minutes are the seconds per routine in models.js SECONDS added up (assumptions until the browser runs time them); the routine cuts C1, C4, C5 and C6 are live, the result card for repeats (step 6) is not (models.js CUTS).',
];

function args(argv) {
    const o = { runs: 2000, styles: null, seed: 1, void: false, port: false, unlock: false, off: new Set(), out: null, log: null, label: 'today\'s rules' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i], next = () => argv[++i];
        if (a === '--runs') o.runs = Math.max(1, Number(next()) || o.runs);
        else if (a === '--styles') o.styles = String(next()).split(',').filter(s => STYLES[s]);
        else if (a === '--seed') o.seed = Number(next()) || 1;
        else if (a === '--void') o.void = true;
        else if (a === '--port') o.port = true;
        else if (a === '--unlock') o.unlock = true;
        else if (a === '--off') o.off = parseOff(next());
        else if (a === '--out') o.out = next();
        else if (a === '--log') o.log = next();
        else if (a === '--label') o.label = next();
        else if (a === '--from') o.from = next();
        else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
    }
    return o;
}

/** The runs of earlier --logs (comma-separated files), by player (to write the report again without playing them again). */
function readLog(files) {
    const by = {};
    String(files).split(',').filter(Boolean).forEach(file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).forEach(line => { const r = JSON.parse(line); (by[r.style] = by[r.style] || []).push(r); }));
    return by;
}

/** Low priority, so a long pass never slows the laptop down (Windows: the idle class). */
function beNice() { try { require('os').setPriority(0, 19); } catch (err) { /* not allowed here: run at normal priority */ } }

async function main() {
    const o = args(process.argv.slice(2));
    beNice();
    const t0 = Date.now();
    const results = {}, storiesBy = {};
    const keep = (style, runs) => { results[style] = report.measure(runs); storiesBy[style] = report.stories(runs, 5); };
    if (o.from) {
        const by = readLog(o.from);
        Object.keys(STYLES).filter(s => by[s] && (!o.styles || o.styles.includes(s))).forEach(s => keep(s, by[s]));
        o.runs = Math.max(...Object.values(by).map(r => r.length));
        o.seed = Math.min(...Object.values(by).flat().map(r => r.seed));
    } else {
        const game = makeGame({});
        if (game.loadErrors.length) { console.error('Could not load:', game.loadErrors.join('; ')); process.exit(1); }
        offGame(game, o.off);
        const log = o.log ? fs.createWriteStream(o.log) : null;
        for (const style of o.styles || STYLE_ORDER) {
            const runs = [];
            for (let i = 0; i < o.runs; i++) {
                const r = await playRun(game, style, o.seed + i, { void: o.void, unlock: o.unlock, off: o.off });
                runs.push(r);
                if (log) log.write(JSON.stringify(r) + '\n');
                if ((i + 1) % 250 === 0) process.stderr.write(`  ${style}: ${i + 1}/${o.runs} (${Math.round((Date.now() - t0) / 1000)} s)\n`);
            }
            keep(style, runs);
        }
        if (log) await new Promise(resolve => log.end(resolve));
    }
    const meta = { label: o.label, when: new Date().toISOString().slice(0, 16).replace('T', ' '), runs: o.runs, seed: o.seed, secs: o.from ? `re-read from ${String(o.from).split(',').map(f => path.basename(f)).join(', ')}` : `${Math.round((Date.now() - t0) / 1000)} s`,
        standIns: [o.void ? 'the dark leg' : null, o.unlock ? 'never lock (--unlock)' : null].filter(Boolean).join(', ') || 'none',
        off: [...o.off].map(k => `${k}: ${SWITCHES[k]}`), stories: storiesBy, notes: NOTES };
    const out = report.text(results, meta);
    if (o.out) { fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true }); fs.writeFileSync(o.out, out); }
    process.stdout.write(out);
}

main().catch(err => { console.error(err); process.exit(1); });
