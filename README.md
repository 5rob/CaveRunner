# CaveRunner

A jetpack cave platformer prototype that runs in the browser. Each floor is a
shop room with a freshly generated destructible cave above it: climb from the
shop to the green exit at the top, and the exit drops you into the next floor's
shop. You keep your guns, mods and gold; the cave and the loot are new every
time.

**Every floor keeps its identity.** Floor 3 is always the frozen one and always
holds the same mix of creatures, on every run and after every restart — the
cave layout and the loot are rolled fresh, but who lives there and what it looks
like are not. That is deliberate: you learn a floor, and the colour tells you
where you are before you have read the number.

The cave starts dark, and what lights it is the torch in your other hand. It lights a
generous bubble around you — bright at your feet, guttering as it burns, fading out to
black — and the cave beyond that bubble stays a real unknown. The torch only lights
ground you have actually laid eyes on: line of sight is what lifts the dark, so a wall
hides its far side until you go and look round it, and what you have already uncovered
stays a faint map behind you for the rest of the floor. Enemies shoot further than the
bubble reaches, so a dark corner is a real risk.

## Play

Open `index.html` in a browser. It is a single file with no build step; React loads from a CDN.

## Controls

| Action | Touch | Keyboard / mouse |
| --- | --- | --- |
| Walk | Left stick, below the line | A / D |
| Jetpack | Left stick, above the line (distance sets speed) | W, or W + A / D |
| Aim | Right stick | Mouse |
| Shoot | Drag the right stick out past the dead zone | Left mouse button |
| Interact: buy, take a gun, mod or perk | Tap the middle of the right stick | F |
| Restart after dying | Tap the right stick | — |
| Pick gun | Tap a gun slot | 1 to 4 |
| Gun details | Hold a gun slot | — |
| Reorder guns | Hold and drag a gun tab in the build screen | — |
| Bag: guns & mods screen (open anywhere) | Tap Bag | E |

The controls sit on a black arcade panel with a scanline wash over it. The knob
that follows your thumb is a white ring with a black fill — the boldest circle on
the stick — sized to still show an edge around a thumbprint rather than vanishing
underneath one, so you can see where your thumb is pointing without lifting it.

A small white crosshair (a "+" with the centre cut out) marks where you are aiming — it
circles the character at a fixed distance as you swing the aim stick (its distance is a
Dev-panel setting).

The right stick carries a dotted amber ring: the trigger line. It is drawn one knob
radius outside the point where the drag starts counting as aiming, so when the knob's
edge reaches that circle, the gun fires. The stick does not clip the knob to the
circle, so at full deflection the knob is still a whole knob.

The sticks are your dashboard too. There are no numbers up top any more: your health
is the ring around the left stick, wiping away clockwise as you take hits — and it slides
from green through amber to red as it drops, so the colour itself tells you how close you
are to the end; and your fuel is the amber fill in the top half of the left stick, sinking
towards the centre line as the jetpack burns it. The right stick carries three rings for the
gun you're holding — gold mana on the outside, then blue recharge and purple cast delay inset
each — every one a readiness gauge that empties when it fires and fills back over its own
time, so the ring that keeps lingering low is what's limiting your fire. Those same three
colours tint the cast-delay, recharge and mana numbers in the Bag screen, to tie them
together. The floor number is painted big
across the shop's back wall, the version sits top-left, and your gold reads in the gap
between the two sticks — a `g`, with thousands shortened to a `k` (so `1234` shows as
`1.2kg`).

A minimap sits in the bottom-left corner: the cave you have uncovered, drawn as thin white
outlines over the gameplay, about a third of the screen wide, with a yellow dot for where you
are. It only shows ground the fog of war has lifted, so it fills in as you explore.

## Picking things up

Mods and guns in the cave sit on a floor of their own now, not floating in place.

The middle of the right stick is a dead zone: drag out past it to aim and fire,
tap it without leaving it and you interact with whatever you are standing at.
That one button buys from a shop plinth and picks up guns and mods in the cave.

