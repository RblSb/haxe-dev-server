# haxe-dev-server

Haxe dev http server. Recompiles code and reloads html page on Haxe code changes.

Uses haxe compilation server and `chokidar` file watcher with `ws` websocket server for live-reload.

## Installation
`npm i -g https://github.com/RblSb/haxe-dev-server`

## Example:
```
haxe-dev-server --hxml build.hxml --watch src --serve build --port 8080
```

## Multiple serve directories (as fallbacks)
```
haxe-dev-server -s build -s custom
```
Requests are checked in order:
- /index.html -> build/index.html, then custom/index.html
- /foo/bar.js -> build/foo/bar.js, then custom/foo/bar.js

## Options
```
--hxml, -h <file>     hxml file for compilation server (default: build.hxml)
--watch, -w <dir>     Source directory to watch (default: src)
--serve, -s <dir>     Output directory to serve (default: build)
--port, -p <port>     HTTP server port (default: 8080)
--ws-port <port>      WebSocket port for live reload (default: 8081)
--haxe-path <path>    Path to haxe executable (default: haxe)
--server-port <port>  Haxe compilation server port (default: 7000)
--verbose             Print more logs
--help                Show this help message
```
