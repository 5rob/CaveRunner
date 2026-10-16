// @ts-check
// Flight paths (v0.0.137): Boomerang, Ping-Pong, Spiral Arc, Orbiting Arc, Follow Me and Follow This, in one
// pure function, pathStep, that moves a shot in flight, a static field a path mod set moving, and
// the aim line's pretend shot (tracePath) the same way, so the three always agree.


export const FOLLOW_PULL = 250;      // Follow Me/This on a shot: the pull, units/s² per point (Follow Me's 4: 1000)
export const FIELD_SPEED = 150;      // a field a path mod moves travels at this
export const SEEK_ACC = 7;           // ... and steers this hard (1/s) when it heads for something

