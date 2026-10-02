# Art and audio prompts

Every art slot is listed in `assets/manifest.json` with its exact size and frame count. Generate art at an exact multiple of the target size (8x or 16x works well), on a solid magenta `#FF00FF` background, then run `npm run art:process -- <inbox>` and clean up in Aseprite or Pixelorama (see CONTENT_GUIDE.md).

## Style preamble (put this before every image prompt)

> 16-bit SNES-era pixel art, 3/4 top-down view, bright and cozy, cheerful farm game. Crisp single-pixel dark plum outlines (#2B1B3D). Limited palette, flat shading with one highlight and one shadow tone, no gradients, no anti-aliasing, no blur, no text. Centered single object on a solid flat magenta background (#FF00FF), nothing else in frame.

Global palette: plum `#2B1B3D`, purple `#7B4FB5`, light purple `#B48AE0`, dark purple `#4A2B7A`.
Spring: mint `#9FE3C0`, blush `#FFB7D5`, butter `#FFF1A8`, sky `#9AD7FF`.
Summer: turquoise `#37D4D0`, sun `#FFD93B`, coral `#FF7F6B`, sand `#F5DFA6`.
Fall: pumpkin `#FF8A1F`, candy yellow `#FFD43B`, cream `#FFF6DD`, plum `#6E3A8C`.
Winter: ice `#BFE8FF`, peppermint red `#E5384F`, white `#FFFFFF`, evergreen `#2E8B57`.

## Tiles (32x32, seamless)

- `tile_grass`: "seamless tileable grass tile, short bright green grass with a few darker tufts"
- `tile_meadow`: "seamless tileable meadow grass with tiny white and yellow flowers"
- `tile_soil` / `tile_soil_wet`: "seamless tilled garden soil with neat furrows, warm brown" (wet: darker, slightly shiny)
- `tile_bramble` / `tile_bramble_dense`: "seamless overgrown Himalayan blackberry bramble, thorny dark green canes with purple-black berries" (dense: thicker, almost no ground visible)
- `tile_path`, `tile_gravel`, `tile_water`, `tile_woods_floor`, `tile_creek_bank`, `tile_sand`, `tile_snow_patch`, `tile_fence_h`, `tile_fence_v`: same pattern, describe the surface.

## Crops (4-frame strip, each frame 32x32)

"growth stages of a <crop> plant in 4 frames left to right: tiny sprout, young plant, budding plant, fully grown and ready to harvest with visible <crop>. Each frame the same size, plant base at the bottom center."

## Items (32x32 icons)

"single <item> inventory icon, chunky and readable at small size". Wines: "a wine bottle with a purple-themed label, <wine> color liquid". Kitchen goods: describe the dish (a slice of apple pie, a jar of plum jam with a gingham lid, and so on).

## Buildings (w*32 by h*32+16, three stages)

For each building, three images with the same footprint and the same camera angle:
- `bld_<id>_ruined`: "abandoned, weathered gray wood, holes in the roof, blackberry brambles growing up the walls, cozy not spooky"
- `bld_<id>_repair`: "under repair, wooden scaffolding, fresh planks mixed with old ones"
- `bld_<id>_restored`: "freshly restored, bright paint, flower boxes, welcoming"

Buildings: farmhouse (cream farmhouse with a porch), summer kitchen (small cottage with a chimney), chicken coop, big red barn, market stall (striped purple and white canopy), honor box stand (tiny roadside stand with a coin box), old winery (stone and timber, purple trim, barrels by the door), greenhouse (glass and white frame), bee garden (three white hives), county fair tent (red and white striped tent with flags).

## Animals

- `anim_highland_cow` (2 frames, 48x40): "a Scottish Highland cow, long shaggy ginger coat, long curved horns, long bangs covering the eyes, standing, side view facing right; frame 2 the same with the head lowered slightly". Keep the head in the upper right so hats line up with `headAnchor` [38, 9]; horn span about 22 px.
- `anim_hen`, `anim_rooster` (24x24), `anim_chick` (16x16): plump, friendly, side view facing right.
- `luna_sleep` (32x24, 2 frames), `luna_sit` (24x32, 2 frames), `luna_walk` (32x24, 4 frames): "an old black cat with a few gray whiskers and green eyes; sleeping curled up / sitting / walking, a little round in the middle".

## People (32x48, 2-frame idle) and portraits (64x64)

- Luke: "an 11 year old boy, tan skin, brown curly hair, royal blue baseball cap, spunky grin, t-shirt and jeans"
- Claire: "a warm, slightly bossy cafe owner in her 50s, blonde bob, pink blouse, white apron"
- Andrew: "a friendly gruff general store owner, gray beard, red flannel, suspenders"
- Tourist: "a cheerful city tourist with a sun hat, camera around the neck, turquoise shirt"
- Rachel portrait: matches the avatar defaults (long brown hair, purple overalls, straw sun hat)
- Avatar layers (`avatar_*`): draw in **grayscale only** (they are tinted in game): body, 6 hairstyles, 4 outfits, plus hats and accessories in full color.

## Cosmetics

- Cow hats (24x16): sit between the horns; bottom center is the anchor. Chicken hats (12x10). Neckwear (16x8).
- Wine labels (48x64): "a vintage wine label design, <style>, purple accents, room for a name in the middle (leave it blank)".
- Building paint, roof, and trim swatches (32x32): a small sample tile.

## Season sets (launch pieces)

- **Fall (12):** candy corn bunting, giant candy corn statue, candy corn bowl, pumpkin patch, friendly scarecrow, hay bales, smiling jack-o-lantern, candy corn cow hat, pumpkin cap, tiny witch hat (chickens), witch hat (avatar), pumpkin barn door skin.
- **Winter (12):** candy cane fence, Christmas tree (decoratable with earned ornaments), door wreath, string lights, snowman, peppermint lamp post, peppermint cow hat, peppermint scarf, Santa cow hat, pom pom chicken hat, Santa avatar hat, snowy eaves skin.
- **Spring (9):** pastel egg basket, candy egg tree, bunny topiary, blossom arch, tulip bed, bunny ears (cows), eggshell cap (chickens), bunny ears headband (avatar), pastel trim skin.
- **Summer (12):** beach umbrella, sandy patch, tiki torch, kiddie pool, surfboard rack, sandcastle, cow sunglasses, wide straw sunhat for cows, hibiscus (chickens), flower lei, beach visor (avatar), beach shack trim skin.

## Decor and props

Use the decor name and footprint: "<name>, garden decoration, <w>x<h> tiles". Props: well, apple tree, fir tree, bush, rock, mailbox, Claire's pink cafe delivery van, wooden sign, stump, haystack, lamp post.

## Mini games

- `mg_bg_barn`, `mg_bg_coop`, `mg_bg_field` (360x640): "portrait game background, inside a cozy barn / outside the coop on a sunny day / a garden bed seen from above", leave the middle clear.
- Notes, pails, basket, eggs (white and golden), boot, feather, weeds (small and big), sprout.

## UI icons (32x32)

coin, blue ribbon, heirloom seed, star and empty star, heart, XP, clock, lock, check, tab icons (farm, craft, shops, style, menu), basket, almanac, journal, chalkboard.

## Audio prompts

- **Seasonal loops** (`public/audio/music/<season>.ogg`, 60 to 90 seconds, seamless): "gentle cozy farm game music, music box and soft acoustic guitar, <season mood>, light and happy, no vocals, seamless loop". Moods: spring (Easter morning, birdsong feel), summer (beach day, ukulele), fall (candy corn and hayrides, warm), winter (snowy, sleigh bells, peppermint).
- **Menu and mini game theme** (`menu.ogg`): "bouncy, playful, music box and xylophone, 100 bpm".
- **SFX** are generated in code with ZzFX (harvest pop, coin, level up, UI tap, cow moo, hen cluck, cat meow and purr, wine cork pop, market bell, journal chime, rain, fireworks). Replacements can be added later the same way as music if wanted.
