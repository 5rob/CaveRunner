# CaveRunner

A jetpack cave platformer prototype that runs in the browser. Each run generates a new destructible cave to climb, from the start at the bottom to the green exit at the top.

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
| Guns & mods screen | Tap Mods | E |

## Guns and mods

Guns work like Noita wands. Each one is rolled at random with its own capacity,
cast delay, recharge time, mana pool, spread and shot speed, and some of them
shuffle their firing order. You carry up to four; walking over a gun with full
hands swaps it for the one in your hand and leaves the old one on the ground.

Mods are the spells. Some are shots (Bolt, Buckshot, Slug, Blast, Bounce Orb...)
and the rest are modifiers (Homing, Heavy Shot, Scatter, Double Cast, Borer...).
A modifier only affects the shots to its **right** on the gun, so the order you
drag them into matters. Firing walks the list left to right; run off the end and
the gun recharges before starting over.

## Features

- Randomly generated caves with cramped and open areas, winding tunnels, built ledges and half-buried brick frames
- Destructible pixel terrain: explosions and drilling shots eat everything except the outer border
- Guns and mods to find, with a drag-and-drop screen for building them
- Recoil that shoves you around, which the jetpack can work with
- Jetpack with fuel that refills on the ground; upward thrust is instant
- Enemies with health bars that shoot back when they can see you
