#!/usr/bin/env node
;(function ($global) { "use strict";
var $estr = function() { return js_Boot.__string_rec(this,''); },$hxEnums = $hxEnums || {},$_;
function $extend(from, fields) {
	var proto = Object.create(from);
	for (var name in fields) proto[name] = fields[name];
	if( fields.toString !== Object.prototype.toString ) proto.toString = fields.toString;
	return proto;
}
var Chokidar = require("chokidar");
var Cli = function() { };
Cli.__name__ = "Cli";
Cli.getConfig = function() {
	var args = process.argv.slice(2);
	var config = new ServerConfig(null,[],[],null,null,null,null,null);
	var i = 0;
	while(i < args.length) {
		var arg = args[i];
		var matched = false;
		var _g = 0;
		var _g1 = Cli.cliOptions;
		while(_g < _g1.length) {
			var option = _g1[_g];
			++_g;
			if(option.names.indexOf(arg) != -1) {
				matched = true;
				if(arg == "--help") {
					Cli.printHelp();
					return null;
				}
				if(!option.hasValue) {
					++i;
					break;
				}
				if(i + 1 >= args.length) {
					new _$Sys_FileOutput(2).writeString("Error: " + option.names[0] + " requires a value\n");
					process.exit(1);
				}
				var value = args[++i];
				switch(option.names[0]) {
				case "--haxe-path":
					config.haxePath = value;
					break;
				case "--hxml":
					config.hxmlPath = value;
					break;
				case "--port":
					config.port = Std.parseInt(value);
					break;
				case "--serve":
					config.serveDirs.push(value);
					break;
				case "--server-port":
					config.serverPort = Std.parseInt(value);
					break;
				case "--watch":
					config.watchDirs.push(value);
					break;
				case "--ws-port":
					config.wsPort = Std.parseInt(value);
					break;
				}
				break;
			}
		}
		if(!matched) {
			new _$Sys_FileOutput(2).writeString("Warning: Unknown argument \"" + arg + "\"\n");
		}
		++i;
	}
	var defConfig = new ServerConfig(null,null,null,null,null,null,null,null);
	if(config.serveDirs.length == 0) {
		config.serveDirs = defConfig.serveDirs;
	}
	if(config.watchDirs.length == 0) {
		config.watchDirs = defConfig.watchDirs;
	}
	return config;
};
Cli.printHelp = function() {
	process.stdout.write("Haxe Dev Server - Development HTTP server with live reload");
	process.stdout.write("\n");
	process.stdout.write("");
	process.stdout.write("\n");
	process.stdout.write("Usage: haxe-dev-server [options]");
	process.stdout.write("\n");
	process.stdout.write("");
	process.stdout.write("\n");
	process.stdout.write("Options:");
	process.stdout.write("\n");
	var maxWidth = 0;
	var _g = 0;
	var _g1 = Cli.cliOptions;
	while(_g < _g1.length) {
		var option = _g1[_g];
		++_g;
		var nameStr = option.names.join(", ");
		var fullStr = option.hasValue ? "" + nameStr + " <value>" : nameStr;
		if(fullStr.length > maxWidth) {
			maxWidth = fullStr.length;
		}
	}
	var _g = 0;
	var _g1 = Cli.cliOptions;
	while(_g < _g1.length) {
		var option = _g1[_g];
		++_g;
		var nameStr = option.names.join(", ");
		var padded = StringTools.rpad(option.hasValue ? "" + nameStr + " <value>" : nameStr," ",maxWidth + 2);
		var desc = option.description;
		if(option.defaultValue != null) {
			desc += " (default: " + option.defaultValue + ")";
		}
		process.stdout.write(Std.string("  " + padded + desc));
		process.stdout.write("\n");
		if(option.example != null) {
			var v = "  " + StringTools.rpad(""," ",maxWidth + 2) + "Example: " + option.example;
			process.stdout.write(Std.string(v));
			process.stdout.write("\n");
		}
	}
};
var ServerConfig = function(hxmlPath,watchDirs,serveDirs,port,wsPort,haxePath,serverPort,verbose) {
	this.verbose = false;
	this.serverPort = 7000;
	this.haxePath = "haxe";
	this.wsPort = 8081;
	this.port = 8080;
	this.serveDirs = ["build"];
	this.watchDirs = ["src"];
	this.hxmlPath = "build.hxml";
	if(hxmlPath != null) {
		this.hxmlPath = hxmlPath;
	}
	if(watchDirs != null) {
		this.watchDirs = watchDirs;
	}
	if(serveDirs != null) {
		this.serveDirs = serveDirs;
	}
	if(port != null) {
		this.port = port;
	}
	if(wsPort != null) {
		this.wsPort = wsPort;
	}
	if(haxePath != null) {
		this.haxePath = haxePath;
	}
	if(serverPort != null) {
		this.serverPort = serverPort;
	}
	if(verbose != null) {
		this.verbose = verbose;
	}
};
ServerConfig.__name__ = "ServerConfig";
var haxe_ds_StringMap = function() {
	this.h = Object.create(null);
};
haxe_ds_StringMap.__name__ = "haxe.ds.StringMap";
var HaxeDevServer = function(config) {
	this.needsRecompile = false;
	this.isCompiling = false;
	this.wsClients = [];
	this.config = config;
	var script = js_node_Fs.readFileSync("" + __dirname + "/../res/live-reload.js",{ encoding : "utf8"});
	this.liveReloadScript = StringTools.replace(script,"{{wsPort}}","" + config.wsPort);
	if(!sys_FileSystem.exists(config.hxmlPath)) {
		var msg = "" + config.hxmlPath + " not found.";
		process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + msg));
		process.stdout.write("\n");
		process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + "Set hxml path with `--hxml myfile.hxml`"));
		process.stdout.write("\n");
		process.exit(1);
	}
	this.startHttpServer();
	this.startWebSocketServer();
	this.startCompilationServer();
	this.startFileWatcher();
	var msg = "Haxe Dev Server running at http://localhost:" + config.port;
	process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + msg));
	process.stdout.write("\n");
	var msg = "Watching " + Std.string(config.watchDirs) + " for changes...";
	process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + msg));
	process.stdout.write("\n");
	process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + "Serving directories (in priority order):"));
	process.stdout.write("\n");
	var _this = config.serveDirs;
	var _g_current = 0;
	while(_g_current < _this.length) {
		var _g_value = _this[_g_current++];
		process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + ("  " + (_g_current - 1 + 1) + ". " + _g_value)));
		process.stdout.write("\n");
	}
};
HaxeDevServer.__name__ = "HaxeDevServer";
HaxeDevServer.main = function() {
	process.argv.slice(2);
	var config = Cli.getConfig();
	if(config == null) {
		return;
	}
	var server = new HaxeDevServer(config);
	process.on("SIGINT",function() {
		process.stdout.write("\nShutting down...");
		process.stdout.write("\n");
		server.close();
		process.exit(0);
	});
};
HaxeDevServer.prototype = {
	startHttpServer: function() {
		var _gthis = this;
		var server = js_node_Http.createServer(function(req,res) {
			_gthis.serveFile(req,res);
		});
		server.listen(this.config.port);
		server.on("error",function(err) {
			if(err.code == "EADDRINUSE") {
				new _$Sys_FileOutput(2).writeString("[\x1B[31mHaxeDevServer\x1B[0m] " + ("Port " + _gthis.config.port + " is already in use") + "\n");
				process.exit(1);
			}
		});
	}
	,startWebSocketServer: function() {
		var _gthis = this;
		this.wsServer = new js_npm_ws_Server({ port : this.config.wsPort});
		this.wsServer.on("connection",function(client) {
			if(_gthis.wsClients.indexOf(client) == -1) {
				_gthis.wsClients.push(client);
			}
			return client.on("close",function() {
				return HxOverrides.remove(_gthis.wsClients,client);
			});
		});
	}
	,startCompilationServer: function() {
		var _gthis = this;
		this.compilationServer = js_node_ChildProcess.spawn(this.config.haxePath,["--wait",Std.string(this.config.serverPort)]);
		this.compilationServer.stdout.on("data",function(data) {
			var msg = "[Haxe Server] " + StringTools.trim(data.toString());
			process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + msg));
			process.stdout.write("\n");
		});
		this.compilationServer.stderr.on("data",function(data) {
			var msg = "[Haxe Server] " + StringTools.trim(data.toString());
			new _$Sys_FileOutput(2).writeString("[\x1B[31mHaxeDevServer\x1B[0m] " + msg + "\n");
		});
		this.compilationServer.on("close",function(code) {
			process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + "Haxe compilation server stopped"));
			process.stdout.write("\n");
		});
		global.setTimeout(function() {
			_gthis.triggerCompilation();
		},100);
	}
	,startFileWatcher: function() {
		var _gthis = this;
		this.watcher = Chokidar.watch(this.config.watchDirs.slice().concat([this.config.hxmlPath]),{ ignored : function(path,stats) {
			if(!(stats != null ? stats.isFile() : null)) {
				return false;
			}
			if(StringTools.startsWith(path,".")) {
				return true;
			}
			return false;
		}, persistent : true, ignoreInitial : true});
		this.watcher.on("all",function(event,path) {
			var fileName = haxe_io_Path.withoutDirectory(path);
			if(_gthis.config.verbose) {
				process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + ("File changed: " + fileName)));
				process.stdout.write("\n");
			}
			_gthis.scheduleCompilation();
		});
	}
	,scheduleCompilation: function() {
		if(this.isCompiling) {
			this.needsRecompile = true;
		} else {
			this.triggerCompilation();
		}
	}
	,triggerCompilation: function() {
		var _gthis = this;
		this.isCompiling = true;
		this.needsRecompile = false;
		process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + "Compiling Haxe..."));
		process.stdout.write("\n");
		var haxeProcess = js_node_ChildProcess.spawn(this.config.haxePath,["--connect",Std.string(this.config.serverPort),this.config.hxmlPath]);
		var output = "";
		haxeProcess.stdout.on("data",function(data) {
			var str = data.toString();
			output += str;
			process.stdout.write(Std.string(str));
		});
		haxeProcess.stderr.on("data",function(data) {
			var str = data.toString();
			output += str;
			new _$Sys_FileOutput(2).writeString(str);
		});
		haxeProcess.on("close",function(code) {
			_gthis.isCompiling = false;
			if(code == 0) {
				process.stdout.write(Std.string("[\x1B[32mHaxeDevServer\x1B[0m] " + "✓ Compilation successful"));
				process.stdout.write("\n");
				_gthis.notifyClients();
			} else {
				new _$Sys_FileOutput(2).writeString("[\x1B[31mHaxeDevServer\x1B[0m] " + "✗ Compilation failed" + "\n");
			}
			if(_gthis.needsRecompile) {
				global.setTimeout(function() {
					_gthis.triggerCompilation();
				},100);
			}
		});
	}
	,notifyClients: function() {
		var _gthis = this;
		if(this.wsClients.length == 0) {
			return;
		}
		global.setTimeout(function() {
			var message = JSON.stringify({ type : "reload"});
			var _g = 0;
			var _g1 = _gthis.wsClients;
			while(_g < _g1.length) _g1[_g++].send(message,null);
		},200);
	}
	,serveFile: function(req,res) {
		var _gthis = this;
		var url;
		try {
			url = new js_node_url_URL(this.safeDecodeURI(req.url),"http://localhost");
		} catch( _g ) {
			url = new js_node_url_URL("/","http://localhost");
		}
		var filePath;
		var filePath1 = this.findFile(url);
		if(filePath1 != null) {
			filePath = filePath1;
		} else {
			var msg = "File not found: " + url.pathname;
			process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + msg));
			process.stdout.write("\n");
			this.handleNotFound(res,url.pathname);
			return;
		}
		var ext = haxe_io_Path.extension(filePath).toLowerCase();
		res.setHeader("content-type",this.getMimeType(ext));
		res.setHeader("cache-control","no-cache");
		js_node_Fs.readFile(filePath,function(err,data) {
			if(err != null) {
				_gthis.handleFileError(err,res,filePath);
				return;
			}
			if(ext == "html") {
				var html = data.toString();
				html = _gthis.injectLiveReload(html);
				res.end(html);
			} else {
				res.end(data);
			}
		});
	}
	,findFile: function(url) {
		var pathname = url.pathname;
		if(pathname == "/") {
			pathname = "/index.html";
		}
		var cleanPath = StringTools.startsWith(pathname,"/") ? HxOverrides.substr(pathname,1,null) : pathname;
		var _g = 0;
		var _g1 = this.config.serveDirs;
		while(_g < _g1.length) {
			var serveDir = _g1[_g];
			++_g;
			var filePath = js_node_Path.join(serveDir,cleanPath);
			var resolved = js_node_Path.resolve(filePath);
			var baseDir = js_node_Path.resolve(serveDir);
			if(!StringTools.startsWith(resolved,baseDir)) {
				continue;
			}
			try {
				var stats = js_node_Fs.statSync(filePath);
				if(stats.isFile()) {
					return filePath;
				}
			} catch( _g2 ) {
				continue;
			}
		}
		return null;
	}
	,injectLiveReload: function(html) {
		var script = "\n<script>\n" + this.liveReloadScript + "</script>\n";
		if(html.indexOf("</body>") != -1) {
			return this.replaceLast(html,"</body>",script + "</body>");
		} else if(html.indexOf("</html>") != -1) {
			return this.replaceLast(html,"</html>",script + "</html>");
		} else {
			return html + script;
		}
	}
	,replaceLast: function(str,search,replace) {
		var lastIndex = str.lastIndexOf(search);
		if(lastIndex == -1) {
			return str;
		}
		return str.substring(0,lastIndex) + replace + str.substring(lastIndex + search.length,str.length);
	}
	,handleNotFound: function(res,pathname) {
		res.setHeader("content-type","text/html");
		res.statusCode = 404;
		res.end("<h1>404 Not Found</h1><p>File not found: " + pathname + "</p><p>Searched in: " + this.config.serveDirs.join(", ") + "</p>");
	}
	,handleFileError: function(err,res,filePath) {
		res.setHeader("content-type","text/html");
		if(err.code == "ENOENT") {
			res.statusCode = 404;
			res.end("<h1>404 Not Found</h1><p>File not found: " + filePath + "</p>");
		} else {
			res.statusCode = 500;
			res.end("<h1>500 Internal Server Error</h1><p>" + Std.string(err) + "</p>");
		}
	}
	,getMimeType: function(ext) {
		var tmp = HaxeDevServer.mimeTypes.h[ext];
		if(tmp != null) {
			return tmp;
		} else {
			return "application/octet-stream";
		}
	}
	,safeDecodeURI: function(data) {
		try {
			return decodeURI(data);
		} catch( _g ) {
			return "";
		}
	}
	,close: function() {
		if(this.watcher != null) {
			this.watcher.close();
		}
		if(this.compilationServer != null) {
			this.compilationServer.kill();
		}
		if(this.wsServer != null) {
			this.wsServer.close();
		}
		process.stdout.write(Std.string("[\x1B[36mHaxeDevServer\x1B[0m] " + "Server closed"));
		process.stdout.write("\n");
	}
};
var HxOverrides = function() { };
HxOverrides.__name__ = "HxOverrides";
HxOverrides.cca = function(s,index) {
	var x = s.charCodeAt(index);
	if(x != x) {
		return undefined;
	}
	return x;
};
HxOverrides.substr = function(s,pos,len) {
	if(len == null) {
		len = s.length;
	} else if(len < 0) {
		if(pos == 0) {
			len = s.length + len;
		} else {
			return "";
		}
	}
	return s.substr(pos,len);
};
HxOverrides.remove = function(a,obj) {
	var i = a.indexOf(obj);
	if(i == -1) {
		return false;
	}
	a.splice(i,1);
	return true;
};
HxOverrides.now = function() {
	return Date.now();
};
Math.__name__ = "Math";
var Std = function() { };
Std.__name__ = "Std";
Std.string = function(s) {
	return js_Boot.__string_rec(s,"");
};
Std.parseInt = function(x) {
	var v = parseInt(x);
	if(isNaN(v)) {
		return null;
	}
	return v;
};
var StringTools = function() { };
StringTools.__name__ = "StringTools";
StringTools.startsWith = function(s,start) {
	return s.length >= start.length && s.lastIndexOf(start,0) == 0;
};
StringTools.isSpace = function(s,pos) {
	var c = HxOverrides.cca(s,pos);
	return c > 8 && c < 14 || c == 32;
};
StringTools.trim = function(s) {
	var l = s.length;
	var r = 0;
	while(r < l && StringTools.isSpace(s,l - r - 1)) ++r;
	var s1 = r > 0 ? HxOverrides.substr(s,0,l - r) : s;
	var l = s1.length;
	var r = 0;
	while(r < l && StringTools.isSpace(s1,r)) ++r;
	if(r > 0) {
		return HxOverrides.substr(s1,r,l - r);
	} else {
		return s1;
	}
};
StringTools.rpad = function(s,c,l) {
	if(c.length <= 0) {
		return s;
	}
	var buf_b = "";
	buf_b = "" + (s == null ? "null" : "" + s);
	while(buf_b.length < l) buf_b += c == null ? "null" : "" + c;
	return buf_b;
};
StringTools.replace = function(s,sub,by) {
	return s.split(sub).join(by);
};
var haxe_io_Output = function() { };
haxe_io_Output.__name__ = "haxe.io.Output";
haxe_io_Output.prototype = {
	writeByte: function(c) {
		throw new haxe_exceptions_NotImplementedException(null,null,{ fileName : "haxe/io/Output.hx", lineNumber : 47, className : "haxe.io.Output", methodName : "writeByte"});
	}
	,writeBytes: function(s,pos,len) {
		if(pos < 0 || len < 0 || pos + len > s.length) {
			throw haxe_Exception.thrown(haxe_io_Error.OutsideBounds);
		}
		var b = s.b;
		var k = len;
		while(k > 0) {
			this.writeByte(b[pos]);
			++pos;
			--k;
		}
		return len;
	}
	,writeFullBytes: function(s,pos,len) {
		while(len > 0) {
			var k = this.writeBytes(s,pos,len);
			pos += k;
			len -= k;
		}
	}
	,writeString: function(s,encoding) {
		var b = haxe_io_Bytes.ofString(s,encoding);
		this.writeFullBytes(b,0,b.length);
	}
};
var _$Sys_FileOutput = function(fd) {
	this.fd = fd;
};
_$Sys_FileOutput.__name__ = "_Sys.FileOutput";
_$Sys_FileOutput.__super__ = haxe_io_Output;
_$Sys_FileOutput.prototype = $extend(haxe_io_Output.prototype,{
	writeByte: function(c) {
		js_node_Fs.writeSync(this.fd,String.fromCodePoint(c));
	}
	,writeBytes: function(s,pos,len) {
		var data = s.b;
		return js_node_Fs.writeSync(this.fd,js_node_buffer_Buffer.from(data.buffer,data.byteOffset,s.length),pos,len);
	}
	,writeString: function(s,encoding) {
		js_node_Fs.writeSync(this.fd,s);
	}
});
var haxe_Exception = function(message,previous,native) {
	Error.call(this,message);
	this.message = message;
	this.__previousException = previous;
	this.__nativeException = native != null ? native : this;
};
haxe_Exception.__name__ = "haxe.Exception";
haxe_Exception.thrown = function(value) {
	if(((value) instanceof haxe_Exception)) {
		return value.get_native();
	} else if(((value) instanceof Error)) {
		return value;
	} else {
		var e = new haxe_ValueException(value);
		return e;
	}
};
haxe_Exception.__super__ = Error;
haxe_Exception.prototype = $extend(Error.prototype,{
	toString: function() {
		return this.get_message();
	}
	,get_message: function() {
		return this.message;
	}
	,get_native: function() {
		return this.__nativeException;
	}
});
var haxe_ValueException = function(value,previous,native) {
	haxe_Exception.call(this,String(value),previous,native);
	this.value = value;
};
haxe_ValueException.__name__ = "haxe.ValueException";
haxe_ValueException.__super__ = haxe_Exception;
haxe_ValueException.prototype = $extend(haxe_Exception.prototype,{
});
var haxe_exceptions_PosException = function(message,previous,pos) {
	haxe_Exception.call(this,message,previous);
	if(pos == null) {
		this.posInfos = { fileName : "(unknown)", lineNumber : 0, className : "(unknown)", methodName : "(unknown)"};
	} else {
		this.posInfos = pos;
	}
};
haxe_exceptions_PosException.__name__ = "haxe.exceptions.PosException";
haxe_exceptions_PosException.__super__ = haxe_Exception;
haxe_exceptions_PosException.prototype = $extend(haxe_Exception.prototype,{
	toString: function() {
		return "" + haxe_Exception.prototype.toString.call(this) + " in " + this.posInfos.className + "." + this.posInfos.methodName + " at " + this.posInfos.fileName + ":" + this.posInfos.lineNumber;
	}
});
var haxe_exceptions_NotImplementedException = function(message,previous,pos) {
	if(message == null) {
		message = "Not implemented";
	}
	haxe_exceptions_PosException.call(this,message,previous,pos);
};
haxe_exceptions_NotImplementedException.__name__ = "haxe.exceptions.NotImplementedException";
haxe_exceptions_NotImplementedException.__super__ = haxe_exceptions_PosException;
haxe_exceptions_NotImplementedException.prototype = $extend(haxe_exceptions_PosException.prototype,{
});
var haxe_io_Bytes = function(data) {
	this.length = data.byteLength;
	this.b = new Uint8Array(data);
	this.b.bufferValue = data;
	data.hxBytes = this;
	data.bytes = this.b;
};
haxe_io_Bytes.__name__ = "haxe.io.Bytes";
haxe_io_Bytes.ofString = function(s,encoding) {
	if(encoding == haxe_io_Encoding.RawNative) {
		var buf = new Uint8Array(s.length << 1);
		var _g = 0;
		var _g1 = s.length;
		while(_g < _g1) {
			var i = _g++;
			var c = s.charCodeAt(i);
			buf[i << 1] = c & 255;
			buf[i << 1 | 1] = c >> 8;
		}
		return new haxe_io_Bytes(buf.buffer);
	}
	var a = [];
	var i = 0;
	while(i < s.length) {
		var c = s.charCodeAt((i++));
		if(55296 <= c && c <= 56319) {
			c = c - 55232 << 10 | s.charCodeAt((i++)) & 1023;
		}
		if(c <= 127) {
			a.push(c);
		} else if(c <= 2047) {
			a.push(192 | c >> 6);
			a.push(128 | c & 63);
		} else if(c <= 65535) {
			a.push(224 | c >> 12);
			a.push(128 | c >> 6 & 63);
			a.push(128 | c & 63);
		} else {
			a.push(240 | c >> 18);
			a.push(128 | c >> 12 & 63);
			a.push(128 | c >> 6 & 63);
			a.push(128 | c & 63);
		}
	}
	return new haxe_io_Bytes(new Uint8Array(a).buffer);
};
var haxe_io_Encoding = $hxEnums["haxe.io.Encoding"] = { __ename__:true,__constructs__:null
	,UTF8: {_hx_name:"UTF8",_hx_index:0,__enum__:"haxe.io.Encoding",toString:$estr}
	,RawNative: {_hx_name:"RawNative",_hx_index:1,__enum__:"haxe.io.Encoding",toString:$estr}
};
haxe_io_Encoding.__constructs__ = [haxe_io_Encoding.UTF8,haxe_io_Encoding.RawNative];
var haxe_io_Error = $hxEnums["haxe.io.Error"] = { __ename__:true,__constructs__:null
	,Blocked: {_hx_name:"Blocked",_hx_index:0,__enum__:"haxe.io.Error",toString:$estr}
	,Overflow: {_hx_name:"Overflow",_hx_index:1,__enum__:"haxe.io.Error",toString:$estr}
	,OutsideBounds: {_hx_name:"OutsideBounds",_hx_index:2,__enum__:"haxe.io.Error",toString:$estr}
	,Custom: ($_=function(e) { return {_hx_index:3,e:e,__enum__:"haxe.io.Error",toString:$estr,__params__:function(){ return [this.e];}}; },$_._hx_name="Custom",$_)
};
haxe_io_Error.__constructs__ = [haxe_io_Error.Blocked,haxe_io_Error.Overflow,haxe_io_Error.OutsideBounds,haxe_io_Error.Custom];
var haxe_io_Path = function(path) {
	switch(path) {
	case ".":case "..":
		this.dir = path;
		this.file = "";
		return;
	}
	var c1 = path.lastIndexOf("/");
	var c2 = path.lastIndexOf("\\");
	if(c1 < c2) {
		this.dir = HxOverrides.substr(path,0,c2);
		path = HxOverrides.substr(path,c2 + 1,null);
		this.backslash = true;
	} else if(c2 < c1) {
		this.dir = HxOverrides.substr(path,0,c1);
		path = HxOverrides.substr(path,c1 + 1,null);
	} else {
		this.dir = null;
	}
	var cp = path.lastIndexOf(".");
	if(cp != -1) {
		this.ext = HxOverrides.substr(path,cp + 1,null);
		this.file = HxOverrides.substr(path,0,cp);
	} else {
		this.ext = null;
		this.file = path;
	}
};
haxe_io_Path.__name__ = "haxe.io.Path";
haxe_io_Path.withoutDirectory = function(path) {
	var s = new haxe_io_Path(path);
	s.dir = null;
	return s.toString();
};
haxe_io_Path.extension = function(path) {
	var s = new haxe_io_Path(path);
	if(s.ext == null) {
		return "";
	}
	return s.ext;
};
haxe_io_Path.prototype = {
	toString: function() {
		return (this.dir == null ? "" : this.dir + (this.backslash ? "\\" : "/")) + this.file + (this.ext == null ? "" : "." + this.ext);
	}
};
var haxe_iterators_ArrayIterator = function(array) {
	this.current = 0;
	this.array = array;
};
haxe_iterators_ArrayIterator.__name__ = "haxe.iterators.ArrayIterator";
haxe_iterators_ArrayIterator.prototype = {
	hasNext: function() {
		return this.current < this.array.length;
	}
	,next: function() {
		return this.array[this.current++];
	}
};
var js_Boot = function() { };
js_Boot.__name__ = "js.Boot";
js_Boot.__string_rec = function(o,s) {
	if(o == null) {
		return "null";
	}
	if(s.length >= 5) {
		return "<...>";
	}
	var t = typeof(o);
	if(t == "function" && (o.__name__ || o.__ename__)) {
		t = "object";
	}
	switch(t) {
	case "function":
		return "<function>";
	case "object":
		if(o.__enum__) {
			var e = $hxEnums[o.__enum__];
			var con = e.__constructs__[o._hx_index];
			var n = con._hx_name;
			if(o.__params__) {
				s = s + "\t";
				var params = o.__params__();
				var _g = 0;
				var _g1 = params.length;
				while(true) {
					if(_g >= _g1) {
						break;
					}
					var i = (function($this) {
						var $r;
						_g = _g + 1;
						$r = _g - 1;
						return $r;
					}(this));
					params[i] = js_Boot.__string_rec(params[i],s);
				}
				return (n == null ? "null" : "" + n) + "(" + params.join(",") + ")";
			} else {
				return n;
			}
		}
		if(((o) instanceof Array)) {
			var str = "[";
			s += "\t";
			var _g = 0;
			var _g1 = o.length;
			while(_g < _g1) {
				var i = _g++;
				str += (i > 0 ? "," : "") + js_Boot.__string_rec(o[i],s);
			}
			str += "]";
			return str;
		}
		var tostr;
		try {
			tostr = o.toString;
		} catch( _g ) {
			return "???";
		}
		if(tostr != null && tostr != Object.toString && typeof(tostr) == "function") {
			var s2 = o.toString();
			if(s2 != "[object Object]") {
				return s2;
			}
		}
		var str = "{\n";
		s += "\t";
		var hasp = o.hasOwnProperty != null;
		var k = null;
		for( k in o ) {
		if(hasp && !o.hasOwnProperty(k)) {
			continue;
		}
		if(k == "prototype" || k == "__class__" || k == "__super__" || k == "__interfaces__" || k == "__properties__") {
			continue;
		}
		if(str.length != 2) {
			str += ", \n";
		}
		str += s + k + " : " + js_Boot.__string_rec(o[k],s);
		}
		s = s.substring(1);
		str += "\n" + s + "}";
		return str;
	case "string":
		return o;
	default:
		return String(o);
	}
};
var js_node_ChildProcess = require("child_process");
var js_node_Fs = require("fs");
var js_node_Http = require("http");
var js_node_Path = require("path");
var js_node_buffer_Buffer = require("buffer").Buffer;
var js_node_url_URL = require("url").URL;
var js_npm_ws_Server = require("ws").Server;
var sys_FileSystem = function() { };
sys_FileSystem.__name__ = "sys.FileSystem";
sys_FileSystem.exists = function(path) {
	try {
		js_node_Fs.accessSync(path);
		return true;
	} catch( _g ) {
		return false;
	}
};
if(typeof(performance) != "undefined" ? typeof(performance.now) == "function" : false) {
	HxOverrides.now = performance.now.bind(performance);
}
if( String.fromCodePoint == null ) String.fromCodePoint = function(c) { return c < 0x10000 ? String.fromCharCode(c) : String.fromCharCode((c>>10)+0xD7C0)+String.fromCharCode((c&0x3FF)+0xDC00); }
String.__name__ = "String";
Array.__name__ = "Array";
js_Boot.__toStr = ({ }).toString;
Cli.cliOptions = [{ names : ["--hxml","-h"], hasValue : true, defaultValue : "build.hxml", description : "Haxe build file"},{ names : ["--watch","-w"], hasValue : true, defaultValue : "src", description : "Source directory to watch"},{ names : ["--serve","-s"], hasValue : true, defaultValue : "build", description : "Directory to serve (can be used multiple times, checked in order)", example : "-s build -s custom/overrides"},{ names : ["--port","-p"], hasValue : true, defaultValue : "8080", description : "HTTP server port"},{ names : ["--ws-port"], hasValue : true, defaultValue : "8081", description : "WebSocket port for live reload"},{ names : ["--haxe-path"], hasValue : true, defaultValue : "haxe", description : "Path to haxe executable"},{ names : ["--server-port"], hasValue : true, defaultValue : "7000", description : "Haxe compilation server port"},{ names : ["--verbose"], hasValue : false, description : "Print more logs"},{ names : ["--help"], hasValue : false, description : "Show this help message"}];
HaxeDevServer.mimeTypes = (function($this) {
	var $r;
	var _g = new haxe_ds_StringMap();
	_g.h["html"] = "text/html";
	_g.h["js"] = "text/javascript";
	_g.h["css"] = "text/css";
	_g.h["json"] = "application/json";
	_g.h["png"] = "image/png";
	_g.h["jpg"] = "image/jpeg";
	_g.h["jpeg"] = "image/jpeg";
	_g.h["gif"] = "image/gif";
	_g.h["webp"] = "image/webp";
	_g.h["avif"] = "image/avif";
	_g.h["svg"] = "image/svg+xml";
	_g.h["ico"] = "image/x-icon";
	_g.h["wav"] = "audio/wav";
	_g.h["mp3"] = "audio/mpeg";
	_g.h["ogg"] = "audio/ogg";
	_g.h["mp4"] = "video/mp4";
	_g.h["webm"] = "video/webm";
	_g.h["woff"] = "application/font-woff";
	_g.h["ttf"] = "application/font-ttf";
	_g.h["eot"] = "application/vnd.ms-fontobject";
	_g.h["otf"] = "application/font-otf";
	_g.h["wasm"] = "application/wasm";
	$r = _g;
	return $r;
}(this));
HaxeDevServer.main();
})({});
