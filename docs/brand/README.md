# DeskHop brand kit

Version 1.2 · September 19, 2026

**DeskHop — Find your next study spot.**

A welcoming study companion: warm cream, forest green, a small apricot accent, clear information, and ordinary words for important actions. The logo combines a simple desk with a short hop arc and landing dot. Use the hop idea for getting to a chosen place, then let the interface become quiet while the person studies.

## Included assets

| File | Use |
| --- | --- |
| [deskhop-mark.svg](deskhop-mark.svg) | Primary mark on cream or white, at 24 px and larger. |
| [deskhop-mark-mono.svg](deskhop-mark-mono.svg) | Single-color printing or an inline/masked mark that adopts the intended text color. |
| [deskhop-app-icon.svg](deskhop-app-icon.svg) | App tiles and compact placements on either light or dark surroundings. |
| [tokens.css](tokens.css) | Initial light-appearance tokens scoped under `.deskhop`. |

![DeskHop app icon](deskhop-app-icon.svg)

The SVG marks are editable geometry and contain no font dependency. They are design assets, not a trademark registration or a claim of name availability. Font files, stock photos, production favicon exports, and a dark-theme implementation are not bundled.

## Name, wordmark, and tagline

Always write **DeskHop** with a capital D and H. The paid plan is **DeskHop Plus**. The tagline is **Find your next study spot.** Use the descriptor **Study spots and study friends** only where someone needs a short explanation.

Render the wordmark as live **Manrope 700** text beside the mark, with a system sans-serif fallback. Do not stretch letters or export the fallback font as though it were the final Manrope artwork. Before production font distribution, retrieve the chosen font from its official source and retain its applicable license. [Manrope on Google Fonts](https://fonts.google.com/specimen/Manrope).

For a 32 px mark, a roughly 24 px wordmark and 8 px gap make a useful header starting point. Treat that as an optical starting point and inspect it at the actual font weight. Leave at least one landing-dot diameter of clear space around the mark. Use a decorative empty alt attribute when the adjacent text already says DeskHop; an icon-only home link needs the accessible name “DeskHop home.”

```html
<a href="/" aria-label="DeskHop home">
  <img src="/brand/deskhop-mark.svg" alt="" width="32" height="32">
  <span class="deskhop-wordmark">DeskHop</span>
</a>
```

Use CSS layout to align the lockup. For the monochrome SVG, a separately loaded `<img>` does not inherit its surrounding document's CSS color; inline it with the intended `color` or use the asset as a CSS mask. In a dark header, use the app icon or a properly recolored monochrome mark. The primary forest mark is intended for light backgrounds.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| Canvas | `#F7F4ED` | Warm page background. |
| Surface | `#FFFFFF` | Opaque cards, menus, and sheets. |
| Ink | `#24342D` | Primary text. |
| Muted | `#5F6B63` | Secondary text. |
| Forest | `#285547` | Primary controls, links, and logo strokes. |
| Sage | `#E5EDE5` | Quiet selected and supportive surfaces. |
| Apricot | `#E8B06C` | Small brand accent; use ink when text is placed on it. |
| Travel | `#FFF0D7` | Hopping over status background. |
| Travel text | `#704415` | Text on the travel background. |
| Border | `#D9DED5` | Decorative separators. |
| Control border | `#78877D` | Boundaries needed to identify a control. |
| Danger | `#AD3E36` | Error text on `#FCEAE7` or white. |

Calculated contrast for the specified pairs: ink/cream 11.92:1; muted/cream 5.07:1; white/forest 8.47:1; forest/sage 7.09:1; travel text/travel 7.40:1; ink/apricot 6.77:1; danger/pale danger 5.13:1. These checks cover those pairs, not the accessibility of an entire screen. Never use white body text on apricot or rely on color alone for a status.

## Type, layout, and behavior

Use Manrope 400 for body text, 500 for controls, 600 for headings, and 700 for the wordmark. Body text is 16 px with 24 px line height; secondary text is 14/20; captions are 12/18. Inputs remain at least 16 px. Use the spacing steps 4, 8, 12, 16, 24, 32, and 48 px. Inputs have 10 px corners, cards 16 px, and sheets 20 px.

Make primary buttons 48 px tall and aim for at least 44 by 44 px effective touch targets. Keep navigation labels **Discover, Study, Friends, Profile**. Use opaque surfaces, modest corner radii, visible focus, restrained shadows for overlays, and one primary action per decision. Keep transitions around 120–180 ms; positional animation is optional and must disappear with reduced motion. No continuous bouncing, glowing panels, or glass effects.

## Branded language

| Text | Contract |
| --- | --- |
| Hop over | Opens a review; sends nothing by itself. |
| Tell Maya I’m on my way | Explicitly saves a hop and queues one notice for the named eligible friend. |
| Hopping over | Self-reported travel intent shared only with that selected friend. |
| I’m here | Self-reported arrival; Start studying remains a separate action. |
| Cancel hop | Ends the travel intent. |
| Start studying / Reserve a room | Keep these literal and distinct. |

Use complete product, authorization, expiry, delivery, and engineering rules from Sections 32–38 of the DeskHop Product and Engineering Blueprint. A brand phrase must never imply a confirmed reservation, guaranteed seat, exact live location, or permission to visit a private session.
