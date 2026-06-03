# HANDY RAVE ⚡

Interactive 3D rave with dancing handyc characters.

![Three.js](https://img.shields.io/badge/Three.js-0.137-blue)
![Docker](https://img.shields.io/badge/Docker-ready-green)

## Run locally

```bash
# With Docker
docker build -t handy-rave .
docker run -p 8080:80 handy-rave
# Open http://localhost:8080

# Without Docker (any static server)
python3 -m http.server 8080
# Open http://localhost:8080
```

## Controls

- **Slider**: Adjust number of handycs (1-20)
- **Volume**: Audio volume
- **Click to start**: Audio requires user interaction

## Tech

- Three.js 0.137 + DRACOLoader
- GLB model with 6 Mixamo animations
- Procedural audio playlist
- Nginx static serving via Docker
