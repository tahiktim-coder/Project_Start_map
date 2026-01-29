// BARK SYSTEM: Reactive crew dialogue that makes characters feel alive
// Self-instantiating singleton — fires crew comments into mission log
// Triggers on game events, respects cooldowns, stress-tiered personality lines

const BARK_DATA = {
    // ═══════════════════════════════════════════════════════════════
    // ENTER_ORBIT — When player warps to a planet
    // ═══════════════════════════════════════════════════════════════
    ENTER_ORBIT: {
        PESSIMIST: {
            0: ["Hull integrity holding. For now.", "Sensors are nominal. Don't get comfortable."],
            1: ["Another rock. Another gamble.", "Readings are... not encouraging.", "I've seen better-looking asteroids."],
            2: ["This bucket won't survive many more of these.", "Every orbit we enter might be our last.", "Tell me again why we're stopping here."],
            3: ["We're a coffin with thrusters.", "Doesn't matter. Nothing here will save us."]
        },
        HUMANIST: {
            0: ["Let's hope the ground matches the readings.", "Approaching with care. Everyone stay sharp."],
            1: ["I'm reading faint biosignals... probably nothing.", "Another world. Another chance.", "Let me prep the med bay, just in case."],
            2: ["I don't have enough supplies for another disaster.", "Please... let this one be different.", "The crew can't take much more of this."],
            3: ["I can't keep patching people together.", "What's the point of orbiting if we can't even save each other."]
        },
        SURVIVOR: {
            0: ["Stay sharp. Standard sweep before we commit.", "Perimeter looks clean. Proceeding."],
            1: ["Keep your guard up. Nothing out here is friendly.", "I've seen worlds that look safe. They weren't.", "Eyes open."],
            2: ["Last three planets tried to kill us. This one won't be different.", "I'm not sending anyone down there without a full scan.", "Something feels off. It always feels off now."],
            3: ["Volunteering to die? That's what this is.", "Whatever. Let's get it over with."]
        },
        CURIOUS: {
            0: ["Spectral analysis is fascinating! Look at those atmospheric bands.", "Oh! The mineral composition here is unique."],
            1: ["Interesting readings. Could be worth investigating.", "The surface patterns don't match any catalog I've seen.", "Preliminary data looks... unusual."],
            2: ["Something feels off about the readings. I can't place it.", "My models keep giving contradictory results.", "The data doesn't make sense. Nothing makes sense anymore."],
            3: ["I used to get excited about new worlds.", "Just another rock. Run the scans. Move on."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // AFTER_SCAN — After deep scan completes
    // ═══════════════════════════════════════════════════════════════
    AFTER_SCAN: {
        PESSIMIST: {
            0: ["Data's in. Could be worse.", "Scan complete. Nothing's exploded yet."],
            1: ["Well, it's not great.", "These readings... I wouldn't bet on them.", "Surface looks rough. Hull plating won't like it."],
            2: ["Another dead end. I can feel it.", "The scan data looks like a funeral notice.", "Why do we even bother scanning? It's always bad."],
            3: ["Numbers don't lie. This place wants us dead.", "Scanned. Catalogued. Meaningless."]
        },
        HUMANIST: {
            0: ["Good data. Let me cross-reference with medical protocols.", "Scan looks clean. Cautiously optimistic."],
            1: ["Some concerning readings for long-term habitation.", "The atmosphere is... marginal. Not ideal for the crew.", "I see trace organics. Could be promising."],
            2: ["Nothing here can sustain us. Nothing anywhere can.", "I keep looking for signs of life. I keep finding graves.", "The readings are clear. The outlook isn't."],
            3: ["Scan complete. Adding it to the list of places that can't help us."]
        },
        SURVIVOR: {
            0: ["Intel acquired. Planning approach vectors.", "Good. Now we know what we're dealing with."],
            1: ["Noted. Adjusting threat assessment.", "Terrain's hostile but manageable. Barely.", "I'd want full kit before stepping foot down there."],
            2: ["Threat level: considerable. As usual.", "I've mapped every exit route. We'll need them.", "The scan shows exactly what I expected. Nothing good."],
            3: ["Scanned. Logged. Irrelevant. We're dead either way."]
        },
        CURIOUS: {
            0: ["Look at these readings! The crystalline structures are remarkable.", "Fascinating composition. I want a closer look."],
            1: ["Hmm, some anomalous readings. Worth a deeper investigation.", "The subsurface data is... unexpected.", "I'm flagging some unusual spectral lines for analysis."],
            2: ["The data is contradictory again. I don't trust my own instruments anymore.", "Something beneath the surface. Can't resolve it.", "More questions than answers. As always."],
            3: ["Scan done. I've stopped caring what it says."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // LOW_ENERGY — Energy drops below 25
    // ═══════════════════════════════════════════════════════════════
    LOW_ENERGY: {
        PESSIMIST: {
            0: ["Power reserves are getting thin. We need to manage this.", "Energy's dropping. I'd recommend limiting non-essential systems."],
            1: ["We're bleeding power. This ship wasn't built for this.", "At this rate, we'll be running on fumes within a sector."],
            2: ["Power's nearly gone. The ship is dying and you know it.", "We're one bad jump from total blackout."],
            3: ["Lights are flickering. Good. Matches the mood."]
        },
        HUMANIST: {
            0: ["Energy is low. Let's prioritize life support.", "We should conserve. The crew needs heat and air above all."],
            1: ["Commander, the crew is cold. We need energy.", "Life support is struggling. People are shivering in the corridors."],
            2: ["We can't even keep the lights on. How do we keep people alive?", "Energy critical. I'm seeing hypothermia symptoms in Deck 4."],
            3: ["They're huddled in the dark. And I can't help them."]
        },
        SURVIVOR: {
            0: ["Energy situation is manageable if we're smart about it.", "Low power. Cut non-essentials. Standard protocol."],
            1: ["Getting tight. We should strip the next wreck we find.", "Power rationing. I've seen units survive on less. Barely."],
            2: ["We need energy or we need a miracle. I don't believe in miracles.", "One more jump on empty and we drift forever."],
            3: ["Running on nothing. Perfect. Just perfect."]
        },
        CURIOUS: {
            0: ["Energy reserves declining. I can reduce lab power draw.", "Low energy — I'll shut down my spectrographic analysis to conserve."],
            1: ["I've had to suspend my research. Not enough power for the instruments.", "Energy cells are depleting faster than my models predicted."],
            2: ["All my instruments are dark. I can't run analysis on anything.", "Without power, I can't even verify if a planet is safe."],
            3: ["Dark ship. Dark future. Dark everything."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // LOW_RATIONS — Rations drop below 5
    // ═══════════════════════════════════════════════════════════════
    LOW_RATIONS: {
        PESSIMIST: {
            0: ["Rations are getting low. Might want to think about that.", "Food stores looking thin. Just saying."],
            1: ["We're running out of food. No sugar-coating it.", "I've started counting meals. We have maybe a dozen left."],
            2: ["Starving to death in space. That's how this ends.", "The pantry is empty. The crew is looking at each other funny."],
            3: ["I stopped eating yesterday. Save it for someone who still hopes."]
        },
        HUMANIST: {
            0: ["Rations are low. Let's find a supply source soon.", "I'm monitoring nutrition levels. We need more food."],
            1: ["People are hungry, Commander. I can see it in their eyes.", "I've been halving portions to stretch what we have."],
            2: ["I caught someone eating maintenance grease. We're that desperate.", "The children on the colony ships... they must have starved too."],
            3: ["I can't look at them anymore. Hungry faces. Hollow eyes."]
        },
        SURVIVOR: {
            0: ["Food's tight. We should prioritize essential personnel.", "Low supplies. Next probe should target organics."],
            1: ["Getting hungry makes people stupid. Stupid gets people killed.", "I've seen crews turn on each other over less food than this."],
            2: ["When the food runs out, morale goes next. Then discipline.", "I'm keeping my sidearm close. Hunger does things to people."],
            3: ["Last meal territory. I've been here before. Didn't end well then either."]
        },
        CURIOUS: {
            0: ["Ration levels concerning. Some planets may have bio-compatible organics.", "Low food. I could analyze soil samples for edible compounds."],
            1: ["I've been studying which probe returns might contain nutrient-dense materials.", "Hunger makes it hard to focus on analysis. Hard to think at all."],
            2: ["I tried synthesizing protein from hull sealant. It didn't work.", "Can't think. Can't focus. Everything is about the next meal."],
            3: ["I don't remember what full feels like."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // BEFORE_EVA — Before EVA mission begins
    // ═══════════════════════════════════════════════════════════════
    BEFORE_EVA: {
        PESSIMIST: {
            0: ["EVA team prepped. Structural supports look adequate.", "Going outside. My favorite activity. Right after root canals."],
            1: ["The suits aren't rated for this environment. But when are they ever?", "I've patched the suits three times. Fourth time might not hold."],
            2: ["Sending people into that? It's a death sentence.", "EVA gear is held together with tape and prayer. Mostly tape."],
            3: ["Go ahead. Send them out. What's one more body?"]
        },
        HUMANIST: {
            0: ["I've briefed the team on medical protocols. Stay safe out there.", "EVA kits prepped. Please bring everyone back in one piece."],
            1: ["Please be careful. I don't have the supplies for another trauma case.", "I'll be monitoring vitals from here. Don't take unnecessary risks."],
            2: ["I can't patch up anyone else. My supplies are gone.", "Every EVA is a lottery. And we keep losing."],
            3: ["I've already written the medical reports. Just fill in the names."]
        },
        SURVIVOR: {
            0: ["Standard deployment. Watch your corners, check your six.", "EVA team, weapons hot. Trust nothing."],
            1: ["Keep the team tight. No wandering. No heroics.", "Last EVA nearly killed two people. Let's not repeat that."],
            2: ["I'll take point. If something's waiting, it finds me first.", "Everyone comes back or no one does. That's the rule."],
            3: ["Might as well flip a coin. Heads we die out there, tails we die in here."]
        },
        CURIOUS: {
            0: ["I've calibrated the portable scanner. We might find something extraordinary!", "EVA prep complete. The surface readings suggest some incredible formations."],
            1: ["I'd love a sample from the secondary deposit. If it's safe.", "Be careful near the anomalous readings. Fascinating but potentially dangerous."],
            2: ["The instruments keep glitching. I can't guarantee accurate readings down there.", "I used to beg for EVA time. Now I just... worry."],
            3: ["Bring back whatever. It won't matter."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // CREW_INJURY — Someone gets hurt
    // ═══════════════════════════════════════════════════════════════
    CREW_INJURY: {
        PESSIMIST: {
            0: ["Get them to medical. I'll hold things together up here.", "Injury report filed. Hull wasn't the only thing that took a hit."],
            1: ["Another one down. We're running out of people.", "This is what happens. Every time."],
            2: ["How many more before we admit this is hopeless?", "I'll reroute systems to compensate. Not like it matters."],
            3: ["Add it to the list. The long, long list."]
        },
        HUMANIST: {
            0: ["I'm on it. Get them to my bay immediately.", "Administering treatment now. Vitals are stable."],
            1: ["Another injury. I'm stretched thin as it is.", "They'll recover. Physically. Mentally... I'm not sure any of us will."],
            2: ["I don't have enough supplies for this. I'm using bandages twice.", "How many more? How many before there's no one left to treat?"],
            3: ["I used to save people. Now I just... delay the inevitable."]
        },
        SURVIVOR: {
            0: ["Wounded. Get them patched and back in rotation.", "It's a scratch. Walk it off."],
            1: ["We can't afford injuries. Every person down is a system unmanned.", "They'll live. Question is whether the rest of us will."],
            2: ["Casualty rate is climbing. I've seen this trajectory before.", "Noted. One more liability."],
            3: ["Survival of the fittest. Clearly, we're not the fittest."]
        },
        CURIOUS: {
            0: ["Oh no — is everyone okay? I'll assist Dr. Aris.", "The environmental data might explain the injury. Let me check."],
            1: ["This keeps happening. The correlation with planetary exposure is concerning.", "I should have seen it in the data. I should have warned them."],
            2: ["My analysis failed them. Again.", "I keep running the numbers. The numbers keep saying we'll lose more."],
            3: ["Injury. Death. Injury. Death. The pattern never changes."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // CREW_DEATH — Someone dies (bypasses cooldown)
    // ═══════════════════════════════════════════════════════════════
    CREW_DEATH: {
        PESSIMIST: {
            0: ["...Damn it.", "They deserved better than this flying wreck."],
            1: ["One less mouth. One less pair of hands. Same amount of nothing ahead.", "I told you. I told everyone."],
            2: ["We're all going to die out here. It's just a matter of sequence.", "Seal the compartment. Don't look."],
            3: ["Another name for the wall. Soon there won't be anyone left to read them."]
        },
        HUMANIST: {
            0: ["No... I should have done more. I should have—", "I'm logging time of death. I need... I need a moment."],
            1: ["They looked at me like I could save them. I couldn't.", "We should hold a service. They were a person, not a resource."],
            2: ["I can't do this anymore. I can't keep watching people die.", "Another name. Another empty bunk. Another person I failed."],
            3: ["I've forgotten how to cry. When did that happen?"]
        },
        SURVIVOR: {
            0: ["...Secure their belongings. Reassign their duties.", "Moment of silence. Then we move."],
            1: ["Death is the cost of this mission. I accept that. Doesn't mean I like it.", "Strip their gear. We need it more than they do."],
            2: ["Another one. The roster's getting thin.", "I'll survive this. I always survive. That's the curse."],
            3: ["Why is it never me? Why am I always the one left standing?"]
        },
        CURIOUS: {
            0: ["No... I just spoke to them this morning. They were—", "I want to understand what went wrong. I need to understand."],
            1: ["The data predicted this. I didn't want to believe it.", "Their research notes... someone should preserve them."],
            2: ["Statistically, we were always going to lose people. Statistics don't mention the screaming.", "I can't feel anything. Is that normal? Should I feel something?"],
            3: ["One fewer variable. The equation simplifies. I hate that I think like this now."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR_JUMP — Transitioning to new sector
    // ═══════════════════════════════════════════════════════════════
    SECTOR_JUMP: {
        PESSIMIST: {
            0: ["Jump drives cycling. Hold onto something.", "New sector. New problems. Same old ship."],
            1: ["The drives groaned during that jump. Not a good sign.", "Another sector deeper. Another sector further from anything familiar."],
            2: ["How many more jumps can this ship take? I don't want to find out.", "We're pushing deeper into nothing. Brilliant plan."],
            3: ["Jump complete. Congratulations. We've found new and exciting ways to die."]
        },
        HUMANIST: {
            0: ["New sector. New possibilities. Let's take care of each other.", "Rest cycle helped. The crew looks better."],
            1: ["I hope this sector has what we need. The crew needs hope.", "Another jump survived. Small victories."],
            2: ["Deeper and deeper. The crew barely speaks anymore.", "They slept through the jump. Too exhausted to notice."],
            3: ["We jumped. We're alive. That's all I have left to offer."]
        },
        SURVIVOR: {
            0: ["New sector entered. Tactical assessment underway.", "Jump clean. Scanning for threats."],
            1: ["Unknown territory. Weapons ready, eyes open.", "I don't like blind jumps. Too many unknowns."],
            2: ["Every jump takes us further from rescue. Not that rescue was coming.", "New hunting ground. Question is who's the hunter and who's the prey."],
            3: ["Deeper into the void. Exactly where something wants us."]
        },
        CURIOUS: {
            0: ["New sector! The star charts here are completely uncharted.", "Jump successful! Look at these preliminary readings!"],
            1: ["Interesting stellar density in this region. Worth cataloging.", "New data. New patterns. Let me get the instruments warmed up."],
            2: ["The readings are getting stranger. The further we go, the less sense things make.", "Another sector of anomalies I can't explain."],
            3: ["New sector. Same void. Same silence. Same nothing."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // EXODUS_FOUND — Finding an Exodus wreck / flight recorder
    // ═══════════════════════════════════════════════════════════════
    EXODUS_FOUND: {
        PESSIMIST: {
            0: ["Another dead ship. At least we can learn from their mistakes.", "Exodus wreckage confirmed. Let's see what killed them."],
            1: ["They had the same hope we do. Look where it got them.", "That ship launched with a full crew. Now it's scrap metal."],
            2: ["We're walking the same road. And it ends the same way.", "Their black box. Their last words. Our future."],
            3: ["A monument to failure. We'll be one too."]
        },
        HUMANIST: {
            0: ["Those were people. Families. Let's treat this with respect.", "We should recover what we can. They deserve to be remembered."],
            1: ["I wonder if they had a doctor too. If they watched everyone—", "Their medical logs might help us. But reading them hurts."],
            2: ["So many ships. So many graves. The whole corridor is a cemetery.", "I've stopped counting the dead. There are too many."],
            3: ["We found them. Nobody will find us."]
        },
        SURVIVOR: {
            0: ["Salvage opportunity. Strip what we can, log the rest.", "Wreck secured. Scanning for usable materials."],
            1: ["They didn't make it. We will. That's the difference.", "Their loss is our gain. Survival isn't pretty."],
            2: ["Eight ships launched. We're the only one left. Think about that.", "Every wreck is a warning. I'm listening."],
            3: ["Another dead ship full of dead people. Let me guess: we take their stuff and pretend we're different."]
        },
        CURIOUS: {
            0: ["The flight recorder! If we can access it, the data would be invaluable.", "This ship's telemetry could fill gaps in our stellar maps."],
            1: ["Their sensor logs might explain the anomalies we've been seeing.", "Every Exodus ship carried different instruments. Different perspectives."],
            2: ["I keep building a picture from these wrecks. The picture isn't comforting.", "Their data confirms what I feared. The corridor has a pattern."],
            3: ["Another data point. Another dead crew. The pattern is death."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // COLONY_SITE_FOUND — Finding a failed colony
    // ═══════════════════════════════════════════════════════════════
    COLONY_SITE_FOUND: {
        PESSIMIST: {
            0: ["Colony ruins. Someone tried. Someone failed.", "Structures on the surface. Not in great shape."],
            1: ["They built homes here. They thought they'd made it.", "Failed colony. The whole corridor is littered with them."],
            2: ["Look at it. They really believed they could live here.", "Another colony that died. We're next."],
            3: ["Ruins. Like everything else. Like us."]
        },
        HUMANIST: {
            0: ["There were people here. Colonists. We should investigate carefully.", "I'm detecting old settlement structures. We should pay our respects."],
            1: ["They tried to build a life. We owe it to them to understand what happened.", "Children lived there. I can see a playground."],
            2: ["Every colony we find is another story of hope that died.", "I can't stop thinking about who they were. What they wanted."],
            3: ["More ruins. More ghosts. I'm running out of prayers."]
        },
        SURVIVOR: {
            0: ["Colony site detected. Could have useful salvage.", "Failed settlement. Their loss, our opportunity."],
            1: ["They weren't tough enough. Or lucky enough. Same thing out here.", "Assess the site. Take what's useful. Don't get sentimental."],
            2: ["Failed colonies everywhere. Nobody survives the corridor.", "Salvage it. No one's using it anymore."],
            3: ["They tried. They died. The end. Can we move on?"]
        },
        CURIOUS: {
            0: ["A colony! Their soil analysis and construction data could be incredibly useful.", "Settlement detected. The structural choices they made tell a story."],
            1: ["I want to understand why they failed. The data could save us.", "The colony layout suggests they adapted quickly. But not quickly enough."],
            2: ["I keep studying failure. Every colony, every wreck. I'm an archaeologist of defeat.", "The pattern is clear. Colonies fail in predictable ways. We will too."],
            3: ["Another ruin. Another dataset about dying. I have so much data about dying."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR_3_ENTRY — Entering Sector 3, first hints of weirdness
    // ═══════════════════════════════════════════════════════════════
    SECTOR_3_ENTRY: {
        PESSIMIST: {
            0: ["Sector 3. Something's different about this place.", "The instruments are acting up. Great."],
            1: ["I don't trust these readings. Nothing should be broadcasting out here.", "Strange signals on all frequencies. This can't be good."],
            2: ["The stars look wrong. No, that's crazy. I'm just tired.", "I keep seeing movement where there shouldn't be any."],
            3: ["Something is watching us. I know how that sounds."]
        },
        HUMANIST: {
            0: ["The crew is reporting strange dreams. All the same dream.", "I'm seeing odd neural patterns in the whole crew. Stress, probably."],
            1: ["Something about this sector feels... different. Heavy.", "Crew members say they hear humming at night. I hear it too."],
            2: ["I dreamed about a door. A huge door. Waiting.", "The further we go, the stranger things get."],
            3: ["Whatever is out here... it knows we're coming."]
        },
        SURVIVOR: {
            0: ["Threat assessment: unknown. I don't like unknown.", "Something's pinging our sensors. Can't identify the source."],
            1: ["Movement at the edge of visual range. Gone when I look directly.", "Weapons ready. I don't know what for, but they're ready."],
            2: ["My instincts are screaming. Danger. Everywhere.", "We're not alone out here. I can feel it."],
            3: ["Whatever's waiting, it's been waiting a long time."]
        },
        CURIOUS: {
            0: ["Fascinating! The readings here defy normal physics.", "I'm detecting energy signatures that shouldn't exist."],
            1: ["The math doesn't work. These phenomena break known laws.", "I need more data. But I'm almost afraid to get it."],
            2: ["The anomalies are increasing. Something is changing out here.", "My models are useless. Nothing behaves as expected."],
            3: ["I used to want to understand. Now I just want to survive."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // ANOMALY_FOUND — Encountering an anomaly (any type)
    // ═══════════════════════════════════════════════════════════════
    ANOMALY_FOUND: {
        PESSIMIST: {
            0: ["Anomaly detected. As if this trip wasn't bad enough.", "Great. Reality is breaking. Normal Tuesday."],
            1: ["I told you. I TOLD you something was wrong.", "The instruments are going crazy. This isn't natural."],
            2: ["Whatever this is, it shouldn't exist. Neither should we.", "We've found something that doesn't want to be found."],
            3: ["The void is looking back at us now."]
        },
        HUMANIST: {
            0: ["Something strange ahead. Everyone stay calm.", "I'm seeing unusual readings. Let's approach carefully."],
            1: ["This doesn't feel right. My heart is racing.", "The crew can sense it too. They're scared."],
            2: ["God help us. I don't think we're alone out here.", "Whatever this is... it's beautiful and terrible."],
            3: ["I've seen things now that I can never unsee."]
        },
        SURVIVOR: {
            0: ["Contact. Unknown type. Weapons hot.", "Something's out there. Not ship. Not planet. Something else."],
            1: ["Fight or flight. And I don't think we can fight this.", "Every instinct says run. But where?"],
            2: ["We've entered something's territory. It knows.", "This is what killed the other ships. I'm sure of it now."],
            3: ["We were never the predators out here."]
        },
        CURIOUS: {
            0: ["Remarkable! The readings are completely unprecedented.", "This is... this is beyond anything I've studied."],
            1: ["I want to understand it. But part of me is terrified to.", "The data makes no sense. But it's BEAUTIFUL."],
            2: ["Everything I knew about physics is wrong.", "The universe is stranger than we imagined. Much stranger."],
            3: ["I've glimpsed something vast. I can never go back to not knowing."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR_5_ENTRY — Entering the final sector (one-time)
    // ═══════════════════════════════════════════════════════════════
    SECTOR_5_ENTRY: {
        PESSIMIST: {
            0: ["Sector 5. The Event Horizon. This is where stories end.", "The final sector. I'd say we made it, but 'made it' implies surviving."],
            1: ["We actually reached Sector 5. I genuinely didn't think we would.", "End of the line. One way or another."],
            2: ["Sector 5. The last place anyone ever reached. Now I know why.", "So this is it. The edge of everything."],
            3: ["The last sector. The last stop. The last of us."]
        },
        HUMANIST: {
            0: ["We made it to Sector 5. Everyone who got us here... thank you.", "The final sector. I want to believe it means something."],
            1: ["All those people on the other ships died trying to reach this point.", "We're here. They'd want us to finish this."],
            2: ["Sector 5. I promised the crew we'd find a home. I have to keep that promise.", "We've come so far. Lost so much. It has to be worth something."],
            3: ["The final sector. I don't have any hope left. Just duty."]
        },
        SURVIVOR: {
            0: ["Sector 5. Maximum readiness. This is the endgame.", "Final sector. Whatever's been testing us — this is the last exam."],
            1: ["The Exodus-8 logs mentioned this place. They didn't survive it.", "Every instinct says to turn back. There's nowhere to turn back to."],
            2: ["The end. Good. I'm tired of the journey.", "Sector 5. The place that killed everyone before us. Let's see about us."],
            3: ["Last sector. Last stand. Fitting."]
        },
        CURIOUS: {
            0: ["Sector 5 — the Event Horizon! The readings here are unlike anything documented.", "This is it! The source of every anomaly, every signal, every mystery."],
            1: ["The instrument readings are... impossible. All of them. Every single one.", "The stellar formations here follow no known physical model."],
            2: ["Everything I thought I knew about astrophysics is wrong. This sector proves it.", "The data is singing. I don't know how else to describe it."],
            3: ["Sector 5. The answer to everything. I'm too empty to care."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // FIRST_VITAL — First time finding a VITAL-type planet (one-time)
    // ═══════════════════════════════════════════════════════════════
    FIRST_VITAL: {
        PESSIMIST: {
            0: ["Vital-class planet. Don't get excited. Something's always wrong.", "Looks good on paper. They all do. Until they don't."],
            1: ["A viable world? In this sector? I don't buy it.", "Green readings across the board. That's suspicious."],
            2: ["Too good to be true. It's always too good to be true.", "A paradise planet. In a corridor full of death. Sure."],
            3: ["Pretty planet. Pretty coffin."]
        },
        HUMANIST: {
            0: ["A vital-class planet! This could be it! The readings are—", "Oh my... look at those biosphere readings. This is what we've been searching for."],
            1: ["Could this really be habitable? After everything?", "Life signs. Atmosphere. Water. I'm afraid to hope."],
            2: ["Please. Please let this one be real.", "If this is another dead end, I don't know if the crew can take it."],
            3: ["Green planet. Doesn't matter. Nothing matters."]
        },
        SURVIVOR: {
            0: ["Vital-class. Run full scans before we commit. Full scans.", "Potentially habitable. Which means potentially hostile."],
            1: ["It looks safe. That's exactly when you should worry.", "Viable worlds attract attention. We might not be the only ones interested."],
            2: ["Paradise planets killed the Icarus crew. Remember that.", "Scan it. Scan it again. Then scan it a third time."],
            3: ["Eden. That's what the Icarus called theirs. We know how that ended."]
        },
        CURIOUS: {
            0: ["A vital-class world! The spectral data is extraordinary!", "Biosphere confirmed! The chemical signatures suggest complex life!"],
            1: ["The ecosystem readings are fascinating. Multi-layered biome.", "This is what every exobiologist dreams of. Living systems."],
            2: ["Beautiful. Dangerous. Everything beautiful out here is dangerous.", "I want to believe the data. I really do."],
            3: ["Another dataset. Another promise. Another lie."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SINGING_PLANET — Encountering a SINGING type planet (one-time)
    // ═══════════════════════════════════════════════════════════════
    SINGING_PLANET: {
        PESSIMIST: {
            0: ["The planet is... producing sound? That can't be right.", "Resonance frequencies from a planet. My instruments must be broken."],
            1: ["Planets don't sing. Something on it sings. I don't want to meet it.", "The harmonics are rattling the hull. Make it stop."],
            2: ["The singing gets inside your head. I can't think straight.", "I've sealed my quarters. I can still hear it through the walls."],
            3: ["Let it sing. Let the void sing. What difference does it make?"]
        },
        HUMANIST: {
            0: ["Do you hear that? It's... beautiful. What could cause that?", "The frequency patterns are almost like a melody. Like a lullaby."],
            1: ["The crew is drawn to it. Something about the harmonics soothes them.", "I've never heard anything so beautiful. Or so lonely."],
            2: ["The singing. The Empty colony — they said the planet sang to them.", "It's calling to us. Part of me wants to answer."],
            3: ["Sing to me. I've forgotten every other song."]
        },
        SURVIVOR: {
            0: ["Anomalous acoustic emissions. Stay focused. Don't listen.", "The Exodus-4 logs mentioned this. 'The planet that sings.' Weapons ready."],
            1: ["If the planet makes noise, something on it is alive. That's a threat.", "Seal the comms channels. Don't let the crew hear it directly."],
            2: ["I can feel it in my chest. Subsonic. Manipulative. A weapon.", "It wants us to land. Wants us to walk into the sound. I've seen this trap."],
            3: ["Beautiful sound. Beautiful death. Same thing."]
        },
        CURIOUS: {
            0: ["Remarkable! The resonance patterns are mathematically perfect!", "A singing world! The crystalline substrate is vibrating at multiple harmonics!"],
            1: ["I've never seen anything like this. The frequency patterns suggest intelligence.", "The harmonics follow a sequence. It's not random. It's structured."],
            2: ["I've been listening for hours. I think it's trying to communicate.", "The mathematics in the sound... it mirrors the Fibonacci sequences from the Sojourn data."],
            3: ["It sings because no one listens. I understand that."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // PROBE_DEPLOY — When launching a probe
    // ═══════════════════════════════════════════════════════════════
    PROBE_DEPLOY: {
        PESSIMIST: {
            0: ["Probe away. Let's see what it finds before we risk skin.", "Launch confirmed. Telemetry incoming."],
            1: ["Probe integrity's not great. Don't expect miracles.", "Sending hardware where we're afraid to go. Smart."],
            2: ["The probe's in better shape than we are.", "Fire it off. At least the probe doesn't feel pain when it crashes."],
            3: ["Probe launched. Wish I could trade places with it."]
        },
        HUMANIST: {
            0: ["Probe launched. Safer than sending people.", "Good call using the probe. No sense risking lives unnecessarily."],
            1: ["Let the probe take the risk. We've risked enough.", "Probe telemetry coming in. Fingers crossed."],
            2: ["At least the probe comes back with something. Unlike people.", "Probe away. One more machine doing what we can't."],
            3: ["Launch it. Retrieve it. Repeat until we're dead."]
        },
        SURVIVOR: {
            0: ["Probe deployed. Standard reconnaissance pattern.", "Good intel gathering. Know the terrain before committing."],
            1: ["Smart move. Recon before boots on ground.", "Let the machine take the first hit. That's doctrine."],
            2: ["Probe's expendable. We're not. Barely.", "Send it. Every bit of intel is an edge."],
            3: ["A machine scouting our grave. Efficient."]
        },
        CURIOUS: {
            0: ["Probe away! I've configured it for maximum spectral analysis.", "Launch confirmed. I'm particularly interested in the subsurface readings."],
            1: ["The probe's sensor suite should give us great detail. If it survives.", "Deploying! The surface mineralogy should be revealing."],
            2: ["Probe launched. Maybe it'll find something worth finding.", "Another probe. Another dataset. Another planet that won't save us."],
            3: ["Probe away. Whatever."]
        }
    }
};

// ═══════════════════════════════════════════════════════════════
// ONE-TIME SPECIAL BARKS (tracked, never repeat)
// ═══════════════════════════════════════════════════════════════
const SPECIAL_BARKS = {
    FIRST_VITAL: true,      // First VITAL planet discovered
    SINGING_PLANET: true,    // First SINGING planet encountered
    SECTOR_3_ENTRY: true,    // Entering Sector 3 (anomaly hints)
    SECTOR_5_ENTRY: true,    // Entering Sector 5
    FIRST_CREW_DEATH: true,  // First crew member death
    ANOMALY_FOUND: true      // First anomaly encountered
};

class BarkSystem {
    constructor() {
        this.lastBarkAction = -2; // actions since last bark (start ready)
        this.cooldownActions = 1;  // minimum actions between barks
        this.firedSpecials = {};   // track one-time barks
        this.lastSpeaker = null;   // avoid same speaker twice in a row

        // Register event listeners
        this._bindEvents();
    }

    _bindEvents() {
        // We'll hook into existing events and state changes
        // Most triggers are called directly from bundle.js handlers
        // This ensures barks fire AFTER the action log entry

        window.addEventListener('bark-trigger', (e) => {
            this.tryBark(e.detail.trigger, e.detail.state, e.detail.context);
        });
    }

    /**
     * Main entry point — called from bundle.js handlers
     * @param {string} trigger - One of the BARK_DATA keys
     * @param {object} state - GameState reference
     * @param {object} context - Optional extra data (planet, crew member, etc.)
     */
    tryBark(trigger, state, context = {}) {
        if (!state || !state.crew) return;

        // Check cooldown (CREW_DEATH bypasses)
        if (trigger !== 'CREW_DEATH') {
            const actionsSinceLast = (state.actionsTaken || 0) - this.lastBarkAction;
            if (actionsSinceLast < this.cooldownActions) return;
        }

        // Check one-time triggers
        if (SPECIAL_BARKS[trigger]) {
            if (this.firedSpecials[trigger]) return;
            this.firedSpecials[trigger] = true;
        }

        // Get living non-LEADER crew
        const eligible = state.crew.filter(c =>
            c.status !== 'DEAD' &&
            !c.tags.includes('LEADER')
        );

        if (eligible.length === 0) return;

        // Get bark data for this trigger
        const triggerData = BARK_DATA[trigger];
        if (!triggerData) return;

        // Pick a speaker — avoid repeating last speaker if possible
        let speaker = null;
        const shuffled = this._shuffle([...eligible]);

        for (const candidate of shuffled) {
            const personality = candidate.personality;
            if (triggerData[personality]) {
                // Prefer someone other than last speaker
                if (candidate.name !== this.lastSpeaker || shuffled.length === 1) {
                    speaker = candidate;
                    break;
                }
            }
        }

        // Fallback: just pick first eligible with valid data
        if (!speaker) {
            speaker = shuffled.find(c => triggerData[c.personality]);
        }

        if (!speaker) return;

        // Get stress tier (clamped to available tiers)
        const stress = Math.min(speaker.stress || 0, 3);
        const personalityBarks = triggerData[speaker.personality];
        if (!personalityBarks) return;

        // Find the closest available stress tier (fall back to lower)
        let barks = personalityBarks[stress];
        if (!barks) {
            for (let s = stress - 1; s >= 0; s--) {
                if (personalityBarks[s]) {
                    barks = personalityBarks[s];
                    break;
                }
            }
        }
        if (!barks || barks.length === 0) return;

        // Pick a random bark line
        const line = barks[Math.floor(Math.random() * barks.length)];

        // Log it with speaker name (matches existing dialogue format)
        this.lastSpeaker = speaker.name;
        this.lastBarkAction = state.actionsTaken || 0;

        // Fire after a short delay so it appears after the action log
        setTimeout(() => {
            if (state.addLog) {
                state.addLog(`${speaker.name}: "${line}"`);
            }
        }, 150);
    }

    /**
     * Convenience: fire bark for resource threshold checks
     * Call this after resource changes
     */
    checkResourceBarks(state) {
        if (!state) return;
        if ((state.energy || 0) <= 25 && (state.energy || 0) > 0) {
            this.tryBark('LOW_ENERGY', state);
        }
        if ((state.rations || 0) <= 5 && (state.rations || 0) > 0) {
            this.tryBark('LOW_RATIONS', state);
        }
    }

    /**
     * Check if a planet type triggers a special bark
     */
    checkPlanetBarks(state, planet) {
        if (!planet) return;

        // First VITAL planet
        if (planet.type === 'VITAL' && !this.firedSpecials['FIRST_VITAL']) {
            this.tryBark('FIRST_VITAL', state, { planet });
            return; // Don't stack with ENTER_ORBIT
        }

        // SINGING planet
        if (planet.type === 'SINGING' && !this.firedSpecials['SINGING_PLANET']) {
            this.tryBark('SINGING_PLANET', state, { planet });
            return;
        }
    }

    _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Reset state (for new game)
     */
    reset() {
        this.lastBarkAction = -2;
        this.firedSpecials = {};
        this.lastSpeaker = null;
    }
}

// Self-instantiate singleton
window.BarkSystem = new BarkSystem();