Walking over something no longer takes it. You get its card instead — a slim panel
that floats just above the item with the price built into it — so you can read a mod
or compare a gun against the one you are holding, and see what it costs, in one panel.
A long stat list (a loaded gun, a busy mod) scrolls inside the panel so it never grows
tall enough to fill the screen. Shop stock reads **Buy** and its price; anything free
just reads **Take**.

Once you have read the card, a tap on the right stick takes it. A **mod** goes straight
into your bag — no second screen, since a mod has no slot to choose. A **gun** opens the
swap chooser instead (see **Guns and mods** below): a gun goes into one of four slots and
is worth comparing before you commit.

## The shop

Every floor starts in an enclosed room spanning the width of the level, with one
hole in the roof leading up into the cave. You arrive at the far left, beside the
portal you came in through, and the free full heal is right there with you.

The four things for sale sit together in one row across the middle of the room,
close enough to read all four without walking between them. Odd floors sell mods.
**Even floors sell guns instead** — four freshly rolled
ones, priced on what they can actually do: slots, how fast they cycle, mana, and
whether they fire in the order you set them. Buying one equips it straight away — into
an empty slot, or in place of the gun you are holding, with the old one parked on the
plinth so you can grab it back if you change your mind.

Stand on any plinth and its card appears with the **Buy** price built in — a mod's
effect and stats, or a gun's stat sheet compared against the one you are holding —
so you can read what you are buying before paying for it. Your **Bag** opens anywhere,
but *changing* your setup — dragging mods, reordering guns — only works in the shop (or
anywhere, with the Tinker perk); out in the cave the Bag is read-only. Enemies drop gold
when they die, so a floor you clear pays for the next floor's shopping.

Guns get better as you go. Height in the cave still matters — the ones lying
around near the top of a floor beat the ones near the bottom — but every floor
you clear lifts the whole range, so by floor five or six the scratch pistols have
stopped turning up.

## Perks

Every floor also hides two small rooms, built brick-lined like the shop, carved out of
the cave and connected back to the main route by a tunnel — you have to find them.

One holds a perk on an altar. Walk onto it and a card describes the upgrade; tap the
right stick's dead zone (or F) to take it, same as any other pickup. There are 31 perks,
copied from Noita — Glass Cannon, Extra Health, Faster Wands, Homing Shots, Unlimited
Spells, Permanent Shield, Pinpointer, Trajectory Sight (draws the dotted aim line for the
next shot), Angry Ghost, Attract Gold, radars and Invisibility among them — and once
taken, a perk lasts the rest of the run: until you die or hit
Restart. A perk room never offers one you already hold. What you've collected shows as a
row of small icons along the bottom of the screen, just above the thumbsticks.

The other room holds a heart that raises your maximum health by 25. It does not heal
you — it only raises the ceiling.

A couple of perks reach into other systems: Extra Item in Holy Mountain makes the shop
offer five things instead of four, and Tinker with Wands Everywhere lets you *edit* your
setup anywhere, not just in the shop. Trajectory Sight is what draws the dotted aim line
that shows where your next shot flies — without it, you aim by feel.

## Floors

Floors 1 to 10 are hand-picked, and they are always the same. Each has its own
colour scheme and its own roster of two to six creatures, and both are fixed to
the floor number rather than rolled with the seed — so the floor you learn on
this run is the floor you meet on the next one. The palette wraps around after
twelve floors, and from floor 11 up the creatures are rolled fresh each floor, so
the run keeps moving rather than settling into a pattern.

