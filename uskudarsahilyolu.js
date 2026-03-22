
// You can write more code here

/* START OF COMPILED CODE */

class uskudarsahilyolu extends Phaser.Scene {

	constructor() {
		super("uskudarsahilyolu");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// uskudarseasight
		const uskudarseasight = this.add.tileSprite(0, 1.4525070190429688, 3136, 768, "uskudarseasight");
		uskudarseasight.scaleY = 0.8457428782318994;
		uskudarseasight.setOrigin(0, 0);

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
