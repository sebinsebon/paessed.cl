# Dashboard v3.9 — tour navigation and mobile Sileo

- The guided tour now scrolls smoothly to each highlighted area when it opens or the user advances/goes back. Short sections are centered in the unobstructed viewport between the fixed header and tour dialog; larger ones align at the start. Reduced-motion users skip scroll animation.
- All four tour sections receive stable target IDs, and the tour dialog provides a target for calculating the visible space.
- On mobile/tablet, Sileo moves above bottom navigation. The same safe-area inset is used for both on iPhones. On very narrow phones, Sileo is scaled down to fit.
- Desktop notification styling, PAESSED logos, colors, carousel and card layout stay unchanged.

QA: verify tour at all four stops, mobile scrolling, notification dismissal and bottom-bar taps at widths from 320px to 430px.
