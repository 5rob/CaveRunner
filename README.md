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
| Guns & mods screen (shop only) | Tap Mods | E |
| Buy / take shop item | Tap Buy | F |

## The shop

Every floor starts in an enclosed room spanning the width of the level, with one
hole in the roof leading up into the cave. It stocks four random mods for gold
and one free full heal; stand on a plinth and its full detail card appears, the
same one the build screen shows, so you can read what a mod does before paying
for it. and it is the only place you can rearrange your guns —
the Mods button is locked while you are out in the cave. Enemies drop gold when
they die, so a floor you clear pays for the next floor's shopping.

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

Mods are the spells. Some are shots (Bolt, Buckshot, Slug, Blast, Bounce Orb...)
and the rest are modifiers (Homing, Heavy Shot, Scatter, Double Cast, Borer...).
A modifier only affects the shots to its **right** on the gun, so the order you
drag them into matters. Firing walks the list left to right; run off the end and
the gun recharges before starting over.

In the build screen each pull of the trigger is drawn as its own outline, so you
can see which mods come out together — a modifier sits inside the outline of the
shots it affects, and anything the gun never reaches is marked "never cast".

Cast delay is accumulated in that same order, which makes **Buzzsaw** special: it
does not subtract from the delay, it resets it to zero at the moment it is cast.
Anything cast after it adds its delay back, so it belongs at the tail of a
multicast group — `Double Cast, Bolt, Buzzsaw` fires the bolt and leaves the gun
ready immediately. Recharge, by contrast, counts from any slot.

## Features

- Floors that chain: shop, cave, exit, next shop, with gold and gear carried over
- Randomly generated caves with cramped and open areas, winding tunnels, built ledges and half-buried brick frames
- Destructible pixel terrain: explosions and drilling shots eat everything except the outer border
- Guns and mods to find, with a drag-and-drop screen for building them
- Recoil that shoves you around, which the jetpack can work with
- Gold that flies to you once you are close enough (a short range for now)
- Jetpack with fuel that refills on the ground; upward thrust is instant
- Enemies with health bars that shoot back when they can see you
