(function() {
	const ws = new WebSocket("ws://localhost:{{wsPort}}");
	ws.onmessage = function(msg) {
		const data = JSON.parse(msg.data);
		if (data.type === "reload") {
			console.log("[HaxeDevServer] Reloading...");
			location.reload();
		}
	};
	ws.onopen = function() {
		console.log("[HaxeDevServer] Connected to live reload");
	};
	ws.onerror = function() {
		console.error("[HaxeDevServer] Failed to connect to live reload");
	};
})();
