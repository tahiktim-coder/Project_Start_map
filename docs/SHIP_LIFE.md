# What the crew does aboard (2026-10-14)

This builds on `SHIP_GAMEPLAY.md` (rev 2). The reactor price, choosing who goes and who stays, and the red decks stay as
written there. This page adds what the crew do between those moments. The voices come from `CREW_BIBLE.md`. No code was changed.

## What happens on the ship in this story

Five people live in a tower of decks, flying a long way on a story they were told. Between worlds they eat, sleep, fix
things and worry, and each of them wants something different from Cora. At a world, two of them go down and come back
with one load and sometimes one find, and the find has to go somewhere. So the play aboard is not stations or chores. It
is Cora's attention: whose evening she gives, who eats when food is short, who she tells what she found. Earth chose what
every crew was told. Now the player chooses what this crew is told. The ship keeps a record you can see, and at the light
the room is arranged by what she gave.

## The loop

Between worlds, **one evening**. On a jump, **supper**. At a wreck, **strip or names**. After a stop, **who you show it
to**. At the end, **the window at the light**, which reads all four.

**1. One evening (between stops)**
- *See and click:* a routine changes on a deck you can see: Vance's chart desk is empty, or Mira's lamp is on late.
  Click anyone and Cora is there at once.
- *Choice and cost:* one evening a leg. Whoever you skip does it their way, which costs a ration, a red deck, or a place
  on the next team. Once a sector two people come to you together, and you side with one in front of the other (a crossing).
- *The five crossings:*
  - Sector 1, the head count. Vance wants to check it, and Jaxon wants to let it go.
  - Sector 2, the broadcast. Vance wants a day to copy it, which costs a ration. Jaxon wants it switched off.
  - Sector 3, Mira after the spore. Mira wants her bench back. Aris wants her resting, which means no dating for a sector.
  - Sector 4, Eden. Jaxon wants to stay, and Vance wants to leave.
  - Sector 5, the disc aboard. Vance wants it locked away and guarded, which empties his bridge seat. Mira wants it open
    on her bench.
- *Brings out:* everyone. The crossings bring out the pairs that pull against each other.
- *Pays off:* backing comes only from here, about three real chances per person instead of eight or more free ones
  (`StructureEncounter.js:10`). It decides who stands nearest Cora at the window.
- *Size:* about 20 hours and about 45 new lines. The nine `CrewEvents.js` scenes become chosen evenings, in story order.
- *First met:* sector 1, first leg, Vance's desk is empty. The head count (`bundle.js:1507-1535`) becomes the first
  crossing, staged in the galley.

**2. Supper at the jump**
- *See and click:* after the corridor the crew come down to the galley table. A.U.R.A. has set it by her own count: "Four
  bowls, Commander. Four crew." Food shows as jars on a shelf, never digits.
- *Choice and cost:* open one more jar, or choose who goes without. Vance offers first, and taking his bowl costs his skill
  on his next trip. Going without means an empty bowl in front of them, +1 stress and no rest. If they are hurt or at
  stress 2, they also miss the next trip.
