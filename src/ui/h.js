// @ts-check
// The React helpers every UI module uses: h (React.createElement, the game uses no JSX)
// and the hooks, off the global React (the page loads it from a CDN <script>).

export const { useRef, useEffect, useState, useMemo } = React;
export const h = React.createElement;
