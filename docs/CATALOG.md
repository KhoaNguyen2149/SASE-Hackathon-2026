# Catalog provenance

The curated pilot area is Golden, Colorado. Statewide discovery also includes 5,073 OpenStreetMap records from the September 19, 2026 snapshot in `src/data/colorado.json`. It was chosen as a small initial directory alongside the supplied campus-oriented product brief. This is not a claim of a university or venue partnership.

## Real entries

Official venue websites were checked September 19, 2026. Stored source notes explain verified facts and uncertainties. All illustrations are artwork, not photographs of these businesses.

| Venue | Official source | Included facts / limits |
| --- | --- | --- |
| Golden Library | https://jeffcolibrary.org/locations/gn/ | Address, posted weekly hours, quiet reading area, accessibility details, external room-booking information and listed holiday closures. No DeskHop-controlled rooms. |
| Windy Saddle Cafe | https://www.windysaddle.com/ | Address, opening hours, coffee service, kitchen closes an hour earlier. Laptop/stay rules and technical amenities unverified. |
| Humble House Cafe | https://humblehousecafe.com/contact | Address, daily 7 am–4 pm hours, kitchen closes 2 pm. Technical amenities and laptop rules unverified. |
| Higher Grounds Cafe | https://highergroundsgolden.com/ | Address, coffee, outdoor deck and study-friendly description. Hours withheld because https://highergroundscafegolden.com/ lists a different Sunday opening. |

Real coordinates have not been verified: `mapped=0` excludes them from pins and distance/radius matching. Directions use the street address. Unknown outlet coverage, Wi-Fi, general noise level, and group table capacity do not satisfy positive amenity filters. `noise=0` means unknown for a venue; contributed noise observations still use the five-point scale.

Golden Library’s listed December 31 early closure is represented conservatively as unavailable for automatic whole-visit matching. The source and closure reason document the discrepancy; an operator can update the model or exception after verification. Regular hours are reference information, not live status from a venue API.

## Fictional sample campus

Aspen Reading Room, Juniper & Co., The Study Hall, Clear Creek Corner, Paper & Pine, and North Light Studio are sample entries. Their names, facts, coordinates, hours, and rooms demonstrate the product. The sample catalog is a separate Discovery selection and all related reservations are marked demo. No fictional reviews or users are seeded.

## Updating facts

Use Administration to revise fields and source notes, verification date, holidays, and publication status. Maintain unknown values until there is supporting evidence. Only check coordinates verified after checking the actual venue location. Record venue permission before adding native real-world inventory; external booking links remain independent workflows.

Review schedules weekly and after a correction request. The application does not crawl or automatically re-verify sources. Website-sourced facts can become stale between checks.

## Statewide sources and photographs

The OSM snapshot is distributed under ODbL 1.0 with attribution and downloadable source data at `/api/catalog/download`. Community map coordinates are not inspected entrances. Unknown amenities, access, and opening hours are not inferred. A listed park or community space is not necessarily suitable for studying.

36 records have Wikimedia Commons photos. `scripts/enrich-photos.py` retrieves source-linked Wikidata/Commons image metadata, applies geographic and license filters, and preserves image/source/artist/license fields. Credits and the original file page appear beside each displayed photo; images may show older conditions. Missing images have explicit placeholders. No Google Places photos are copied or billed. Additional venue photos require source matching and reuse permission or an appropriately licensed provider integration.
