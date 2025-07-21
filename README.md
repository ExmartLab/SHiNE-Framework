# V-SHINE Study Platform

## Requirements

- NodeJS 20 (Virual Study Platform)
- MongoDB (Database)
- Python 3 (Explanation Engine; optional)

## Local Development

For local development, you need to have NodeJS installed locally and MongoDB instance running.

First, enter the code base of the virtual study platform via the following command:

```bash
cd platform
```

For the MongoDB instance, the default values are:
- MongoDB URI: mongodb://localhost:27017/smart-home-study
- MONGODB_DB: smart-home-study

To override the default values, create a `.env` file in the root directory of the project and add the following lines:

```bash
MONGODB_URI=mongodb://localhost:27017/smart-home-study
MONGODB_DB=smart-home-study
```

To install the dependencies, run the following command:

```bash
npm install
```

To start the development server, run the following command:

```bash
npm run dev
```

## Install with Docker (Production)

### Option 1: Docker Compose (Recommended)

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

### Option 2: Using Pre-built Image from GitHub Container Registry

You can use the pre-built images from GitHub Container Registry (GHCR) instead of building locally.
However, the game.json and explanation.json cannot be modified using the pre-built image.

First, create a Docker network and start MongoDB:

```bash
docker network create app-network
docker run -d --name mongodb --network app-network -p 27017:27017 mongo:6.0
```

Then run the application:

```bash
docker run -p 3000:3000 --network app-network -e MONGODB_URI=mongodb://mongodb:27017/smart-home-study ghcr.io/exmartlab/shine-framework
```

To stop the services:

```bash
docker stop shine-framework mongodb
docker rm shine-framework mongodb
docker network rm app-network
```

## Docs

Since the docs are based on Docusaurus, you also need to have NodeJS installed locally.

First, enter the code base of the docs via the following command:

```bash
cd docs
```

To install the dependencies, run the following command:

```bash
npm install
```

To start the development server, run the following command:

```bash
npm run start
```

## Configuration File

The configuration file of the game is located in `src/game.json`.