| Floor | Cave | Who is in it |
|---|---|---|
| 1 | Mossy caves | Heikkohiisi, Hämähäkki |
| 2 | Coal seams | Heikkohiisi, Hämähäkki, Hiisi |
| 3 | Frozen deep | Hiisi, Konna, Hämähäkki |
| 4 | Ember halls | Hiisi, Mato, Limanuljaska, Kobold |
| 5 | Fungal grotto | Hiisi, Kärpässieni, Hurtta, Limanuljaska |
| 6 | Salt flats | Snipuhiisi, Hiisi, Hurtta, Stendari, Kärpässieni |
| 7 | Amethyst vein | Snipuhiisi, Lohkare, Mato, Stendari, Kobold |
| 8 | Rustworks | Jäätiö, Chaingunner, Lohkare, Hämähäkki, Hurtta, Kärpässieni |
| 9 | Bone garden | Jäätiö, Chaingunner, Snipuhiisi, Stendari, Lohkare, Elävät luut |
| 10 | Drowned halls | Chaingunner, Snipuhiisi, Lohkare, Elävät luut, Jäätiö, Tappurahiisi |

## Creatures

Sixteen of them, named after Noita's, and they do not all behave the same way:

- **Shooters** (Hiisi, Heikkohiisi, Tappurahiisi, Chaingunner) hover around their
  patch and fire when they have a line on you. The Tappurahiisi throws a cone of
  pellets, the Chaingunner fires in short bursts.
- **Turrets** (Snipuhiisi, Kärpässieni, Jäätiö, Elävät luut) never move. They have
  longer reach and more punch, and the ones worth worrying about show a ring that
  closes before they fire — break the line and the shot never comes.
- **Chasers** (Hämähäkki, Lohkare, Mato, Hurtta, Kobold, Konna) come at you and
  hurt you by reaching you. The Lohkare is slow and armoured; the Hurtta is not.
- **Bombers** (Limanuljaska, Stendari) run at you and burst on contact, taking
  themselves out with you. The Stendari hurts more.

Nothing comes for you through a wall: chasers and bombers only wake and give chase
once they can actually see you, so breaking their line of sight shakes them off.

Every creature's health, damage and gold are lifted by the floor it belongs to,
so a floor 9 Hiisi is worth a lot more than a floor 2 one and takes a lot more
killing. Health climbs fastest, gold next, damage slowest — a floor 10 enemy is
worth more than it hurts, or the shop heal would never keep up. Deeper floors
also hold more of them.

## Guns and mods

Guns work like Noita wands. Each one is rolled at random with its own capacity,
cast delay, recharge time, mana pool, spread and shot speed, and some of them
shuffle their firing order. You carry up to four. You start with a weak **Scratch Pistol**
in hand and a **Pick Axe** in the second slot — a one-slot gun holding a **Buzzsaw**, which
cuts a big circle right in front of you: no travel, it just carves a slice into the rock (or
anything close) and chews terrain. Anything you find on floor 1 beats the pistol.

Standing next to a gun on the ground shows its card. A tap opens the chooser: it pauses the
game and shows what you found with a button for each of your four slots, both guns laid out
at once so you can read either one's mods without scrolling. Tap a slot to compare that gun,
hold one to swap it out — whatever it replaces is left on the ground where you found the new
one. The found gun's stats are coloured against whichever of your guns you last tapped (your
held gun to start with), green for better and red for worse, counting a smaller cast delay,
recharge or spread as better.

Every gun is given its own colour when it is made, and keeps it for the run, so
the name reads the same in the toolbar, the build screen and on its card — handy
once you are carrying four guns with similar names.

Mods are coloured by what they are for, not one colour each, so you can tell a
bullet from the things that change it at a glance: amber shots, red damage, blue
speed and range, purple flight path, pink shot pattern, green gun upkeep. A
legend sits above your collected mods, and a Sort button next to them reorders
your collection into those same groups.

Mods are the spells. Some are shots (Bolt, Buckshot, Slug, Blast, Bounce Orb...)
and the rest are modifiers (Homing, Heavy Shot, Scatter, Double Cast, Borer...).
A modifier only affects the shots to its **right** on the gun, so the order you
drag them into matters. Firing walks the list left to right; run off the end and
the gun recharges before starting over.

