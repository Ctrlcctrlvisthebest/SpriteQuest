# SpriteQuest

SpriteQuest is a four-level browser platform game, ported from Processing (Java mode) to p5.js.

## Play locally

Browsers do not load game assets correctly from a `file://` URL. Start a small local server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

- Left / Right arrows: move
- Up arrow: jump
- X: shoot water
- Z: sprint
- 1 / 2 / 3: select difficulty on a menu screen
- Space: start or restart
- R: return to the main menu

Enemy magma projectiles travel at speed 5 on Easy, 7 on Normal, and 9 on Hard.

## Progression

- Defeated wizards drop bones that grant coins and experience.
- Bone coin rewards are 2 on Easy, 3 on Normal, and 5 on Hard.
- Bone experience rewards are 5 on Easy, 7 on Normal, and 10 on Hard.
- Each level increases movement speed by 0.5 and reduces shot and sprint cooldowns by 8%.
- Movement speed is capped at 14, and cooldowns cannot fall below 50% of their base values.
- The first level requires 20 XP; each later level requires 10 more XP than the previous one.

## Endless mode

After completing level 4, press **E** on the victory screen to enter Endless mode. Endless mode keeps the level 4 map, removes its exit gem, and adds two wizards beyond the selected difficulty's normal count (3 on Easy, 4 on Normal, and 5 on Hard). Each defeated wizard respawns after three seconds. Your score, player level, and experience carry over from the completed run.

## Publish with GitHub Pages

1. Create a public GitHub repository named `SpriteQuest`.
2. Push this folder to the repository's `main` branch.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select **main**, **/ (root)**, then **Save**.

The game will be available at `https://ctrlcctrlvisthebest.github.io/SpriteQuest/` after deployment finishes.

## Credits

Original Processing project by the repository owner. The unused `mario-theme.mp3` file from the source project is intentionally excluded from this web release.
