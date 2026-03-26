
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

		// collider
		this.physics.add.overlap(yerzemin, karakterim);

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
