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
| Pick weapon | Tap a slot, or the switch button | 1 to 4 |

## Features

- Randomly generated caves with cramped and open areas, winding tunnels, built ledges and half-buried brick frames
- Destructible pixel terrain: grenades blast holes in everything except the outer border
- Jetpack with fuel that refills on the ground
- Enemies with health bars that shoot back when they can see you
- Gun and grenade launcher, with an arc preview for grenades
