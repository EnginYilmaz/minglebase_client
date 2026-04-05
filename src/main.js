import Login from "./scenes/Login.js";
import Waiting from "./scenes/Waiting.js";
import UskudarSahilyolu from "./scenes/UskudarSahilyolu.js";

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

class Boot extends Phaser.Scene {

	preload() {
		
		this.load.pack("boot-pack", "assets/preload-asset-pack.json");
	}

	create() {
		this.scene.start("Preload");
	}
}

window.addEventListener('load', function () {

	var game = new Phaser.Game({
		width: 1920,
		height: 1080,
		type: Phaser.AUTO,
        backgroundColor: "#242424",
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
			orientation: Phaser.Scale.LANDSCAPE
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
	game.scene.add("uskudarsahilyolu", UskudarSahilyolu);
	game.scene.add("Boot", Boot, true);
});