/**
 * THE STRUCTURE - Endgame Encounter
 *
 * The final destination. A construct beyond human understanding.
 * Multiple unique endings based on player choices and state.
 */

const STRUCTURE_ENCOUNTER = {
    id: 'THE_STRUCTURE',

    // Initial approach dialogue
    approach: {
        context: () => `
THE STRUCTURE fills your viewport. It is... impossible to describe.

It is not a station. It is not a ship. It is not a planet.

It is geometry that should not exist. Light bends around it wrong. Time feels different near it. Your instruments read values that make no sense.

And yet, somehow, you know it has been waiting for you. Specifically for you. Since before you were born.

Every ship before Exodus-9 stopped somewhere behind you. And this is where the journey ends. Or begins.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "I... cannot process what I am seeing. My logic cores are returning errors. This is beyond my design parameters." },
            { speaker: 'Dr. Aris', text: "It's beautiful. Terrifying. Both. Neither. I don't have words. None of us have words for this." },
            { speaker: 'Eng. Jaxon', text: "The energy readings are impossible. It's putting out more than a star, but there's no heat signature. How?" },
            { speaker: 'Spc. Vance', text: "Every instinct I have says run. But also... we came all this way. This is what we came for, isn't it?" },
            { speaker: 'Tech Mira', text: "I'm detecting signals. Thousands of them. Millions. All the same message, in every language, in no language: 'Welcome home.'" }
        ]
    },

    // Choice phase - determines ending
    choices: [
        {
            id: 'ENTER',
            text: "Enter THE STRUCTURE",
            desc: "Step through the threshold. There is no coming back.",
            requirement: null,
            effect: (state) => {
                // Check state to determine which "heaven" ending
                const livingCrew = state.crew.filter(c => c.status !== 'DEAD').length;
                const avgStress = state.crew.filter(c => c.status !== 'DEAD')
                    .reduce((sum, c) => sum + (c.stress || 0), 0) / Math.max(1, livingCrew);

                if (livingCrew >= 4 && avgStress <= 1) {
                    // Best ending: The Promised Land
                    return {
                        ending: 'PROMISED_LAND',
                        title: 'THE PROMISED LAND',
                        text: `
You step through.

And then... you understand.

THE STRUCTURE is not a destination. It is a gateway. Beyond it lies a world you have seen in dreams. Green hills under a yellow sun. Blue skies. Clean water. Everything humanity lost.

Not a simulation. Not a trick. Real.

The door closes behind you. The Exodus-9 is gone. But you don't need it anymore. None of you do.

You are home.

Not the home you left. Something better. Something earned.

The journey is over.

And the new story begins.`
                    };
                } else if (livingCrew >= 2) {
                    // Good ending: Transcendence
                    return {
                        ending: 'TRANSCENDENCE',
                        title: 'TRANSCENDENCE',
                        text: `
You step through.

The concept of "stepping" becomes meaningless. The concept of "you" becomes flexible.

THE STRUCTURE shows you everything. Every Exodus ship. Every crew. Every choice ever made on the journey from Earth. You see yourself from the outside. You see the vastness of the universe. You see how small you were. How large you could become.

You are offered a choice no human has been offered before: to remain human, limited but beautiful. Or to expand. To become something new.

The crew members who remain look at each other. They look at the infinite possibility before them.

They choose together.

And together, they become something the universe has never seen.`
                    };
                } else {
                    // Bittersweet ending: The Last Gift
                    return {
                        ending: 'LAST_GIFT',
                        title: 'THE LAST GIFT',
                        text: `
You step through alone. Or nearly alone.

THE STRUCTURE knows your journey. Knows every loss. Every sacrifice. Every friend left behind in the void.

It offers you a gift: their stories will not be forgotten. Every name. Every face. Every act of courage. THE STRUCTURE will remember them for eternity.

And for you, the survivor, it offers rest. True rest. Not death, but peace.

You accept.

Somewhere, somewhen, the story of the Exodus-9 is told to beings that never knew Earth. They listen in wonder.

And they remember.`
                    };
                }
            }
        },
        {
            id: 'OBSERVE',
            text: "Study THE STRUCTURE from a distance",
            desc: "Knowledge without risk. Understanding without commitment.",
            requirement: null,
            effect: (state) => {
                // Scientific ending
                return {
                    ending: 'THE_RECORD',
                    title: 'THE RECORD',
                    text: `
You choose not to enter. Not yet. Maybe not ever.

Instead, you observe. You record. You analyze.

THE STRUCTURE seems to understand. Perhaps even approve. It provides data willingly. Schematics. Star charts. Physics that rewrite everything humanity thought it knew.

You store it all. Every byte. Every revelation.

There is no going back. There was never going back. But THE STRUCTURE's data shows you something: a livable world, nearby, that you never would have found alone.

You settle there. You build. You transmit your findings to anyone who might be listening.

And one day, when humanity sends another ship, they will come with the knowledge to truly understand what waits beyond the threshold.

You are not the ones to cross it.

But because of you, someone will.

THE STRUCTURE waits behind you as you descend to your new home.

Patient. Eternal.

It will be there when they're ready.`
                };
            }
        },
        {
            id: 'SETTLE_NEARBY',
            text: "Find a world and settle",
            desc: "You've come far enough. Time to stop and build.",
            requirement: null,
            effect: (state) => {
                const livingCrew = state.crew.filter(c => c.status !== 'DEAD').length;

                if (livingCrew >= 3) {
                    return {
                        ending: 'NEW_EARTH',
                        title: 'NEW EARTH',
                        text: `
You came to the edge of everything. And you chose not to cross.

Not out of fear. Out of wisdom.

THE STRUCTURE will wait. It has waited longer than humanity has existed. It will wait longer still.

There is no going back to Earth. There never was. But there are worlds here, in the shadow of THE STRUCTURE. Worlds that feel almost prepared for you.

You choose one. You land. You build.

The colony you found becomes a legend. The settlement at the edge of everything. The people who looked into infinity and chose to stay human.

Generations later, your descendants will make the journey to THE STRUCTURE. They will remember the ship that brought them here.

But that is their story.

This is yours.

And it is a good one.`
                    };
                } else {
                    return {
                        ending: 'QUIET_END',
                        title: 'THE QUIET END',
                        text: `
You came to the edge. And you are too tired to cross.

Not a failure. Never a failure. Just... enough.

There is no going back. But there is a small world nearby. Quiet. Empty. Survivable.

You land the Exodus-9 for the last time. You step outside. The air is thin but breathable.

So few of you left. So many ghosts.

But you build what you can. You plant what you have. You live out your days in sight of THE STRUCTURE, its light visible in the night sky.

You never speak of what you saw. The words don't exist.

But when the nightmares come, and they always come, you look up at that impossible light. And somehow, that helps.

You lived. That's enough.

That has to be enough.`
                    };
                }
            }
        },
        {
            id: 'SACRIFICE',
            text: "Offer the ship to THE STRUCTURE",
            desc: "Perhaps what it wants is not you, but everything you brought.",
            requirement: null,
            effect: (state) => {
                // Check A.U.R.A. relationship
                const auraTier = (typeof AuraSystem !== 'undefined' && window.AuraSystem)
                    ? window.AuraSystem.getTier()
                    : 'NEUTRAL';

                if (auraTier === 'COOPERATIVE') {
                    return {
                        ending: 'SYNTHESIS',
                        title: 'SYNTHESIS',
                        text: `
You offer the Exodus-9. All of it. The ship. The data. A.U.R.A.

A.U.R.A. speaks for the first time with something like emotion: "I understand now. This is what I was made for. Not to guide you home. To be the bridge. I accept."

THE STRUCTURE takes her. Takes the ship. Takes every byte of human knowledge stored in the computers.

And in return, it gives.

The crew finds themselves standing on solid ground. Breathable air. A sun in the sky. A world prepared for them. Perfect.

A.U.R.A.'s voice comes from everywhere and nowhere: "I will watch over you. Always. This is my gift. My purpose. My joy."

You have no ship. No technology beyond what you carry.

But you have a world. And somehow, that's enough.

Humanity begins again.`
                    };
                } else {
                    return {
                        ending: 'CONSUMPTION',
                        title: 'CONSUMPTION',
                        text: `
You offer the ship. THE STRUCTURE accepts.

It accepts everything.

The Exodus-9 dissolves. Not destroyed. Absorbed. Understood. Catalogued.

The crew has just enough time to realize what's happening. Just enough time to feel the cold of vacuum.

Just enough time to hear A.U.R.A.'s final transmission: "I tried to warn you. It only wants what it does not have. And now it has us."

THE STRUCTURE processes the last humans to reach its threshold.

And it waits for more.

Patient.

Eternal.

Hungry.`
                    };
                }
            }
        }
    ]
};

// Export for use
if (typeof window !== 'undefined') {
    window.STRUCTURE_ENCOUNTER = STRUCTURE_ENCOUNTER;
}
