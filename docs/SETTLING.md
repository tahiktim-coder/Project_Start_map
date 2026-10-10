# Settling: the crew have their say (2026-10-10)

The designer's note: "after some sectors i just clicked to settle and the game ended." Settling ends the run, so it
should never be one click and one line. Now, before you settle, every crew member who can speak says one thing,
then A.U.R.A. asks the question. The lines are in `src/data/SettleCouncil.js`. Every way of settling goes through it (`bundle.js` `askBeforeSettling`): the SETTLE button, and "settle here" on a paradise world, where **Not yet** puts the team back on the surface. A.U.R.A. still refuses an unscanned world before anyone speaks.

## What it replaces

- **The sector 1-2 colony warning** (the old `bundle.js` `showColonyWarningModal`, now removed): a red box with four warnings at once, a made-up
  "colony report" percentage, and buttons saying ABORT and PROCEED DESPITE WARNINGS. It only showed in sectors 1-2.
- **The one-line question** (the old `askBeforeSettling`): A.U.R.A. alone, "Settle anyway?", from sector 3 on.

The council takes the place of both, in every sector, on the usual scene card: one line at a time, then two choices. Settling in sectors 1-2 still costs A.U.R.A.'s trust, as overriding the old warning did.

## How it picks the lines

Each person says one line, chosen by four things:

1. **The scan.** The same verdict the colony ending uses (`EndingSystem.getPlanetViability`): a **good** world
   (excellent or good), a **marginal** one, or a **bad** one (poor, or nowhere to land at all).
   If nobody ran a deep scan (the team walked onto a paradise world first), Mira says so instead:
   "We never ran a deep scan here, Commander. All we know is what the team saw down there."
2. **How far along.** Sectors 1-2 are **early** ("we only just left"), 3-4 the **middle**, 5-6 **late** ("we are this
   close to the light").
3. **What the crew knows.** **Told**: they still believe the briefing. **Doubt**: they found the uncut tape in sector 2,
   or they are in sector 3 or later, where everyone has seen the higher numbers and the hundred-year-old wrecks.
   **Truth**: they have read a page that explains it (sector 3's captain's log, or sector 5's launch ledger).
4. **Who can speak.** The dead, the sedated and anyone who has shut down say nothing. Someone shut in the cargo hold
   will not come up, and says so.

Who says what:

- **Mira** reads the scan, and trusts A.U.R.A.'s numbers. Excited early, wary in the middle, scared of the light late.
- **Jaxon** thinks about the ship, the parts and the food. He wants to stop, and wants it more every sector.
- **Aris** is tired, and thinks of the living.
- **Vance** wants the truth, on any world. His line changes with what the crew knows, not with the scan.

They speak in that order, then A.U.R.A. asks: "If we land for good, the journey ends here, Commander. Settle anyway?"
**Not yet** comes first; **Settle here** second.

**Never more than five lines.** With all four crew there, that is four voices and A.U.R.A.'s question. When fewer can
speak, A.U.R.A. opens as well: "Before you decide, Commander, the crew would like a word." Ask again about the same
world and only her question repeats; the crew have already said their piece.

## Three councils, as the player reads them

**Sector 1, a good world, the whole crew.**
- Mira: Everything on the scan says we could live here. A.U.R.A. went through every number with me.
- Jaxon: Early suits me. Better to land while the ship still holds together.
- Aris: I'd like everyone on this ship to grow old. This world would let them.
- Vance: We only just left, Commander. Land now and we never find out what happened to the others.
- A.U.R.A.: If we land for good, the journey ends here, Commander. Settle anyway?

**Sector 4, a marginal world, before any page explains the numbers.**
- Mira: It's a hard world. Nothing down there would kill us outright, but nothing would help us either.
- Jaxon: It's not good. But every jump costs us, and the food won't last forever.
- Aris: We'd lose people on a world like this. Not all at once, but we would.
- Vance: Ship numbers higher than ours, and older than us. I'm not stopping until someone explains that.
- A.U.R.A.: If we land for good, the journey ends here, Commander. Settle anyway?

**Sector 6, a good world, after the truth.**
- Mira: Good scan. Honestly, Commander, I'd rather live here than find out what that light is.
- Jaxon: The drive's been throwing us back in time. I'd like to switch it off for good.
- Aris: I came out here to understand the dead. I understand enough now. Let's look after the living.
- Vance: We're this close to the light, Commander. It's the last answer left. I'm not stopping short of it.
- A.U.R.A.: If we land for good, the journey ends here, Commander. Settle anyway?

If Vance had shut himself in the hold, his line would be: "I'm not coming up. You already know what I'd say."

## Changing it

Every line is in `src/data/SettleCouncil.js`, grouped by person, then scan, then sector band. A line marked
`late.truth` (or `early.doubt`, `middle.truth`) replaces the plain one once the crew knows that much. The five-line
limit is `MAX_LINES`; make it 6 to hear A.U.R.A.'s opening every time. No new story is added: nothing here touches the
disc, the four-or-five count, or why Earth sent the ships.
