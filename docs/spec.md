# Tycoon Game

This is the design and spec document for a railway tycoon game.

The design inspiration is the A-train series of Japanese railway and urban development simulation games.

The task is to build a fully working v1 of the game.

## Tech stack

- Main rendering engine: up to you, but one of the features we want is to be able to do palette swaps of the graphics, so something that supports that efficiently and runs on modern web browsers.
- Multiplayer using Cloudflare
- UI using React or React-like framework

## Tiles and rendering

- Map is isometric
- Flat for now (we'll implement height levels later; account for this in the architecture)

We have produced a `source_tileset_manifest` that outlines what each tile graphic in the `source_tileset` directory is for.
This manifest is imperfect, may have oversights, may be inconsistent, etc. In particular, tile directions and orientations might be wrong.
Test graphics out in the game to see if they look correct.

In general here is how the tile directions from the manifest work:

```
                 N
                 ◆
               ╱   ╲
        NW   ╱       ╲   NE
           ╱           ╲
         ╱               ╲
       ╱                   ╲
 W   ◆                       ◆   E
       ╲                   ╱
         ╲               ╱
           ╲           ╱
        SW   ╲       ╱   SE
               ╲   ╱
                 ◆
                 S
```

Railcars and other vehicles have not been labelled. Ideally, you will be able to look at these graphics and determine the correct orientation etc labels for them yourself; you may need to upscale them in a temp folder first to see them properly.

Account for the fact that in the future we're going to index into the colours of the tiles and swap them out when rendering for night, different seasons, etc. All the tiles should already draw from the same 16 colour palette; the palette should be swappable later.

Some objects in the source_tileset folder are split over multiple tiles or otherwise require composition. You will need to be careful with rendering order for these.

Buildings labelled 'stackable' are just that - the sprites can be stacked to produce taller buildings. Some of them can, in addition, be used to produce 'wider' buildings with more than 1x1 base footprint. In general you will probably need to figure out which building graphics can do this by looking at the dimensions of the sprites (do they take up the full width etc) because I have not labelled them as such.

Buildings in the tileset have a 'light direction' baked into them, so they mostly can't be arbitrarily flipped left-to-right. The light direction for tiles in the tilesheet has the sun coming from the 'South West' direction (i.e. the left front side of buildings is most brightly illuminated.)

You'll need to design procedural rendering routines for some multi-tile assemblages such as airports and ports which do not have a defined structure from the tiles. E.g. how long should runways be etc.

Use the 'empty tile with outline' graphic as the main base level tile.

Figure out how to get elevated railways, roads, monorails, bridges, etc working.

Roads and railways should overlap with level crossings.

## Urban development and maps

- Land starts out with farms, small towns, and some vegetation etc. You will need to develop algorithms for seeding and generating the world when it's created.
- Use some kind of procedural generation routine to generate realistic looking land shapes with land and water. Some tiles/graphics can only be placed in water.
    - Generate combination half-water-half-land tiles procedurally to allow for smoother looking coastline shapes.
- User doesn't control town growth themselves; towns grow over time as they're served by transport
- Building heights grow over time and redevelopment sort of 'pushes outwards'; you'll need to design algorithms for this. Basically a small town will start, then there'll be midrise buildings with suburbs around it, then highrises in the CBD with midrise around it and suburbs past that, etc.
- The road tiles are wide relative to a lot of the graphics (a full tile) and are intended more as a 'main road'/highway type representation. Buildings don't all have to be on a road; minor roads can be implicit. This kind of road heirarchy is common in Japanese urban planning.
- Maps should be large. There should be a minimap to help players orient themselves.

## Gameplay

The user should have access to tools to construct railway lines and determine station areas. The game should be capable of laying out the actual station and rail tile graphics without the player having to do it manually ('autotiling').

There should be two main things for passengers to move around the map and get paid for - 'passengers' and 'cargo'.

Passenger counts at stations should be determined dynamically by the surrounding development. When there are just farms and farm houses, passenger numbers will be low. Stations too close together should also 'cannibalise' each other. However, multimodal transfers should be possible and accounted for by the network calculations.

Cargo counts should be determined dynamically by the number of industrial buildings nearby. The player should be able to build stations within a radius of industrial buildings and purchase land (purchased land can be visually represented by the 'empty land with dithering' sprites somehow) which will be used to build up cargo (visually represented by the container tile graphics). These land purchases will get much more expensive as the level of development around stations increases.

There should be an in game clock. Some number of seconds per tick, some number of ticks per in-game hour, 24 hours a day, 365/366 days a year. The player should be able to control the simulation speed.

Rolling stock should have costs. Station maintenance should have costs. There should be an economic simulation layer.

You will need to do some balancing around the costs and payment rates for the rolling stock, passengers, cargo, land, etc.

Ideally, vehicle sprites should interpolate smoothly between tiles rather than just jumping from tile to tile. There will need to be a rail simulation layer to 'drive' the trains and prevent them from crashing into each other or phasing into each other. Trains will be given orders to go between stations - there will need to be pathfinding algorithms to ensure that the other station is reachable.

True to the history of the Japanese railway companies, they funded much of their operations by also being real estate developers. Implement this 'transit oriented development' model by giving players the option to build residential and commercial developments near their stations.

Give the player a UI accessible by clicking on buildings that includes some random name for the business or apartment building or house or whatever. Include some info about numbers of people there or commercial demand or whatever. SimCity 4 like.

There should be UI the player can use to track the financials of their company. Loans they can take out with interest, etc. They should start the game with a loan.

## Multiplayer

Implement a basic multiplayer system using Cloudflare primitives and any sync libraries you think might be required. Users should be able to send their friends a link to be able to collaborate or compete. Rigid anti-cheat protections aren't warranted at this stage, just something that players can play with their friends.

## Testing

Write tests. Find ways of instrumenting the game to test and balance systems.

## Other

Make sure to use seeded procedural randomness everywhere so that a master 'game seed' can be used.

Use a clean modern component library for the UI. Take colour inspiration from the tile palette to make the UI cohesive with the game sprites.

Create a main menu with saves, previously-connected multiplayer worlds, credits screen, etc.

If there is a gameplay or design decision not specified in this document that you think needs implementing, just go for it. Make sane decisions based on your knowledge of the genre and any online research you want to do. Lean towards realism. Include things that other similar games might not have.

Make git commits as you work.