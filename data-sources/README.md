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
