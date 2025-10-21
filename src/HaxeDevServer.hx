import chokidar.FSWatcher;
import haxe.Json;
import haxe.io.Path;
import js.Node.__dirname;
import js.Node.process;
import js.node.Buffer;
import js.node.ChildProcess;
import js.node.Fs.Fs;
import js.node.Http;
import js.node.Path as JsPath;
import js.node.http.IncomingMessage;
import js.node.http.ServerResponse;
import js.node.url.URL;
import js.npm.ws.Server as WSServer;
import js.npm.ws.WebSocket;
import sys.FileSystem;
import sys.io.File;

using Lambda;
using StringTools;

@:structInit
@:publicFields
class ServerConfig {
	/** hxml file for compilation server. **/
	var hxmlPath = "build.hxml";
	/** source directory to watch. **/
	var watchDirs = ["src"];
	/** output directories to serve (in priority order). **/
	var serveDirs = ["build"];
	/** server port. **/
	var port = 8080;
	/** websocket port for live reload. **/
	var wsPort = 8081;
	/** path to haxe executable. **/
	var haxePath = "haxe";
	/** haxe compilation server port. **/
	var serverPort = 7000;
	/** Print more logs. **/
	var verbose = false;
}

class HaxeDevServer {
	static final mimeTypes = [
		"html" => "text/html",
		"js" => "text/javascript",
		"css" => "text/css",
		"json" => "application/json",
		"png" => "image/png",
		"jpg" => "image/jpeg",
		"jpeg" => "image/jpeg",
		"gif" => "image/gif",
		"webp" => "image/webp",
		"avif" => "image/avif",
		"svg" => "image/svg+xml",
		"ico" => "image/x-icon",
		"wav" => "audio/wav",
		"mp3" => "audio/mpeg",
		"ogg" => "audio/ogg",
		"mp4" => "video/mp4",
		"webm" => "video/webm",
		"woff" => "application/font-woff",
		"ttf" => "application/font-ttf",
		"eot" => "application/vnd.ms-fontobject",
		"otf" => "application/font-otf",
		"wasm" => "application/wasm"
	];

	final config:ServerConfig;
	final liveReloadScript:String;
	var watcher:FSWatcher;
	var compilationServer:js.node.child_process.ChildProcess;
	var wsServer:WSServer;
	final wsClients:Array<WebSocket> = [];
	var isCompiling = false;
	var needsRecompile = false;

	static function main() {
		final args = Sys.args();
		final config = Cli.getConfig() ?? return;

		final server = new HaxeDevServer(config);

		// Handle graceful shutdown
		process.on("SIGINT", () -> {
			Sys.println("\nShutting down...");
			server.close();
			process.exit(0);
		});
	}

	public function new(config:ServerConfig) {
		this.config = config;

		// access from build dir to res
		final script = File.getContent('$__dirname/../res/live-reload.js');
		liveReloadScript = script.replace("{{wsPort}}", '${config.wsPort}');

		if (!FileSystem.exists(config.hxmlPath)) {
			log('${config.hxmlPath} not found.');
			log('Set hxml path with `--hxml myfile.hxml`');
			process.exit(1);
		}

		startHttpServer();
		startWebSocketServer();
		startCompilationServer();
		startFileWatcher();

		log('Haxe Dev Server running at http://localhost:${config.port}');
		log('Watching ${config.watchDirs} for changes...');
		log("Serving directories (in priority order):");
		for (i => dir in config.serveDirs) {
			log('  ${i + 1}. $dir');
		}
	}

	function startHttpServer():Void {
		final server = Http.createServer((req, res) -> {
			serveFile(req, res);
		});

		server.listen(config.port);

		server.on("error", (err:Dynamic) -> {
			if (err.code == "EADDRINUSE") {
				error('Port ${config.port} is already in use');
				process.exit(1);
			}
		});
	}

	function startWebSocketServer():Void {
		wsServer = new WSServer({port: config.wsPort});

		wsServer.on("connection", (client:Dynamic) -> {
			if (!wsClients.contains(client)) {
				wsClients.push(client);
			}

			client.on("close", () -> {
				wsClients.remove(client);
			});
		});
	}

	function startCompilationServer():Void {
		final args = ["--wait", Std.string(config.serverPort)];

		compilationServer = ChildProcess.spawn(config.haxePath, args);

		compilationServer.stdout.on("data", (data:Buffer) -> {
			log('[Haxe Server] ${data.toString().trim()}');
		});

		compilationServer.stderr.on("data", (data:Buffer) -> {
			error('[Haxe Server] ${data.toString().trim()}');
		});

		compilationServer.on("close", (code:Int) -> {
			log("Haxe compilation server stopped");
		});

		// Initial compilation
		js.Node.global.setTimeout(() -> triggerCompilation(), 100);
	}

	function startFileWatcher():Void {
		final patterns = config.watchDirs.copy().concat([
			config.hxmlPath
		]);

		watcher = Chokidar.watch(patterns, {
			ignored: (path, stats) -> {
				if (!stats?.isFile()) return false;
				if (path.startsWith(".")) return true;
				return false;
			},
			persistent: true,
			ignoreInitial: true
		});

		watcher.on("all", (event:String, path:String) -> {
			final fileName = Path.withoutDirectory(path);
			debugLog('File changed: $fileName');
			scheduleCompilation();
		});
	}

	function scheduleCompilation():Void {
		if (isCompiling) {
			needsRecompile = true;
		} else {
			triggerCompilation();
		}
	}