In the build screen each pull of the trigger is drawn as its own outline with a
line of stats under it — what that pull does, and what its modifiers added or
cost, green for better and red for worse. So you can see which mods come out together — a modifier sits inside the outline of the
shots it affects, and anything the gun never reaches is marked "never cast".

Cast delay is accumulated in that same order, which makes **Buzzsaw** special: it
does not subtract from the delay, it resets it to zero at the moment it is cast. Anything
cast after it adds its delay back, so it belongs at the tail of a multicast group —
`Double Cast, Bolt, Buzzsaw` fires the bolt and leaves the gun ready immediately.
Recharge, by contrast, counts from any slot.

Any mod in a group that changes the recharge time shows it in that group's stat
line too, even though recharge itself is paid once per full cycle rather than
per pull — so a Buzzsaw or a Cold Start reads as the saving it actually makes.

## DEBUG mode

There is a DEBUG switch in the build screen header. Turn it on and your
collection is replaced by a shelf holding one of every mod in the game, none of
which is ever used up, so you can try a build out properly instead of hoping the
right mod drops. Your own bag is left completely alone while it is on — switch
it off and your mods come straight back, with whatever you fitted still on the
gun.

## The spell book

There are 111 mods, most of them lifted from Noita's spell list and rebuilt to fit
a cave shooter. They come in a few shapes:

- **Shots** are the things that come out of the barrel — Bolt, Slug, Magic Missile,
  Fireball, Lightning Bolt, Chain Bolt (which hops from enemy to enemy), Black Hole
  (a slow starry sphere that eats rock, hauls creatures into it and grinds them, and swallows any enemy shot that comes near), Nuke, Meteor, and twenty-odd more. **Plasma Beam**
  and **Luminous Drill** are instant: they hit along a line with no travel time.
- **Static fields** stay where you cast them and work over time. Unstable Crystal is a
  proximity mine; Dormant Crystal sits harmless until another blast reaches it; Circle
  of Stillness leaves enemies crawling; Circle of Shielding swallows their fire; Circle
  of Vigour heals you while you stand in it; Thundercloud, Vacuum Field and Glittering
  Field cover an area. They take a cast slot like a shot does.
- **Modifiers** change the shots drawn after them, as always. Nine of the new ones bend
  the flight path — Boomerang, Spiral Arc, Ping-Pong, Orbiting Arc, Gravity, Anti-Gravity,
  Horizontal Path, Auto-Aim, Short-range Homing — and the aim line draws every one of
  them properly, so you can see what a path mod will do before you fire it.
- **Utility** does something to the world or to you. Summon Platform and Summon Wall
  build terrain. Wand Refresh skips the next recharge. Long-Distance Cast, Teleporting
  Cast and Warp Cast move where the shot starts. Blood Magic, Blood To Power and Gold
  To Power buy power with health or gold.
- **Trigger spells** carry another spell and cast it where they land. **Spell With
  Trigger** takes the next spell on the gun, **Spell With Double Trigger** takes two,
  and **Spell With Timer** lets go in mid-air instead of on impact. The payload is
  cast however the carrier's flight ends, so it is never wasted, and a carried spell
  never carries one of its own.
- **The Greek letters** copy other spells off the gun. Alpha copies the first, Gamma the
  last, Tau repeats the next two, Phi copies every shot, Sigma every field, Omega
  everything. Mu applies every modifier on the gun to one shot no matter where they sit.
  Zeta borrows a random spell off one of your other three guns.

What the cave and the shops hand out is weighted by rarity, and each floor reaches a
little further up the scale, so the early game is workhorses and the Greek letters
stay a find.

## Build advice

Under the outlines the build screen works out your sustained damage per second
and names whatever is holding it back: recharge, cast delay, or mana running out
faster than it comes back. It then looks for changes that measurably beat what you
have: bringing a mod in from your bag, or swapping two you already have on. With a
hundred-odd mods to hand it takes a cheap first look at each one in a couple of slots,
then gives the dozen or so that showed promise the full every-slot treatment, which
keeps a render at about four milliseconds. It offers up to three. Each one is a button — tap it and the change
is made, with anything it displaces going back to your bag. It is all arithmetic
on the same cast planner the gun fires with, so the numbers are the real ones. Health
counts as a resource alongside mana, so a build that bleeds you dry in five seconds is
not credited with the damage it would do if you survived it.

