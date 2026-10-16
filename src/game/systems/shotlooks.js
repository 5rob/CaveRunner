// @ts-check
// What each Noita-style shot sheds as it flies, bounces, grinds and dies (v95 spell looks):
// glowing dparts, chips and puffs. The draw side (drawLook) is still in Game's draw().


/** @param {number} a @param {number} b */
export const rnd = (a, b) => a + Math.random() * (b - a);
