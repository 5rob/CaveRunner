# CaveRunner

A jetpack cave platformer prototype that runs in the browser. Each floor is a
shop room with a freshly generated destructible cave above it: climb from the
shop to the green exit at the top, and the exit drops you into the next floor's
shop. You keep your guns, mods and gold; the cave, the enemies and the loot are
new every time.

## Play

Open `index.html` in a browser. It is a single file with no build step; React loads from a CDN.

## Controls

| Action | Touch | Keyboard / mouse |
| --- | --- | --- |
| Walk | Left stick, below the line | A / D |
| Jetpack | Left stick, above the line (distance sets speed) | W, or W + A / D |
| Aim | Right stick | Mouse |
| Shoot | Hold right stick | Left mouse button |
| Pick gun | Tap a gun slot | 1 to 4 |
| Gun details | Hold a gun slot | — |
| Reorder guns | Hold and drag a gun tab in the build screen | — |
| Guns & mods screen (shop only) | Tap Mods | E |
| Buy / take shop item | Tap Buy | F |

## The shop

Every floor starts in an enclosed room spanning the width of the level, with one
hole in the roof leading up into the cave. You arrive at the far left, beside the
portal you came in through, and the stock is laid out to your right. There is
always one free full heal, and four things for sale beside it.

Odd floors sell mods. **Even floors sell guns instead** — four freshly rolled
ones, priced on what they can actually do: slots, how fast they cycle, mana, and
whether they fire in the order you set them. Buying one drops it at the plinth
and the usual pickup chooser opens, so you decide which slot it takes, and
walking away parks it on the shop floor rather than binning what you paid for.

Stand on any plinth and its full detail card appears — the mod card the build
screen shows, or the gun's stat sheet compared against the one you are holding —
so you can read what you are buying before paying for it. The shop is also the
only place you can rearrange your guns: the Mods button is locked while you are
out in the cave. Enemies drop gold when they die, so a floor you clear pays for
the next floor's shopping.

Guns get better as you go. Height in the cave still matters — the ones lying
around near the top of a floor beat the ones near the bottom — but every floor
you clear lifts the whole range, so by floor five or six the scratch pistols have
stopped turning up.

## Guns and mods

Guns work like Noita wands. Each one is rolled at random with its own capacity,
cast delay, recharge time, mana pool, spread and shot speed, and some of them
shuffle their firing order. You carry up to four. Walking onto a gun on the ground pauses the game and opens
a chooser: it shows what you found, with a button for each of your four slots.
Tap a slot to compare that gun, hold one to swap it out — whatever it replaces
is left on the ground where you found the new one. The found gun's stats are
coloured against whichever of your guns you last tapped (your held gun to start
with), green for better and red for worse, counting a smaller cast delay,
recharge or spread as better.

Mods are coloured by what they are for, not one colour each, so you can tell a
bullet from the things that change it at a glance: amber shots, red damage, blue
speed and range, purple flight path, pink shot pattern, green gun upkeep. A
legend sits above your collected mods.

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
does not subtract from the delay, it resets it to zero at the moment it is cast.
Anything cast after it adds its delay back, so it belongs at the tail of a
multicast group — `Double Cast, Bolt, Buzzsaw` fires the bolt and leaves the gun
ready immediately. Recharge, by contrast, counts from any slot.

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

There are 108 mods, most of them lifted from Noita's spell list and rebuilt to fit
a cave shooter. They come in a few shapes:

- **Shots** are the things that come out of the barrel — Bolt, Slug, Magic Missile,
  Fireball, Lightning Bolt, Chain Bolt (which hops from enemy to enemy), Black Hole
  (which crawls forward eating rock), Nuke, Meteor, and twenty-odd more. **Plasma Beam**
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

## Features

- Floors that chain: shop, cave, exit, next shop, with gold and gear carried over
- Randomly generated caves with cramped and open areas, winding tunnels, built ledges and half-buried brick frames
- Destructible pixel terrain: explosions and drilling shots eat everything except the outer border
- Guns and mods to find, with a drag-and-drop screen for building them
- 108 mods: shots, static fields, path modifiers, utility casts and the Greek letter copy spells
- A build advisor that measures your damage per second, names the limiting factor and offers one-tap fixes
- An aim line that simulates the next shot for real: gravity, acceleration, homing, ricochets, drilling and spread
- Recoil that shoves you around, which the jetpack can work with
- Gold that flies to you once you are close enough (a short range for now)
- Jetpack with fuel that refills on the ground; upward thrust is instant
- Enemies with health bars that patrol around their patch and shoot back when they can see you
- A gun you decided against stays quiet for two seconds, so you can squeeze past it in a tunnel
- A DEBUG shelf with one of every mod, for trying builds out
