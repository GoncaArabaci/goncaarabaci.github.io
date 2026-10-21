# Gonca Arabacı: Portfolio

My personal website: **https://goncaarabaci.github.io/**

I'm a computer engineer and software developer. This site collects my work experience, education, projects and a browser game I built.

## What's inside

| Page | Description |
| --- | --- |
| `index.html` | Home page: experience, education, featured projects, leadership, skills and contact |
| `projects.html` | All projects, with search, category filter and sorting |
| `games/hexland/` | **Hexland**, an online multiplayer strategy board game that runs in the browser |

The site is plain HTML, CSS and JavaScript. There is no build step and no backend, so it runs directly on GitHub Pages.

## Hexland

A pixel-art strategy board game on a hexagonal island for 2–4 players. Players gather resources, build roads, settlements and cities, trade with the bank and race to 10 victory points.

- **Online rooms:** one player creates a room and shares the link, and everyone plays from their own device.
- **Host-authoritative:** the host's browser runs the game rules and checks every move before applying it.
- **Hidden hands:** each player only receives their own cards. Other players' hands are sent as card counts.
- **Peer-to-peer:** moves travel directly between browsers over WebRTC ([PeerJS](https://peerjs.com/)). The public PeerJS server is only used to connect the players.

## Adding a project

Projects are listed in [`projects-data.js`](projects-data.js). Add a new object to the `PROJECTS` array and both pages update automatically. Set `featured: true` to show it on the home page, or `noRepo: true` if it has no public repository.

## Running locally

The pages can be opened directly, but a local server is closer to how GitHub Pages serves them:

```
python -m http.server 8000
```

Then open http://localhost:8000/.

## Credits

- [PeerJS](https://peerjs.com/) 1.5.4, MIT License (see `games/hexland/vendor/PEERJS-LICENSE.txt`)
- Fonts: [Inter](https://rsms.me/inter/) and [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P), SIL Open Font License 1.1, self-hosted in `assets/fonts/` (see the `OFL-*.txt` files there)

## License

© 2026 Gonca Arabacı. All rights reserved.

The code is public so it can be read, but the content (text, photos, CV and artwork) may not be reused without permission. Third-party libraries keep their own licenses listed above.
