# V-SHINE Study Platform

## Requirements

- NodeJS 20
- Python 3

## Install with Docker (Production)

For the first time, run the following command:

```bash
docker-compose up -d
```

For subsequent runs, run the following command:

```bash
docker-compose start
```

To stop the server, run the following command:

```bash
docker-compose stop
```

If you plan to reforce buiding the Docker image, run the following command:

```bash
docker-compose up -d --build
```

## Configuration File

The configuration file of the game is located in `src/game.json`.