## Running it

Open `index.html`. There is no build step and nothing to install.

**To play it on your phone**, with the PC and the phone on the same wifi:

```
node serve.js          # prints the address to type in, e.g. http://192.168.1.20:8000
node serve.js 8080     # a different port
```

Reload the page on the phone and it picks up whatever is in `index.html` — there is no
build step to re-run. If the phone cannot connect, the usual culprits are Windows
Firewall asking about Node the first time, and a VPN with a LAN block turned on.

Don't serve the project folder with a plain static server (`python -m http.server` and
the like). That hands out everything in it, and `.claude/settings.json` holds an API
token. `serve.js` answers for `index.html` and nothing else.

Tests live in `tests/`: `node tests/run.js` runs the lot, `node tests/run.js logic` runs
just the fast ones. The browser suites need Chromium and Playwright; the runner skips
them if it cannot find either.

## Features

- Floors that chain: shop, cave, exit, next shop, with gold and gear carried over
- A colour scheme per floor that stays with that floor run to run, so you can tell where you are at a glance
- Large randomly generated caves with cramped and open areas, winding tunnels, built ledges and half-buried brick frames
- Fog of war: the cave starts dark and you reveal it by exploring — only what the torch could actually see, never what was round a corner — with what you have seen kept as a faint map behind you
- A torch in the runner's free hand, throwing embers, guttering — and the light in the cave gutters with it. Its flame is dragged about as you move, and it throws a small warm glow round you
- Wall torches either side of the portals and the prizes in the hidden rooms
- Portals that breathe: motes drift out of the way in, and get drawn into the exit
- A background that sits back from the rock, sliding a little slower as you move (parallax)
- The map only keeps what you had a line on: a wall hides its far side from the fog of war for good
- Destructible pixel terrain: explosions and drilling shots eat everything except the outer border
- Guns and mods to find, with a drag-and-drop screen for building them
- 111 mods: shots, static fields, path modifiers, trigger spells, utility casts and the Greek letter copy spells
- A build advisor that measures your damage per second, names the limiting factor and offers one-tap fixes
- A trajectory aim line — unlocked by the Trajectory Sight perk — that simulates the next shot for real: gravity, acceleration, homing, ricochets, drilling and spread
- A minimap in the bottom-left: the revealed cave drawn as white outlines over the gameplay, a third of the screen wide, with a yellow dot for your position
- Recoil that shoves you around, which the jetpack can work with
- Gold that flies to you once you are close enough (a short range for now)
- A black arcade control deck: mono type, scanlines, and two rings on the right stick — the dead zone and the full throw
- Picking a mod up is one tap — its card shows while you stand next to it, and a tap drops it straight in your bag; a gun opens a compare-and-swap chooser so you can pick which of your four slots it takes
- Jetpack with fuel that refills on the ground; upward thrust is instant
- 16 creatures in five shapes, each floor owning its own fixed roster: shooters that hover and fire, turrets that wind up a long shot, chasers that come at you and bombers that burst on contact
- Creature stats and gold scale with the floor they belong to, so the same enemy gets harder as you climb
- Enemies with health bars, drawn in their own colours so you can read what is shooting you
- A gun you just swapped out and dropped stays quiet for two seconds, so you can squeeze past it in a tunnel
- Mods in the wild are rare, so the shop is the reliable place to stock up
- Restart asks before it wipes the run
- A DEBUG shelf with one of every mod, for trying builds out
- 31 perks, hidden one to a brick-lined room on every floor, permanent for the run and shown as icons above the sticks
- A second hidden room per floor holding a +25 max health heart (it raises the ceiling, doesn't heal)
- Loot in the cave sits on the ground now, not floating in place
