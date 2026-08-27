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

## Publish with GitHub Pages

1. Create a public GitHub repository named `SpriteQuest`.
2. Push this folder to the repository's `main` branch.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select **main**, **/ (root)**, then **Save**.

The game will be available at `https://ctrlcctrlvisthebest.github.io/SpriteQuest/` after deployment finishes.

## Credits

Original Processing project by the repository owner. The unused `mario-theme.mp3` file from the source project is intentionally excluded from this web release.
