# OpenTogetherTube

The easy way to watch videos with your friends.

http://opentogethertube.com/

# Contributing

Contributions are welcome. The current iteration is named "Flare", and you can
see what's currently being worked on under the "projects" tab.

## Setting up your dev environment

### Prerequisites

This project targets the lastest LTS version of node.js.

### Setup

1. Fork this repo and clone it.
2. In a terminal, navigate to the `opentogethertube` folder and run
```
npm install
```

### Testing

Currently, we do not have any automated tests. This is on the todo list.

## How to run

This project has 2 main components: the client and the server. You can run
both of them simultaneously using the command
```
npm run dev
```

Sometimes, you may want to run them seperately so you can use breakpoints to
debug. Using VSCode, this is trivial.

To start the server: `Debug > Select "Launch Program" > Start`

To start the client: `npm run serve`


# Deployment

1. Clone this repo.
2. Install despendencies.
```
npm install
```
3. Build Vue files so they can be served statically.
```
npm run build
```
4. Run the server.
```
npm start
```

You can also specify the port the server will listen on by setting the
`PORT` environment variable.

```
PORT=8080 npm start
```
