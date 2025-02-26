# Explanation Engine

This is a Flask backend for supporting customized explanations for the V-Shine Study Platform. It is intended for demonstrative purposes.

For communication, the explanation engine supports either a REST or websocket connection, which can be specified at the beginning of `app.py`.

Use `.example_payload.json` for testing the REST endpoints.

## Description

This example allows to taylor explanations to two experimental conditions: Static and context-adapted explanations.
Moreover, context-adapted explanations are dependent on multiple variables:

* the number of times a rule has been triggered
* the technical interest of the user as self-reported in a pre-study questionnaire
* the specific task
* the user name

## Application Structure

```
project/
├── app.py                    # Main application entry point
├── rest_routes.py            # REST API endpoints
├── socket_events.py          # WebSocket event handlers
├── explanation.py            # Explanation generator
├── .example_payload.json     # Examplary payload that can be used in POSTMAN
└── resources/                # JSON resources for explanations
    ├── explanation_table.json
    └── explanations.json
```

## Installation

1. Install the project dependencies from `requirements.txt`. We recommend using a virtual environment, such as `venv`.
2. Run the application using

```
python app.py
```