	function triggerCompilation():Void {
		isCompiling = true;
		needsRecompile = false;

		log("Compiling Haxe...");

		final args = ["--connect", Std.string(config.serverPort), config.hxmlPath];
		final haxeProcess = ChildProcess.spawn(config.haxePath, args);

		var output = "";

		haxeProcess.stdout.on("data", (data:Buffer) -> {
			final str = data.toString();
			output += str;
			Sys.print(str);
		});

		haxeProcess.stderr.on("data", (data:Buffer) -> {
			final str = data.toString();
			output += str;
			Sys.stderr().writeString(str);
		});

		haxeProcess.on("close", (code:Int) -> {
			isCompiling = false;

			if (code == 0) {
				success('✓ Compilation successful');
				notifyClients();
			} else {
				error('✗ Compilation failed');
			}

			if (needsRecompile) {
				js.Node.global.setTimeout(() -> triggerCompilation(), 100);
			}
		});
	}

	function notifyClients():Void {
		if (wsClients.length == 0) return;

		js.Node.global.setTimeout(() -> {
			final message = Json.stringify({type: "reload"});
			for (client in wsClients) {
				client.send(message, null);
			}
		}, 200);
	}

	function serveFile(req:IncomingMessage, res:ServerResponse):Void {
		final url = try {
			new URL(safeDecodeURI(req.url), "http://localhost");
		} catch (e) {
			new URL("/", "http://localhost");
		}

		final filePath = findFile(url) ?? {
			log('File not found: ${url.pathname}');
			handleNotFound(res, url.pathname);
			return;
		}

		final ext = Path.extension(filePath).toLowerCase();

		res.setHeader("content-type", getMimeType(ext));
		res.setHeader("cache-control", "no-cache");

		Fs.readFile(filePath, (err:js.lib.Error, data:Buffer) -> {
			if (err != null) {
				handleFileError(err, res, filePath);
				return;
			}

			// Inject live reload script into HTML files
			if (ext == "html") {
				var html = data.toString();
				html = injectLiveReload(html);
				res.end(html);
			} else {
				res.end(data);
			}
		});
	}

	function findFile(url:URL):Null<String> {
		var pathname = url.pathname;
		if (pathname == "/") pathname = "/index.html";

		// Remove leading slash
		final cleanPath = pathname.startsWith("/") ? pathname.substr(1) : pathname;

		// Try each serve directory in order
		for (serveDir in config.serveDirs) {
			final filePath = JsPath.join(serveDir, cleanPath);

			// Security: prevent directory traversal
			final resolved = JsPath.resolve(filePath);
			final baseDir = JsPath.resolve(serveDir);

			if (!resolved.startsWith(baseDir)) continue;

			// Check if file exists synchronously
			try {
				final stats = Fs.statSync(filePath);
				if (stats.isFile()) {
					return filePath;
				}
			} catch (e) {
				// File doesn't exist, try next directory
				continue;
			}
		}

		return null;
	}

	function injectLiveReload(html:String):String {
		final script = '\n<script>\n$liveReloadScript</script>\n';
		// Try to inject before </body>, otherwise before </html>
		if (html.contains("</body>")) {
			return replaceLast(html, "</body>", script + "</body>");
		} else if (html.contains("</html>")) {
			return replaceLast(html, "</html>", script + "</html>");
		} else {
			return html + script;
		}
	}

	function replaceLast(str:String, search:String, replace:String):String {
		final lastIndex = str.lastIndexOf(search);
		if (lastIndex == -1) return str;
		final before = str.substring(0, lastIndex);
		final after = str.substring(lastIndex + search.length, str.length);
		return before + replace + after;
	}

	function handleNotFound(res:ServerResponse, pathname:String):Void {
		res.setHeader("content-type", "text/html");
		res.statusCode = 404;
		res.end('<h1>404 Not Found</h1><p>File not found: $pathname</p><p>Searched in: ${config.serveDirs.join(", ")}</p>');
	}

	function handleFileError(err:Dynamic, res:ServerResponse, filePath:String):Void {
		res.setHeader("content-type", "text/html");

		if (err.code == "ENOENT") {
			res.statusCode = 404;
			res.end('<h1>404 Not Found</h1><p>File not found: $filePath</p>');
		} else {
			res.statusCode = 500;
			res.end('<h1>500 Internal Server Error</h1><p>$err</p>');
		}
	}

	function getMimeType(ext:String):String {
		return mimeTypes[ext] ?? "application/octet-stream";
	}

	function safeDecodeURI(data:String):String {
		try {
			return js.Syntax.code("decodeURI({0})", data);
		} catch (e) {
			return "";
		}
	}

	public function close():Void {
		if (watcher != null) watcher.close();
		if (compilationServer != null) compilationServer.kill();
		if (wsServer != null) wsServer.close();
		log("Server closed");
	}

	inline function log(msg:String):Void {
		Sys.println('[\x1b[36mHaxeDevServer\x1b[0m] $msg');
	}

	inline function debugLog(msg:String):Void {
		if (!config.verbose) return;
		Sys.println('[\x1b[36mHaxeDevServer\x1b[0m] $msg');
	}

	inline function success(msg:String):Void {
		Sys.println('[\x1b[32mHaxeDevServer\x1b[0m] $msg');
	}

	inline function error(msg:String):Void {
		Sys.stderr().writeString('[\x1b[31mHaxeDevServer\x1b[0m] $msg\n');
	}
}
