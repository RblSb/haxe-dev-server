import HaxeDevServer.ServerConfig;
import js.Node.process;

using Lambda;
using StringTools;

typedef CliOption = {
	names:Array<String>,
	hasValue:Bool,
	?defaultValue:String,
	description:String,
	?example:String
}

class Cli {
	static final cliOptions:Array<CliOption> = [
		{
			names: ["--hxml", "-h"],
			hasValue: true,
			defaultValue: "build.hxml",
			description: "Haxe build file"
		},
		{
			names: ["--watch", "-w"],
			hasValue: true,
			defaultValue: "src",
			description: "Source directory to watch"
		},
		{
			names: ["--serve", "-s"],
			hasValue: true,
			defaultValue: "build",
			description: "Directory to serve (can be used multiple times, checked in order)",
			example: "-s build -s custom/overrides"
		},
		{
			names: ["--port", "-p"],
			hasValue: true,
			defaultValue: "8080",
			description: "HTTP server port"
		},
		{
			names: ["--ws-port"],
			hasValue: true,
			defaultValue: "8081",
			description: "WebSocket port for live reload"
		},
		{
			names: ["--haxe-path"],
			hasValue: true,
			defaultValue: "haxe",
			description: "Path to haxe executable"
		},
		{
			names: ["--server-port"],
			hasValue: true,
			defaultValue: "7000",
			description: "Haxe compilation server port"
		},
		{
			names: ["--verbose"],
			hasValue: false,
			description: "Print more logs"
		},
		{
			names: ["--help"],
			hasValue: false,
			description: "Show this help message"
		},
	];

	public static function getConfig():Null<ServerConfig> {
		final args = Sys.args();
		final config:ServerConfig = {
			watchDirs: [],
			serveDirs: []
		};

		var i = 0;
		while (i < args.length) {
			final arg = args[i];
			var matched = false;

			for (option in cliOptions) {
				if (option.names.contains(arg)) {
					matched = true;

					if (arg == "--help") {
						printHelp();
						return null;
					}

					if (!option.hasValue) {
						i++;
						break;
					}

					if (i + 1 >= args.length) {
						Sys.stderr().writeString('Error: ${option.names[0]} requires a value\n');
						process.exit(1);
					}

					final value = args[++i];

					switch (option.names[0]) {
						case "--hxml":
							config.hxmlPath = value;
						case "--watch":
							config.watchDirs.push(value);
						case "--serve":
							config.serveDirs.push(value);
						case "--port":
							config.port = Std.parseInt(value);
						case "--ws-port":
							config.wsPort = Std.parseInt(value);
						case "--haxe-path":
							config.haxePath = value;
						case "--server-port":
							config.serverPort = Std.parseInt(value);
					}
					break;
				}
			}

			if (!matched) {
				Sys.stderr().writeString('Warning: Unknown argument "$arg"\n');
			}

			i++;
		}

		final defConfig:ServerConfig = {};
		if (config.serveDirs.length == 0) config.serveDirs = defConfig.serveDirs;
		if (config.watchDirs.length == 0) config.watchDirs = defConfig.watchDirs;

		return config;
	}

	static function printHelp():Void {
		Sys.println("Haxe Dev Server - Development HTTP server with live reload");
		Sys.println("");
		Sys.println("Usage: haxe-dev-server [options]");
		Sys.println("");
		Sys.println("Options:");

		// Calculate max width for alignment
		var maxWidth = 0;
		for (option in cliOptions) {
			final nameStr = option.names.join(", ");
			final fullStr = option.hasValue ? '$nameStr <value>' : nameStr;
			if (fullStr.length > maxWidth) {
				maxWidth = fullStr.length;
			}
		}

		// Print options with alignment
		for (option in cliOptions) {
			final nameStr = option.names.join(", ");
			final fullStr = option.hasValue ? '$nameStr <value>' : nameStr;
			final padded = fullStr.rpad(" ", maxWidth + 2);

			var desc = option.description;
			if (option.defaultValue != null) {
				desc += ' (default: ${option.defaultValue})';
			}

			Sys.println('  $padded$desc');

			if (option.example != null) {
				Sys.println('  ${"".rpad(" ", maxWidth + 2)}Example: ${option.example}');
			}
		}
	}
}
