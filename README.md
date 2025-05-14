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
