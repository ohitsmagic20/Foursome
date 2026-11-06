# Golf resort data

`resorts/*.txt` is the source list of US golf resorts, one file per state:
`Resort | Town | course; course; …`

Collected November 2026 from GolfPass's state-by-state golf resort directories,
Golf Digest's best golf resorts list, and the golftrips.com package directory.

To rebuild `src/data/resorts.json` (adds each town's coordinates):

    npm install all-the-cities@3.1.0   # in a scratch folder
    node build.js data-sources/resorts src/data/resorts.json

`alias.json` maps small towns the city dataset doesn't include to the nearest
larger town.

## Packages

`packages/*.txt` lists stay-and-play packages, one file per state, collected
November 2026 from the GolfTrips network's state sites (arizonagolfer.com,
golfmichigan.com, scgolf.com, floridagolfer.com and the rest) and GolfPass:
`Resort | Package | Town | ST | course; course; … | nights and rounds | price | basis | URL`

To rebuild `src/data/listings.json`:

    node build-packages.js data-sources/packages src/data/listings.json

## Rates

`rates.txt` holds rates and details looked up on each resort's own site, keyed
by package id: starting price and basis, nights and rounds, what's included,
season and discounts. They override what a listing says. Rebuild with
`node data-sources/build-rates.js`.

## What golfers paid

`typical.txt` records what golfers actually paid at resorts that quote packages
per group: state golf association member trips (CDGA, FSGA, SCGA, Texas GA),
packagers (Golfzoo, Golf Trip Junkie, TripCaddie) and club trips, each with
nights, rounds, year and what it covered. Cards show it as "What golfers paid",
separate from posted prices. `build-rates.js` turns it into `src/data/reported.json`.
