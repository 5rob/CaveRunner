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

**Sound.** Everything you hear is generated as you play, no sound files. Every spell has its
own sound, and the mods on it change it: faster shots are higher, heavy ones deeper and
louder, homing ones warble, explosive ones crunch. The Black Hole drones and crackles for as
long as it lives. Creatures chatter, click, growl, gurgle or rattle depending on what they
are, and you can hear them in the dark before you see them; a sniper whines as it winds up,
and a bomber ticks faster as it closes in. Each floor has its own background sound (drips in
the moss, embers in the halls, chimes in the crystal, whispers in the void). Sounds come from
where they happen: left, right, near or far. Grabbing a vine or pushing through hanging plants
rustles (softer for mycelium, woodier for roots, wetter for kelp), minecarts go up with a bang
and clattering debris, and spore pods burst with a wet pop — and none of these, or the
explosions, sound exactly the same twice. The exit portal hums as you get near, draws you in
with a rush of air, and you come out the other side on a sparkle. Footsteps and landings sound
like what you're standing on (crunching snow, squeaking ice, squelching slime, splashing
puddles). Things break in their own material (icicles tinkle, geodes chime, statues crumble,
bones clatter); vents hiss before they roar, mushrooms boing, tendrils whip, resonance stones
gong, dark matter warbles, and the eyes in the dark whisper. Your gun clicks when it's
recharged, critical hits ring, enemy shots fizzle on rock, and the bag, shop cards and gun
swaps all have small UI sounds. Volume knobs are in the ⚙️ panel under Sound: overall, ambience, jetpack, your spells,
explosions, bullet hits, enemy fire, creature voices, world/props, footsteps and UI.