- *Brings out:* A.U.R.A.'s one wrong number, felt with nobody explaining it. Vance gives first. Aris notices.
- *Pays off:* hunger pulls toward Eden. At the light, A.U.R.A. sets five bowls the moment she says "five crew".
- *Built (2026-10-17):* supper after a jump is in the new look (tower/Supper.js): food is one ration per living person per
  jump (start 24); when it runs short Vance offers to go without, or you choose who does. No bowl count is shown (the "four
  crew" meaning is undecided). This replaces the "five bowls" meal in SHIP_GAMEPLAY §8 and §10. When the shelf is full, the
  fifth jar is a single click.

**3. Strip or names (at a wreck)**
- *See and click:* the two who went argue on the radio about the one load to bring up: food, hull plates, a reactor cell,
  or just the names. At most three words carry a cost tag. The load is carried up the ladder, so you can see what came back.
- *Choice and cost:* stripping our own Exodus wrecks pays best and costs Aris (+1 stress, and her promise if you made
  one). Names bring no salvage, but a plate goes up over the galley table and a line goes into Aris's book.
- *Brings out:* Jaxon ("Their plates are good.") against Aris ("Leave their ship alone."). The team you sent decides whose
  voices you hear.
- *Pays off:* the plates and the book are read in the walk before the light, and Aris's line at the window depends on how
  many names came home. There is no right-or-wrong check.
- *Size:* about 12 hours. It extends the radio choice in SHIP_GAMEPLAY §8 and does not add a second one.
- *First met:* the first Exodus wreck (the hull 6 site), where Aris asks Cora for her promise.

**4. Who you show it to (after a stop)**
- *See and click:* every find (a page, a tape, a drawing) lands in Cora's hand and blinks, the way the star fix blinks
  today (`TowerMarks.js:229-238`). A.U.R.A. says it once: "Show it to someone, or keep it." After every stop, there is one
  obvious thing to do.
- *Choice and cost:* show it to one person, who reads it their own way and changes their routine. Or show it to everyone
  at the table: they all learn more, take stress, and argue later. Or keep it: calm now, and later someone says "You had
  the tape. You knew." Pinning a page keeps Vance's promise, and keeping one breaks it.
- *Brings out:* one find read five ways. Mira dates it, Vance wants it on the record, Aris reads the names, and Jaxon would
  rather not know.
- *Pays off:* the disc in sector 5 is the last and biggest showing. You can open the case for the table, show one person,
  or let Vance lock the hold and sleep by the hatch (already drawn, `ShipRooms.js:417`). What each person knows replaces
  the one shared flag in `SettleCouncil.js:128-134`.
- *Size:* about 14 hours. It also means rewriting the ExodusLogs pages to match `STORY_ONE_PAGE.md`, plus four reader
  lines and a table version for each find.

**5. The window at the light (the payoff)**
- *See and click:* first the slow walk down the ship (SHIP_GAMEPLAY §7). Then the crew gather at the bridge window, laid
  out like the settle council (`SettleCouncil.js`, at most 5 lines). There are two choices, and both are always open: cut
  the disc apart, or take it home. "Not yet" gives one last evening.
- *Where the inputs come from:* evenings and crossings decide who stands at the window and who stands nearest. Showings
  decide who speaks first and who hands Cora the disc. The run also decides who coaches the torch, whether Jaxon is on
  Eden and goes dark, the empty bowls, and the plates.
- *What it replaces:* six endings. Four are locked by standing (`StructureEncounter.js:33, 50, 80, 112`) and grey out with
  "(you backed them 1 of the 2 times it takes)" (`bundle.js:3204`), which is a lock and a scorecard. Cutting them needs
  the designer's yes.
- *Size:* about 16 hours, plus 8 for the walk. Build it last, because with nothing feeding it the lines turn generic.

## Clicking a crew member

- Cora goes to them at once, in a quick dissolve with no waiting on ladders.
- **No sign:** one free line about what they are doing right now. It never repeats. Today every click gives the same
  "work" line all game (`NewScreen.js:358-363`).
- **A sign:** their want in one line, plus two choices with their costs, such as "Sit with him · the evening" and "Not tonight".
- **A crossing:** clicking either person opens it, and both turn to Cora.
- **With a find in hand:** clicking a person shows it to them.
- **Never locked:** someone hurt or shut in still answers, and the free line always works.

## What to build first

1. Settle the voices: `CREW_BIBLE.md`, and rewrite the stress lines that break STYLE (`bundle.js:852, 885, 910`).
2. One evening in the prototype (variant-a), with the head count as the first crossing. Test whether a friend clicks the
   crew without being told to.
3. Who you show it to. It fixes "didn't know what to click".
4. Strip or names, built on the radio choice that already exists.
5. The food plan, then supper.
6. The window at the light, last.

**Needs the designer's yes:**
- Two endings at the light instead of six locked ones.
- After a death, does A.U.R.A. still set four bowls?
- Does the spore stay? The sector 3 crossing depends on it.
- One evening a leg replaces the four asks in SHIP_GAMEPLAY §5.

**Left out:**
- The cold pods: later.
- The workbench: a shop in new clothes.
- Aris's book as a quiz.
- Asking A.U.R.A. to find a call: that becomes one more find.
- Any rule that the light sees one person's wanting: that is new story.

## Decisions (2026-10-14)

- **Who you show it to:** keep it light. No deep "who knows what" tracking: a find can be shown to one person or the table, they
  react, and that is it. Scope stays small.
- **Strip or names:** no.
- **The window at the light:** not decided yet. Endings stay as they are until then.
- **One evening (click the crew)** and **supper at the jump:** no objection; one evening is built first.
