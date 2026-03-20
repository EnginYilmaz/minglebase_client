import Level from "./scenes/Level.js";
import Login from "./scenes/Login.js";
import Waiting from "./scenes/Waiting.js";

window.addEventListener('load', function () {

	var game = new Phaser.Game({
		width: 1920,
		height: 1080,
		type: Phaser.AUTO,
        backgroundColor: "#242424",
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH
		},
		physics: {
			default: "arcade",
			arcade: {
				gravity: { y: 100 },
				debug: false
			}
		}
	});

	game.scene.add("Preload", Preload);
	game.scene.add("Login", Login);
	game.scene.add("Waiting", Waiting);
	game.scene.add("Level", Level);
	game.scene.add("Boot", Boot, true);
});

class Boot extends Phaser.Scene {

	preload() {
		
                this.load.pack("boot-pack", "assets/preload-asset-pack.json");
		this.scene.start("Preload");
	}
}

class Preload extends Phaser.Scene {

	constructor() {
		super("Preload");
	}

	preload() {
		this.load.pack("pack", "assets/asset-pack.json");
	}

	create() {
		this.scene.start("Login");
	}
}