**Your run saves itself.** Every couple of seconds, and whenever you put the app away, the
run is saved: floor, guns, bag, perks, gold and health, and the cave itself — what you have
killed, bought and picked up stays gone. Close the app and reopen it to carry on where you
were (at the floor's entrance). Updates keep the save: you come back on the same floor with
all your gear, in a freshly generated cave. Dying or Restart wipes it.

## Controls

| Action | Touch | Keyboard / mouse |
| --- | --- | --- |
| Walk | Left stick, below the line | A / D |
| Jetpack | Left stick, above the line (distance sets speed) | W, or W + A / D |
| Aim | Right stick | Mouse |
| Shoot | Drag the right stick out past the dead zone | Left mouse button |
| Interact: buy, take a gun, mod or perk | Tap the middle of the right stick | F |
| Restart after dying | Tap the right stick | — |
| Pick gun | Tap a gun button (the arc round the right stick) | 1 to 4 |
| Gun details | Hold a gun button | — |
| Reorder guns | Hold and drag a gun button in the build screen | — |
| Bag: guns & mods screen (open anywhere) | Tap the backpack button | E |
| Map (pauses the run) | Tap the map button, again to close | M |

The controls float over the bottom of the screen and are see-through — outlines only, no
fills — so the cave carries on underneath them. The game frames itself to the area above
them. The knob that follows your thumb is a white ring, sized to still show an edge around
a thumbprint rather than vanishing underneath one, so you can see where your thumb is
pointing without lifting it.

Your four guns are round buttons on an arc around the right stick, from the gap between the
sticks, over the top, to near the right edge; each shows its gun's picture and the one you
hold has an amber ring. On the left, mirroring the last gun, is the backpack (the Bag), and
straight above it the map button.

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
are to the end; and your fuel is the orange ring just inside it, wiping away as the jetpack
burns it (its track turns red when the tank is dry). All the rings are thin lines. Near the bottom of the tank the jetpack
starts to cough — the flame cuts out for a blink, it spits grey smoke and you dip a little —
and the longer you hold it on, the higher its roar climbs. The right stick carries three rings for the
gun you're holding — gold mana on the outside, then blue recharge and purple cast delay inset
each — every one a readiness gauge that empties when it fires and fills back over its own
time, so the ring that keeps lingering low is what's limiting your fire. Those same three
colours tint the cast-delay, recharge and mana numbers in the Bag screen, to tie them
together. The floor number is painted big
across the shop's back wall, the version sits top-left, and your gold reads at the bottom of
the gap between the two sticks — a `g`, with thousands shortened to a `k` (so `1234` shows as
`1.2kg`).

The map button opens the map over the whole play area (the run pauses while it's up): the
cave you have uncovered, drawn as white outlines over a see-through black (the cave shows
faintly behind it), with a white-rimmed yellow dot for where you are. Loot you have seen and
not picked up is marked: **green dots for mods, yellow dots for guns** (a hollow yellow ring for
a gun you swapped out and left). A perk room or +25 health room you have found is **outlined
in yellow**, with an **X** through it once you've taken its prize. It only shows what the fog
of war has lifted, so it fills in as you explore. Tap the button again to close it.

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
when they die, so a floor you clear pays for the next floor's shopping. **Gold seams** run
through the rock here and there — dig or blast one open and bits of gold tumble out, more the
more of the seam you take.

A gun lying in the cave that you have never held **glows**, with sparks streaking out of it.
One you swapped out and left on the ground doesn't, so you can tell new from discarded at a
glance.

Every gun has a **level from 1 to 10**, and a floor's guns are that floor's level (floor 10
and deeper: level 10). Level 1 guns are wild — any stat can roll anywhere from awful to
great. Each level narrows the roll toward perfect, so a level 10 gun is great across the
board: lots of slots, mana and regen, fast cast and recharge, tight spread, quick shots,
and it never shuffles. The ranges run from worst to best: 2–25 slots, 1.5s–0.01s cast
delay and recharge, 50–1000 mana, 10–500 mana regen per second, 20°–0° spread, ×0.5–×2
shot speed, a 10–50% chance of casting two at once, and a 50–0% chance of shuffling. Now and then a cave gun is a **rare** one, a random level above the
floor's. A gun's colour shows its level: grey, white, green, teal, blue, indigo, purple,
pink, orange, gold (level 10). Its card reads `Lv N` too.

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
you — it only raises the ceiling. On floor 1 the two rooms are split between the two kinds
of cave: one is somewhere in the built-up parts and the other in the natural parts, and
which is which is a coin toss each cave.

A couple of perks reach into other systems: Extra Item in Holy Mountain makes the shop
offer five things instead of four, and Tinker with Wands Everywhere lets you *edit* your
setup anywhere, not just in the shop. Trajectory Sight is what draws the dotted aim line
that shows where your next shot flies — without it, you aim by feel. The line fades in as
you push the right stick: invisible at the centre, full strength at the trigger ring.

## Floors

Floors 1 to 10 are hand-picked, and they are always the same. Each has its own
colour scheme and its own roster of two to six creatures, and both are fixed to
the floor number rather than rolled with the seed — so the floor you learn on
this run is the floor you meet on the next one. The palette wraps around after
twelve floors, and from floor 11 up the creatures are rolled fresh each floor, so
the run keeps moving rather than settling into a pattern.

**Floor 1 mixes two kinds of cave in big patches.** Some stretches are wild, natural
cave — rounded pockets and winding tunnels, with the odd brick ledge or old frame — and
some are **built-up**, in layers like Noita's Mines. Where one kind meets the other the
rock blends into itself. The patches are different every cave (their size and how much of
the cave is built-up are in the ⚙️ panel under Level layout). The built-up parts are wavy
bands of rock stacked up the
cave with walkable corridors between them, holes to fly up through, the odd wall that
makes a dead end, and loops where two holes lead to the same place. A few big caverns
cut through several layers, with broken bits of rock left hanging in them and
stalactites overhead. Here and there are **old workings** — stretches people levelled
long ago, with worn paving on the floor and timber props holding up the roof. The props
come in patches: some parts of the cave are shored up, others are bare rock. Every
prop stands on the floor and meets the roof. Some pockets can only be reached by
digging. The jellyfish live only in the natural parts — the built-up corridors are too
tight for them to swim — and won't follow you into the layers; they hang at the edge and
spit from there. The built-up parts are **rat country**: rat nests are scattered all
through them (and a few turn up in the natural caves too), and old **lanterns** hang off
the roof and the walls, giving off a little light. Shoot a lantern and it pops, throwing
burning oil that sets fire to any grass, moss, vines or timber it lands on — so mind where
you aim when the rats come, because parts of it are overgrown. The other floors are all
natural cave for now; each one gets its own treatment later.

| Floor | Cave | Who is in it |
|---|---|---|
| 1 | Mossy caves | Myrkkymeduusa, Hämähäkki, Rotta (from nests) |
| 2 | Coal seams | Myrkkymeduusa, Hämähäkki, Hiisi |
| 3 | Frozen deep | Hiisi, Konna, Hämähäkki |
| 4 | Ember halls | Hiisi, Mato, Limanuljaska, Kobold |
| 5 | Fungal grotto | Hiisi, Kärpässieni, Hurtta, Limanuljaska |
| 6 | Salt flats | Snipuhiisi, Hiisi, Hurtta, Stendari, Kärpässieni |
| 7 | Amethyst vein | Snipuhiisi, Lohkare, Mato, Stendari, Kobold |
| 8 | Rustworks | Jäätiö, Chaingunner, Lohkare, Hämähäkki, Hurtta, Kärpässieni |
| 9 | Bone garden | Jäätiö, Chaingunner, Snipuhiisi, Stendari, Lohkare, Elävät luut |
| 10 | Drowned halls | Chaingunner, Snipuhiisi, Lohkare, Elävät luut, Jäätiö, Tappurahiisi |

### Fire

Grass, moss, hanging vines and mycelium, and old timber (pit props, the mine's supports)
all burn. Fire spreads through them a pixel at a time, climbs faster than it creeps down or
sideways, eats what it burns (grass and wood are gone, moss leaves the rock scorched), and
dies out once there's nothing left. Grass goes up in a flash, moss smoulders, timber burns
long. It's lit by the fire spells (Fireball, Firebolt, Meteor, Magic Missile) wherever they
fly, hit or blow up, by other explosions now and then, by exploding minecarts, fire vents,
the Levitation Trail perk, and by Stendari when it blows itself up. Burning vines burn up to
the rock and drop, fire races along an arched vine both ways and lights its strands, burning web lines snap, and a fire that reaches a minecart sets it off.

Creatures that touch fire catch it: they burn for a few seconds, take damage and spread
the fire wherever they go (a burning spider burns its own web). So can you. Standing in a
puddle, snow, ice or slime puts you out, and burning also frees you from spider silk. Fire
you haven't seen stays hidden in the dark; it doesn't light up the map. Every fire number is
a min/max pair in the ⚙️ panel under Fire.

### What each cave is dressed with

Every cave has its own scenery. Some of it is just to look at; the rest does
something. Anything hanging off rock falls when you blast that rock away, and
it hurts if it lands on you. Wall torches and lanterns glow through the dark
even before you reach them. Every floor with hanging plants (vines, mycelium, roots, kelp)
also gets **arched vines** of that plant across its open pockets.

| Cave | Scenery |
|---|---|
| Mossy caves | Overgrown groves thick with **vines** you can hang on (no jetting = you hold on and your fuel refills; push the stick to climb), **long arched vines** slung across the open pockets, thick with leaves and trailing strands (hang on and the stick runs you along the arch; push down to drop), dripping water, moss and rubble, glowing spores |
| Coal seams | **Minecarts that explode when shot** (a very big blast), rusty lanterns, soot falling, pit props, old pickaxes |
| Frozen deep | **Icicles that drop when you walk under them**, **slippery ice**, **snow drifts that slow you**, frozen waterfalls to hang on, icy wind |
| Ember halls | **Lava drips** and **fire vents** that burn, **obsidian spikes**, ash piles, drifting embers |
| Fungal grotto | **Bouncy mushrooms** that throw you up, **spore pods** that burst into a poison cloud when shot, **slime that slows you**, glowing caps, mycelium to hang on |
| Salt flats | **Salt spikes** (brittle, shoot them), salt pillars, cracked ground, old bones, dust devils |
| Amethyst vein | **Geodes** that fall if you dig out their rock, **resonance stones** that ring when shot and wake everything nearby, **broken glass** that cuts if you run over it, glinting shards, crystal dust |
| Rustworks | **Acid pools**, **chains** to hang on, leaking pipes, sparks, huge rusted gears |
| Bone garden | **Skull piles that crunch loudly** and bring creatures running, **bone spikes**, fossil roots to hang on, ribcage arches, dust motes |
| Drowned halls | **Statues that block shots** (yours and theirs), **deep puddles that slow you**, kelp to hang on, waterfalls, old brick floors |
| Ash wastes | **Smouldering logs** (don't stand on them), **crumbling pillars** that stop a few shots then break, heavy ash fall, soot-stained walls |
| Void hollow | **Dark matter** that flips gravity near it, **tendrils** that lash out on a beat, **monoliths** that block shots, neon cracks, eyes in the dark that vanish as you approach |

## Creatures

Sixteen of them, named after Noita's, and they do not all behave the same way:

- **Shooters** (Hiisi, Tappurahiisi, Chaingunner) hover around their
  patch and fire when they have a line on you. The Tappurahiisi throws a cone of
  pellets, the Chaingunner fires in short bursts.
- **Turrets** (Snipuhiisi, Kärpässieni, Jäätiö, Elävät luut) never move. They have
  longer reach and more punch, and the ones worth worrying about show a ring that
  closes before they fire — break the line and the shot never comes.
- **The spider** (Hämähäkki) lives on the rock and on its own silk. It scuttles
  along walls, floors and ceilings in quick darting bursts — lazy when it's alone,
  frantic once it has seen you — and crosses gaps by shooting a white line to the rock
  on the other side and running over it. The lines stay, so a spider's corner of the
  cave fills with web — and you can use them too: brush one and you grab it like a
  vine, hang there getting your fuel back, climb along it with the stick, and push
  down to let go. Pushing through web slows you (×0.8 for each line you touch). Up close it bites; from range it shoots a string that sticks to
  you — each one stuck on slows you (×0.8), until you pull far enough away to snap it.
- **The jellyfish** (Myrkkymeduusa) drifts through the open cave, glowing a poison
  green that lights the rock round it. It swims in pulses: a push along wherever its
  head points, then a long glide as it slows — tall and thin when it has just pushed,
  flattening out as it comes to a stop — with its tentacles streaming behind. It
  can't turn sharply. Once it sees you it turns its head onto you, swims in to
  spitting range and spits a glob of poison that drips as it flies and splats when it
  lands. It stings if it touches you, and brushing its tentacles stings too — even
  when it hasn't noticed you. Every push blows a puff of glowing spores out of its
  rim, and the moss and vines near it glow and twinkle in its colour.
- **Rats** (Rotta) are thieves, and they live in **rat nests**. A nest is a hole in the
  ground (or a wall) with a little mound of earth round it; down a winding tunnel far too
  thin for you is the nest itself, out of sight — you can't see into it, only dig to it.
  Every so often it lets another rat out, up to three to seven of them. A rat that sees you
  runs at you and bites: a little damage, and a coin pops out of you, over the rat's head,
  bouncing to a stop a little way off. The rat runs after it, picks it up in its mouth and
  carries it home to the nest — grab it first to keep it. Rats go for any loose gold near
  them before anything else, so kill something (even another rat) near them and they all
  dive for the drop. If you're broke, a bite does triple damage instead. Kill a rat and it
  drops its own gold plus anything it was carrying; kill a nest (dig down to it, or blast
  it) and it drops 60 gold plus everything its rats brought home. Left alone, rats scurry
  about near their nest, and they jump for things above them.
- **Chasers** (Lohkare, Mato, Hurtta, Kobold, Konna) come at you and
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
the name reads the same in the build screen and on its card — handy
once you are carrying four guns with similar names.

Mods are coloured by what they are for, not one colour each, so you can tell a
bullet from the things that change it at a glance: amber shots, red damage, blue
speed and range, purple flight path, pink shot pattern, green gun upkeep. A
Sort button above your collected mods reorders your collection into those same groups.

Mods are the spells. Some are shots (Bolt, Buckshot, Slug, Blast, Bounce Orb...)
and the rest are modifiers (Homing, Heavy Shot, Scatter, Double Cast, Borer...).
A modifier only affects the shots to its **right** on the gun, so the order you
drag them into matters. Firing walks the list left to right; run off the end and
the gun recharges before starting over.

The build screen (the **Bag**) has four parts. Top left, the selected gun's stats, one
per line: the name in its colour (cast delay purple, recharge blue, mana gold), the value
coloured from red to green by how close it is to perfect, and next to it what the mods on
the gun add or take away (green if it helps, red if it hurts). Top right, your four guns
as square buttons with their picture and name — tap to select, hold and drag to reorder.

Under that is the gun's slots: a fixed grid, one box per slot. A mod stays in whichever box
you drop it in, and empty boxes are skipped. The gun fires the grid left to right, a row at
a time. A coloured light walks the boxes in firing order, a new colour for each pull of the
trigger, so you can see which mods come out together; a mod the gun never reaches is dimmed.
The light is a live preview of holding the trigger down: it fires at the gun's real pace
(cast delay between pulls, recharge after the last one, a pause when mana runs dry), and the
thin bars under Cast delay, Recharge and Mana drain and refill with it, like the rings on the
right stick. Its speed is a Dev-panel knob (Bag screen → Bag fire preview speed, 1 = real
time). At the bottom is your collection of mods, which scrolls. Both the gun's slots and the
collection have a grab bar down the right side: drag it to scroll, or tap it to jump. A swipe
that starts on an empty slot scrolls too (one that starts on a mod picks the mod up).

Cast delay is accumulated in that same order, which makes **Buzzsaw** special: it
does not subtract from the delay, it resets it to zero at the moment it is cast. Anything
cast after it adds its delay back, so it belongs at the tail of a multicast group —
`Double Cast, Bolt, Buzzsaw` fires the bolt and leaves the gun ready immediately.
Recharge, by contrast, counts from any slot.

## DEBUG mode

There is a DEBUG switch in the build screen header. Turn it on and your
collection is replaced by a shelf holding one of every mod in the game, none of
which is ever used up, so you can try a build out properly instead of hoping the
right mod drops. Your own bag is left completely alone while it is on — switch
it off and your mods come straight back, with whatever you fitted still on the
gun.

## The spell book

There are 118 mods, most of them lifted from Noita's spell list and rebuilt to fit
a cave shooter. They come in a few shapes:

- **Shots** are the things that come out of the barrel — Bolt, Slug, Magic Missile,
  Fireball, Lightning Bolt (a crackling bolt that forks off arcs at nearby creatures and rock as it flies), Chain Bolt (which hops from enemy to enemy), Black Hole
  (a slow starry sphere that eats rock, hauls creatures into it and grinds them, and swallows any enemy shot that comes near), **Teleport Bolt** and
  **Small Teleport Bolt** (harmless; wherever the bolt hits or runs out, you appear there — the small one is a short hop, and neither ever puts you inside rock), Pollen (puffs out, drifts to a stop and floats up, then homes on any creature that comes close, popping a tiny crater on whatever it touches), Nuke, Meteor, and twenty-odd more. **Plasma Beam**
  and **Luminous Drill** are instant: they hit along a line with no travel time.
- **Static fields** stay where you cast them and work over time. Unstable Crystal is a
  proximity mine; Dormant Crystal sits harmless until another blast reaches it; Circle
  of Stillness leaves enemies crawling; Circle of Shielding swallows their fire; Circle
  of Vigour heals you while you stand in it; Thundercloud and Glittering Field cover an area.
  **Vacuum Field** is over in a blink: a moment after it appears, every creature, shot, coin
  and loose item within reach snaps into its middle, straight through walls. They take a cast slot like a shot does.
- **Modifiers** change the shots drawn after them, as always. Nine of the new ones bend
  the flight path — Boomerang, Spiral Arc, Ping-Pong, Orbiting Arc, Gravity, Anti-Gravity,
  Horizontal Path, Auto-Aim, Short-range Homing — and the aim line draws every one of
  them properly, so you can see what a path mod will do before you fire it.
- **Utility** does something to the world or to you. Wand Refresh skips the next recharge. Long-Distance Cast, Teleporting
  Cast and Warp Cast move where the shot starts. Blood Magic, Blood To Power and Gold
  To Power buy power with health or gold.
- **Trigger spells** work like Noita's: they are ordinary spells with a payload bolted
  on — Bolt, Magic Arrow, Firebolt, Bubble Spark, Energy Orb and both crystals **With
  Trigger**, and **Bolt With Double Trigger**. A trigger casts the next spell on the gun
  where it hits something (rock, a creature, a prop); if it just runs out of flight, the
  payload is lost. **With Timer** versions (Bolt, Magic Arrow, Spitter Bolt, Energy
  Sphere, Energy Orb, Luminous Drill) let go a moment after firing — or on a hit, if
  that comes first — and the carrier flies on. **Black Hole With Death Trigger** lets go
  when it dies, however it dies. **Add Trigger**, **Add Timer** and **Add Expiration
  Trigger** turn the next projectile on the gun into a carrier. The payload is its own
  little cast: modifiers before the trigger don't reach it, modifiers and multicasts
  inside it only affect it, and a trigger in the payload carries a payload of its own.
  A corner mark on the tile (T, T², ◔, ✝) tells a variant from its base spell.

What the cave and the shops hand out follows **Noita's own spawn table** (its spell tiers):
each spell turns up only at the tiers Noita lists it for, as often as Noita makes it. Floor 1
is tier 0 and floor 10 is tier 6, sliding in between; past floor 10 is the end-game tier. So
Spark Bolt is everywhere early and gone by floor 6, Add Trigger waits for the middle floors,
Octuple and Myriad are deep-cave finds, and Wand Refresh only shows up past floor 10. (The
Greek letter copy spells are switched off for now.)

## Build advice

*(The suggested-change buttons are switched off for now; the damage-per-second line and what's holding it back still show under the slots.)*

Under the slots the build screen works out your sustained damage per second
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
- 118 mods: shots, static fields, path modifiers, trigger and timer spells, and utility casts
- A build advisor that measures your damage per second, names the limiting factor and offers one-tap fixes
- A trajectory aim line — unlocked by the Trajectory Sight perk — that simulates the next shot for real: gravity, acceleration, homing, ricochets, drilling and spread
- A full-screen map (map button, pauses the run): the revealed cave drawn as white outlines, with a yellow dot for your position
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
