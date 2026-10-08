# CaveRunner

A jetpack cave platformer prototype that runs in the browser. You play a little
white-suited astronaut, drawn in crisp chunky pixels, with arms and legs that bend at the
elbow and knee. You start in a high-tech steel shop room with nothing above it (a new run is met by a
hologram guide with a starter kit). On its back wall, down the hall past the heal, stand
two vending machines: stand at the green one and flick the right stick up or down to pick a floor (its
screen shows that floor's price), then tap it to buy a freshly generated destructible level of it on credit: floor 1 for 1,000,000,000 gold, each floor
up three times the last (it goes on a debt shown in red under
your gold, and you have one real hour to repay it: the buy machine and the
"settlement due" clock at the top count it down, even while the game is closed; miss it and the level is
repossessed, the alarms go off, and ten seconds later the shop floor fills with
fire), and it
teleports in over the shop in a flash and a crackle of lightning, drawn in from the bottom up (it was
built in the background while the shop stood empty, so there's no freeze at the flash). A floor is for
sale only once you've sold the one below it in this run; you can flick one floor past that, shown grey. Climb to one of the
three exits spread along the top (teleporter pads: blue light rising off them, lightning crackling up
the moment you use one) and it drops you back in the shop. The other machine (lit green from the start; half a second
after you buy, its screen glitches to red and adds its fine print) buys
the level back for its debt plus a reward (1,000 gold on floor 1, doubling each floor up: 2,000, 4,000, 8,000…;
kills pay more on higher floors too), but its screen stays red until no biological
entities are left in it (including the rats still inside their nests); sell it and it teleports away, leaving
your debt paid and the reward in your pocket, and the next floor unlocked at the buy machine. You keep your
guns, mods and gold; the cave and the loot are new every time.

**Every floor keeps its identity.** Floor 3 is always the frozen one and always
holds the same mix of creatures, on every run and after every restart — the
cave layout and the loot are rolled fresh, but who lives there and what it looks
like are not. That is deliberate: you learn a floor, and the colour tells you
where you are before you have read the number.

The cave starts dark, and what lights it is the light on your gun: a steady white cone
thrown the way you aim, reaching well ahead of you (once you have a gun), with a small glow round you so you
can see your feet — and the cave outside the cone stays a real unknown. The light only lights
ground you have actually laid eyes on: line of sight is what lifts the dark, so a wall
hides its far side until you go and look round it, and what you have already uncovered
stays a faint map behind you for the rest of the floor. Enemies shoot further than the
light reaches, so a dark corner is a real risk.

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
explosions, bullet hits, enemy fire, creature voices, world/props, drips, footsteps and UI.

**Title screen and save slots.** The game opens on a title screen with **3 save slots**: pick one
and press Start (or Continue). Each slot is its own run with its own unlocked mods and perks; 🗑️
then "Delete?" wipes a slot. Your run from before this update is slot 1. Behind it, four players (blue, red,
green, yellow) tour Mossy Caves sideways (its natural caves, spider caves, the built-up layers with the mine
works' sloping roof, brick works and the vine grove), fighting the real creatures with guns made up at random
from real shots and modifiers, collecting gold and setting things alight (slowly); vines sway as they pass, and
a vine or web line burnt or blasted through hangs from its ends, swinging and burning.
The gun in your hands has the same chunky pixel look as you, in the game, the Bag and the title.

**Pause.** ⏸ (top right) pauses: Resume, Save, a Volume slider for the whole game, and Exit
to main menu (it saves first). **Hold ⏸ for 5 seconds** to show or hide the dev tools: the ⚙️ panel
(beside ⏸), the 📌 / 🗑️ / Give Feedback on mod and perk cards, and the Bag's 💾 save-as-preset.
They're hidden until you do.

**Your run saves itself.** Every couple of seconds, and whenever you put the app away, the
run is saved: floor, guns, bag, perks and suit, gold and health, and the cave itself — what you have
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
| Gun details | Tap the gun button in hand | — |
| Take a gun on the ground | Hold a gun button | — |
| Drop a gun | Hold a gun button (nothing nearby), drag, let go | — |
| Reorder guns | Hold and drag a gun button in the build screen | — |
| Bag: guns & mods screen (open anywhere) | Tap the backpack button | E |
| Map (pauses the run) | Tap the map button, again to close; on the map drag to pan, pinch to zoom | M |
| Pins (on the map) | Tap the pin button to choose one; hold it to drop it where you stand | — |

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

The map button opens the map over the whole screen (the run pauses while it's up): a picture
of the whole floor as it was when it was made — the rock and its decoration in their own
colours — fitted to the screen's height, with the fog of war over it, so only the parts
you've explored show. Your helmet marks where you are, and along the shop at the bottom coloured
squares mark the teleporter (blue), the heal (pink), the level machines (cyan buy, violet sell) and
the mod, gun and perk machines (red, gold, green). It's a map, not a live view: digging
doesn't change it. Drag with one finger to pan, pinch with two to zoom. Nothing else covers it:
the map button stays right where your thumb was, so tap it again to close.

On the map, the **pin button** sits opposite the map button (it's only there on the map). Tap it for a grid of pins — the ones you've
used before, then **+**, which opens a box for a new one: any single character, a letter, a
number, a symbol or an emoji. Pick one and the button shows it; **hold** the button to drop
that pin where you stand. Pins show on the map, standing on their spot.

## Witness yourself

When you die your body goes limp and falls like a rag doll: it slumps to the floor, or is
thrown through the air if a blast caught you (and a blast after you're dead still throws it).

When you die, the game keeps running for three more seconds, then a **WITNESS YOURSELF**
button comes up on the death screen. It replays the last **10 seconds before your death and
the 3 after it**, drawn exactly as the game draws it: creatures, shots, fire, digging and all.

- The bar along the bottom scrubs through it; the red tick is the moment you died, and the
  clock counts in seconds from it (`−4.2s`, `+1.0s`).
- ⏮ back to the start, ▶/⏸ play and pause, and **.25× .5× 1× 2×** for the speed.
- It loops round by default; **Loop** turns that off so it stops at the end.
- **Fog** turns the fog of war on or off, so you can see what was coming at you in the dark.
- Drag to move the camera, pinch (or the mouse wheel) to zoom. **Follow** puts it back on you.
- **Close** goes back to the death screen, where a tap on the right stick restarts as usual.
- It plays the sounds too, as they happened.
- **💾 Save** keeps it, to watch again later (see below).
- **🎬 Export video** plays it once from the start, just as you've set it up (where the camera
  is or whether it follows you, the zoom, the speed, fog on or off), records it with its sound,
  and saves an MP4 to the phone, in **Movies/CaveRunner**, the shape of your screen. (Saving videos needs the app from
  the releases page as of v124; if your phone can't record MP4 itself, the video is converted
  with ffmpeg, which downloads once, about 30 MB.)

Only the area round you is recorded (about a screen and a half each way), so if you pan far
off, the cave is there but the creatures aren't.

**Saved deaths** are in the Bag, on its third tab, **Witness**: a picture of each (the moment
you died), its floor, length and size. Tap the picture to play it full screen, with the same
controls (and Export video); Close brings you back to the tab. **✏️ Rename** and **🗑️** (delete,
after a "Delete?") are under each one. A saved death keeps only what's round your path, so it
stays small (around half a megabyte to a couple of megabytes); you can drag the camera off
you only a little way (Dev → Witness sets how far, and the exported video's quality).

## Picking things up

Mods and guns in the cave sit on a floor of their own now, not floating in place.

The middle of the right stick is a dead zone: drag out past it to aim and fire,
tap it without leaving it and you interact with whatever you are standing at.
That one button uses the shop's heal and machines and picks up guns and mods in the cave.
Crystals can't be picked up: they're rocks you shove along by walking into them, or carry with the
Gravity Gun, into the shop's crystal machines.

Walking over something no longer takes it. You get its card instead — a slim panel
that floats just above the item with the price built into it — so you can read a mod
or compare a gun against the one you are holding, and see what it costs, in one panel.
A long stat list (a loaded gun, a busy mod) scrolls inside the panel so it never grows
tall enough to fill the screen. At the bottom of the card is a small circle with an **R**
in it — tap the right stick — next to the price (or "free").

Once you have read the card, a tap on the right stick takes it. A **mod** goes straight
into your bag — no second screen, since a mod has no slot to choose. A **gun** is taken by
holding one of your gun buttons instead (see **Guns and mods** below).

## The shop

Every floor starts in an enclosed room spanning the width of the level, with one
hole in the roof leading up into the cave. You arrive at the far left, on the
teleporter pad you came in through (a plank nailed over its old "PRINTER" plate says
TELEPORTER). Everything else stands at the far right end: the full heal, then the machines out
to the end wall, with an empty hall between. A new run starts with the shop dark:
the teleporter charges up for a second and you come through it in a flash of lightning; it crackles blue, your torch shows what's near, and a second after you're in the ceiling tube
over the teleporter stutters on. Each tube throws a pool of light with dark between (your torch only
takes the edge off it), with dust hanging in each cone of light. Each time you walk into the last lit section, the next
one along flickers on just before you reach the dark. Once the dark stretch ahead is well on screen,
the light over it snaps on — and a little see-through blue hologram of you is hovering right under it,
waving, with bright distortion bars rolling over it. A speech box over it types out a welcome
(Dev → Guide hologram: how fast it types), then it hands you a starter kit out of its body one
thing at a time — 150 gold, two red crystals and a green one, Buzzsaw, Bolt and Double Cast,
and a level 5 gun with three slots that fires in order, one shot a cast, recharging in half a second — and glitches away. Walk on out of
its pool of light before it's done and it glitches, says something rude and vanishes without the kit. Then the
rest of the hall lights up as you go, one vending machine at a time (they stand evenly spaced),
and once you reach the perk machine the rest comes on. The first
heal on a floor is free; after that it costs 100 gold, and each one after costs
1.75 times the last (100, 175, 305, 535…). Deeper floors raise the price the same
way they raise what enemies pay out. A new floor's shop starts it free again.

The three vending machines run left to right: guns, mods, perks.
The **mod machine** past the gun machine (a flickering red ⚙️ hologram, a red-rimmed slot) and the
**perk machine** (a green ✦, a green slot) are **crystal machines**: they have no menu. Bring a red
crystal near the mod machine, or a green one near the perk machine, and it's sucked in; the
machine's lights race and it shakes faster and faster for a couple of seconds, then pops out a mod
from the floor you're on's drop table, by its odds (it can be one you already have; a new one is
unlocked), or a perk you've never had (perks are one of a kind: never given twice), for you to pick up. Several crystals queue up. Mods unlocked last the run: dying empties them (unlocked perks
stay). (Their old menus are kept, switched off, in case they come back.) Until a real crystal has gone
into one this run, standing near it plays a little blue hologram of how: a crystal blinks in on the
floor beside it and is sucked into the slot, again every couple of seconds. The gun machine still has its
menu; while you have no gun at all, its first gun is a **Scratch Pistol**, free. Tap things directly, or use the sticks: in a machine's menu the **right
stick is a pointer** — drag it and a thin ring pushes out from the knob and travels much further
than your thumb (the stick's full reach takes it to the far corner of the screen, and it stops
at the edge). It snaps gently onto the nearest button. Whatever it's over lights up; let go
over a button to press it. A plain tap on the right stick presses the lit button (keyboard:
arrows to step, and R, F or Enter).

Guns come from the second machine, in the middle of the room, with a gold gun hologram. Its menu offers **three
guns** from the floor's pool, stacked on the left with their prices (worked out from their
rolled stats and their level); the selected one's full stat sheet and mod grid is on the
right. **Buy selected** pops it out of the machine onto the floor. **Reroll** spins all three
again for gold, dearer each time on the same floor.
The guns spin like slot-machine reels and lock in one at a time with a thud.

**Red crystals** lie about the cave where guns and mods used to: a big dark-red nugget with
white glints, shedding little sparkles that drift off on the cave's breeze (and trail behind it
when it moves). You can't pick it up: walk into it and it rolls along ahead of you, or grab it
with the **Gravity Gun** (its White Hole holds it up and drags it wherever you aim), and get it
to the mod machine. **Elite** creatures — a few
on every floor, tinted gold with a glow — are tougher, hit harder, drop four times the gold
and a pile of crystals: three to five red and a green one. Elites
burn: fire particles stream off their bodies and trail behind them as they move (Dev → Elites: flames
shapes it: a colour gradient you edit by placing and dragging stops, an opacity-over-life curve, the
flame's length, wavyness, air resistance and more).
(Dev → Elites sets how many a floor gets, how tough and big they are, their tint and glow, and what they drop.) (Crystals carried from an older save still show at the top as red and green silhouettes.) Which spells turn up follows Noita's own spawn table, deeper floors handing out rarer ones — and the very strongest (Black Hole and friends) never appear before floor 4. Your **Bag** opens anywhere,
but *changing* your setup — dragging mods, reordering guns — only works in the shop (or
anywhere, with the Tinker perk); out in the cave the Bag is read-only. Enemies drop gold
when they die, so a floor you clear pays for the next floor's shopping. **Gold seams** run
through the rock here and there — dig or blast one open and bits of gold tumble out, more the
more of the seam you take. Gold comes as **nuggets** in three sizes — small (1), medium (5) and
big (25) — and a rich kill bursts into a mix of them that adds up to what it was worth. They
bounce, roll down slopes and pile up beside each other rather than on one spot.

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

Every floor also hides one small room, built brick-lined like the shop, carved out of the
cave and connected back to the main route by a tunnel — you have to find it. On its altar
sits a **green crystal**: walk up to it and it drops off the altar, for you to push or drag to the perk machine. (The +25 health heart room is gone.)
Elites drop green crystals too.

Green crystals turn into perks at the **perk machine** in the shop, the one with a green ✦ hologram,
right of the mod machine: get one near it and it's sucked in, and after the shake it pops out a
random perk you haven't got (kept for good, across runs). There are 31 perks copied from Noita (200g each) —
Glass Cannon, Fire Immunity (you never catch fire; blasts still hurt), Extra Health, Faster Wands, Homing Shots, Unlimited Spells, Permanent Shield,
Pinpointer, Trajectory Sight, Angry Ghost, Attract Gold, radars and Invisibility among them —
and 30 **stat perks**: Max Health, Movement Speed, Jetpack Fuel, Jetpack Recharge, Gold
Vacuum and **Carrot** (you see further: the camera pulls back, the torch reaches further and the
aim line runs longer, but creatures notice you from further off), each in five levels (I–V, 60g up to 650g). A crystal only unlocks a stat perk's next
level once you have the one below it.

A perk you pick up is carried, and only counts once it's fitted to your **Exo Suit**. The Bag
has two tabs along the bottom: **Guns & Mods** and **Exo Suit**. The Exo Suit shows your
portrait (the runner hovering on its jet), your money and crystals, your **stats** — max health,
movement speed, jetpack fuel, jetpack recharge, gold vacuum — each with a slot beside it that
takes only that stat's perks, **six perk slots** for the rest, and every perk in a grid: the ones you
carry lit (with how many), the ones you've unlocked but don't carry faded, the rest blank tiles in their place (nothing
given away until you unlock them).
Drag a carried perk onto a slot to fit it, a fitted one to another slot to swap, or off the
slots to take it out again. The **Mini-map** perk shows a small map over the gun buttons (tap it to
zoom out twice, a third tap back): you as an arrow, creatures and crystals where you've explored, your
pins (stuck to the edge when they're off it). Each perk fits once: one already fitted shows ticked and faded, and a
second copy can't go in another slot. Tap any perk to see its card. The suit is locked outside the
shop: change it there (or anywhere, with Tinker). The Exo Suit tab is where you see what's fitted
(there's no perk column on the play screen any more).

A couple of perks reach into other systems: Tinker with Wands Everywhere lets you *edit* your
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
through them (and a few turn up in the natural caves too) — rats are quick but die to a single hit, and each nest is a little winding tunnel to a hidden room you only see into once you dig a clear line to it — and old **lanterns** hang off
the roof and the walls, giving off a little light. Shoot a lantern and it pops, throwing
burning oil that sets fire to any grass, moss, vines or timber it lands on — so mind where
you aim when the rats come, because parts of it are overgrown. **Floor 2 is the Tombs**: an ancient tomb of carved rooms, galleries and shafts, each
room furnished for what it was — ossuaries, shrines, halls, stores — with skeletons everywhere
and the candles long out. Parts of it have been swallowed by **dark zones**: rough caves and
tunnels under a thick coat of silk, where your gun light flickers out, everything is a black
silhouette against the blurred glow behind the silk, and only fire lights the way. Round each
zone is a ring of old blast holes, scorched and streaked, with bones sticking out of the floors.
Nothing lives in the tomb itself — just the gold and red crystals the dead left lying about —
but each zone hides a prize in its middle (a stash of gold, red crystals or green ones), and is
crawling with **aliens**: hundreds of eyeballs on three legs that pour away from fire and only
come for you in the dark. A passing shot gives a glimpse of them; to clear them you have to bring
fire in and corner them. Now and then a black one is found loose in the tomb, running home.
The other floors are all natural cave for now; each one gets its own treatment later.

| Floor | Cave | Who is in it |
|---|---|---|
| 1 | Mossy caves | Myrkkymeduusa, Hämähäkki, Rotta (from nests) |
| 2 | Tombs | The aliens, in the dark zones only |
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
long. It's lit by the fire spells (Fireball, Firebolt, Flamethrower, Meteor, Magic Missile) wherever they
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

Vines and web lines give a little. Web lines sag. Fly through a web line or an arched vine and it
bends the way you went, wobbles, then settles. Drop onto one and it dips under you and you bob on
it. Brush past a hanging vine and it swings. Grab one while you're moving and you swing back and
forth on it until it settles; hold it near the top and the rest of it trails and bends below
your hands. The jetpack always takes you off.

| Cave | Scenery |
|---|---|
| Mossy caves | Overgrown groves thick with **vines** you can hang on (no jetting = you hold on and your fuel refills; push the stick to climb), **long arched vines** slung across the open pockets, thick with leaves and trailing strands (hang on and the stick runs you along the arch; push off it any way, or past its end, to drop), dripping water, moss and rubble, glowing spores |
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

Sixteen of them named after Noita's, plus the Tombs' aliens, and they do not all behave the same way:

- **Shooters** (Hiisi, Tappurahiisi, Chaingunner) hover around their
  patch and fire when they have a line on you. The Tappurahiisi throws a cone of
  pellets, the Chaingunner fires in short bursts.
- **Turrets** (Snipuhiisi, Kärpässieni, Jäätiö, Elävät luut) never move. They have
  longer reach and more punch, and the ones worth worrying about show a ring that
  closes before they fire — break the line and the shot never comes.
- **The aliens** live only in floor 2's dark zones: helmet-sized eyeballs on three thin legs, in
  packs of hundreds that flow over the silk, scatter from fire and only bite when you're in the dark.
  One or two hits kill one. A black one loose in the tomb is a stray: it sprints back to its zone.
- **The spider** (Hämähäkki) lives on the rock and on its own silk. It scuttles
  along walls, floors and ceilings in quick darting bursts — lazy when it's alone,
  frantic once it has seen you — and crosses gaps by shooting a white line to the rock
  on the other side and running over it. The lines stay, so a spider's corner of the
  cave fills with web — and you can use them too: brush one and you grab it like a
  vine, hang there getting your fuel back, climb along it with the stick, and push
  off it any way (or run off its end) to let go. Pushing through web slows you (×0.7 for each line you touch). Up close it bites; from range it shoots a string that sticks to
  you — each one stuck on slows you (×0.7), until you pull far enough away to snap it.
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
  Every so often it lets another rat out, up to three to seven at a time, and four to six
  in all: once they're out, the nest is empty. The hologram counts the rats still inside, so
  the count only ever goes down. A rat that sees you
  runs at you and bites: a little damage, and a coin pops out of you, over the rat's head,
  bouncing to a stop a little way off. The rat runs after it, picks it up in its mouth and
  carries it home to the nest — grab it first to keep it. Rats go for any loose gold near
  them before anything else, so kill something (even another rat) near them and they all
  dive for the drop. If you're broke, a bite does triple damage instead. Kill a rat and it
  drops its own gold plus anything it was carrying; kill a nest (dig down to it, or blast
  it) and it drops 60 gold plus everything its rats brought home. Left alone, rats scurry
  about near their nest in little bursts; once they're after something they run flat out,
  finding their way round walls, up rock faces and over gaps — they jump gaps and drop off
  ledges (they can't walk on air), and they'll happily run along a spider's web line.
  A pack out and about fans out round its nest rather than moving as one lump.
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
shuffle their firing order. You carry up to four. A new run starts with **no guns and no gold**:
the guide's kit has a gun, and while you have none the gun machine gives away a weak **Scratch
Pistol** (one Bolt) free. Anything you find on floor 1 beats the pistol. (Before v0.0.142 you started
with the pistol, a **Pick Axe** — one slot, a **Buzzsaw** — and the **Gravity Gun**, Follow Me then a
White Hole; they're still in the code, `startingGuns`, and the browser tests start with them.)

**The Bag's header** shows the gun's name in its colour: ✏️ renames it, 🖼️ picks its look from a
gallery of 27 pixel-art guns (a gun you haven't given a look wears the one nearest its colour), and 💾 saves the gun with its mods as a
preset you can spawn from ⚙️ → Spawn gun (🗑️ there removes one). The gun buttons round the right
stick are ringed in each gun's colour. Every gun's pixel art is drawn at the same pixel size everywhere (a pistol
looks small, a sniper long), and the gun in your hand is drawn at twice its old size.

Standing next to a gun on the ground shows its card, its stats coloured against the gun in your
hand (green for better, red for worse, counting a smaller cast delay, recharge or spread as better).
To take it, **hold one of your round gun buttons** (the empty dotted one too): a ring fills round it,
and when it's full the gun goes into that slot — whatever was there is left on the ground where the
new one lay. With no gun nearby, holding a gun button lifts that gun out under your finger: drag it
anywhere and let go to drop it on the ground there (at your feet if that spot is inside rock or out
of sight); it's no longer yours. Let go back over its button to change your mind. Tap a gun button
to hold that gun; tap the one already in your hand for its card. A gun's mods show as the same
square tiles as the Bag's; tap one (on a card, at the gun machine or in the Bag) for that mod's card.

Every gun is given its own colour when it is made, and keeps it for the run, so
the name reads the same in the build screen and on its card — handy
once you are carrying four guns with similar names.

Mods are coloured by what they are for, not one colour each, so you can tell a
bullet from the things that change it at a glance: amber shots, red damage, blue
speed and range, purple flight path, pink shot pattern, green gun upkeep. A
Sort button above your collected mods reorders your collection into those same groups.

Mods are the spells. Some are shots (Bolt, Buckshot, Slug, Blast, Bounce Orb...)
and the rest are modifiers (Homing, Heavy Shot, Scatter, Double Cast, Borer...).
A modifier only affects the **next** spell to its right on the gun (several in a row all
land on that one spell; the spell after it comes out plain), so the order you
drag them into matters. Mods you collect twice stack in the Bag, with a count in the corner;
each gun slot still takes one. Firing walks the list left to right; run off the end and
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
- **The cheap, common spells each have their own character**, after their Noita twins:
  **Bolt** is a pink sparkle on a slight arc with a fading pink trail, nicking the rock
  where it lands; **Spark** crackles along in a zig-zag shedding hot sparks; **Buckshot**
  lobs five little green fireballs that skip once off rock and pop small holes;
  **Spitter Bolt** is a pink glob that slows fast, droops and skitters off rock; **Bubble
  Spark** is a slow glowing bubble that lights up the cave, bobs upward, bounces about
  twenty times and pops; **Magic Arrow** is a green arrow on a long shallow arc trailing
  green sparks, and it knocks creatures back; **Digging Bolt** is a short-range grinder in a
  puff of blue smoke that throws out chips of the rock it chews; **Small Teleport Bolt** is
  nothing but a streak of blue sparks; and **Explosion of Brimstone** sets things alight
  and throws burning sparks (mind your feet).
- **So do the rest** (all but Black Hole): **Slug** is a green-gold ball that droops, shoves
  and blasts a small hole; **Lance** is a blue spear that speeds up as it flies (the
  **Glowing Lance** a shining golden one that lights the cave); **Bounce Orb** is a rubber
  ball that falls and barely slows on each bounce; **Blast** is a real bomb with a lit fuse
  that bounces and rolls and goes off when the fuse burns down (or at once on a creature);
  **Magic Missile** is a little rocket that leaves slowly in a trail of smoke then roars
  off; **Fireball** is a slow, big, drooping ball of flame; **Firebolt** a lobbed flame that
  bounces four times; **Flamethrower** a fast spray of short flames the way you aim, rising as they
  slow, passing through creatures and setting alight whatever they lick; **Energy Orb** a slow blue orb that shoves and blasts a round hole;
  **Energy Sphere** a blue ball that arcs and bounces; **Chain Bolt** a slow crackling violet
  orb; **Death Cross** a tumbling cyan cross; **Disc Projectile** a spinning sawblade that
  skips along throwing sparks; the **Nuke** droops, drips green and sets the cave alight;
  **Meteor** is a falling ball of fire; beams throw sparks off their end (the Plasma Beam
  scorches a hole). Fields got looks too: the crystals are crystals (the mine blinks faster
  when something's close), **Circle of Stillness** frosts out any fire inside it, the
  **Thundercloud** is a real cloud whose lightning comes down out of it and whose rain puts
  out fires, and **Explosion** leaves fire behind.
- **Static fields** stay where you cast them and work over time. Unstable Crystal is a
  proximity mine; Dormant Crystal sits harmless until another blast reaches it; Circle
  of Stillness leaves enemies crawling; Circle of Shielding swallows their fire; Circle
  of Vigour heals you while you stand in it (green plus signs rise inside it); Thundercloud and Glittering Field cover an area.
  **White Hole** (Noita's Vacuum Field) is a tiny white-and-blue hole, with specks being drawn
  into it, that pulls every creature, their shots, coins and loose items within reach hard into its
  middle and holds them there, straight through walls, harming nothing. They take a cast slot like a shot does.
- **Modifiers** change the next spell drawn after them (only that one).
  **Aim Assist** turns the aim stick into a pointer that snaps onto creatures and fires by itself
  once it's on one (no aim line or crosshair). **Follow Me** pulls a shot back to you (and brings a field to you); **Follow This** holds a field just ahead of
  your gun (the Gravity Gun's). **Buffs** (×1.5, ×2, ×5) and **nerfs** (×0.75, ×0.5, ×0.2) scale every number of the
  next mod, a modifier's effect included. **Discriminate** is set once per copy: tap it in the
  Bag, **Set target**, point at a creature, yourself or an object and let go; its shot then passes
  through everything else and only hits that kind. Several bend the flight path,
  and the aim line draws every one of them properly: **Boomerang** flies out and, halfway through
  its flight, turns and comes back into your hand; **Ping-Pong** snaps back a little and on again;
  **Spiral Arc** swings side to side in a widening wave along its line; **Orbiting Arc** circles
  whatever cast it (your gun, or a trigger spell's carrier as it flies on); **Follow Me** is Homing
  aimed at you. Gravity, Anti-Gravity, Horizontal Path, Auto-Aim and Short-range Homing too. Path
  mods work on static fields as well: put one before a field and the field moves (Follow Me makes it
  hover just ahead of your gun). **Enlarge** / **Shrink** make a shot or field 1.5× bigger or smaller,
  with every radius it works over (blasts, fields, pulls, digging); **Longer Flight** / **Shorter
  Flight** 1.5× its flight time. Each pair undoes the other.
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
- A light on your gun (since v0.0.145): a cone of white light the way you aim, swinging after the aim, stopping at rock, and a small glow round you. (The old hand torch, a pixel flame with embers, is kept in the code for creatures later)
- The jetpack's flame and smoke in the same chunky pixels, out of the bottom of the backpack: a licking fire, not a cone
- Wall torches either side of the prizes in the hidden rooms
- The vending machines' screens in a blocky terminal font: "BUY lvl 01" / "SELL lvl 01", the price in bold, fine print under it
- Teleporter pads for the way in and three exits along the top: a beam of blue light fading upward, specks rising in it, lightning crackling off a pad when it's used
- Dev knobs for how many enemies a new level gets (and how many more each floor), the level's sell reward, and how fast the debt, reward and kill gold climb floor by floor
- Dev → Level 2: floor 2's cave shape (feature size, vast areas, pockets, tunnels, the main route, chambers, side tunnels, smoothing, ledges, frames, platforms), its colours and how much decoration it gets; Dev → Floor 2 takes you there
- A background that sits well back from the rock, sliding slower as you move (parallax), with a big slanted bright-red hologram halfway between, drawn in chunky pixels like the rock, whose light blooms over the cave: "N biological entities detected", counting every creature alive on the floor plus you while you're out of the shop; it flips and turns green at zero. It rests dark and flashes up on every kill, fading out over a few seconds (Dev → Hologram flash: brightness at rest and on a kill, fade length, and a curve to shape the fade)
- The map only keeps what you had a line on: a wall hides its far side from the fog of war for good
- Destructible pixel terrain: explosions and drilling shots eat everything except the outer border
- Guns and mods to find, with a drag-and-drop screen for building them
- 118 mods: shots, static fields, path modifiers, trigger and timer spells, and utility casts
- A build advisor that measures your damage per second, names the limiting factor and offers one-tap fixes
- A trajectory aim line — unlocked by the Trajectory Sight perk — that simulates the next shot for real: gravity, acceleration, homing, ricochets, drilling and spread
- A full-screen map (map button, pauses the run): the floor's picture under the fog of war, your helmet where you are, drag to pan and pinch to zoom, and emoji pins you drop with the pin button
- Recoil that shoves you around, which the jetpack can work with
- Gold that flies to you once you are close enough (a short range for now); gold just knocked loose by a kill or a dig waits a quarter of a second first, so you see it
- A black arcade control deck: mono type, scanlines, and two rings on the right stick — the dead zone and the full throw
- Picking a mod up is one tap — its card shows while you stand next to it, and a tap drops it straight in your bag; a gun goes into whichever gun button you hold
- Jetpack with fuel that refills on the ground; upward thrust is instant
- 16 creatures in five shapes, each floor owning its own fixed roster: shooters that hover and fire, turrets that wind up a long shot, chasers that come at you and bombers that burst on contact
- Creature stats and gold scale with the floor they belong to, so the same enemy gets harder as you climb
- Enemies with health bars, drawn in their own colours so you can read what is shooting you
- A gun you just swapped out and dropped stays quiet for two seconds, so you can squeeze past it in a tunnel
- Red crystals in the cave: push them or drag them with the Gravity Gun into the shop's mod machine, which shakes and pops out a new mod
- Restart asks before it wipes the run
- A death replay: the last 10 seconds before you died and 3 after, with sound, scrubbing, slow motion, a fog toggle, pan and pinch-zoom; save it to the Bag's Witness tab, or export it as an MP4
- Your body falls like a rag doll when you die, and blasts throw it
- A DEBUG shelf with one of every mod, for trying builds out
- 30 perks and 30 stat perks (six stats, five levels, Carrot among them: see further), unlocked with green crystals (one hidden in a brick-lined room on every floor, more from elites) at the perk machine, bought for gold and fitted to the Exo Suit
- Elite creatures on every floor: tougher, glowing, and worth gold plus a pile of red and green crystals
- Vines and web lines give: they sag, bend as you fly through, dip when you hang on, and hanging vines swing
- Loot in the cave sits on the ground now, not floating in place
