// You can write more code here

/* START OF COMPILED CODE */

class uskudarsahilyolu extends Phaser.Scene {

	constructor() {
		super("uskudarsahilyolu");

		/* START-USER-CTR-CODE */
    // Write your code here.
    this.scalex = 0.43500281694338416;
    this.scaley = 0.7749486502826686;
    this.dilencix = 1236;
    this.dilenciy = 376;
    /* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// uskudarseasight
		const uskudarseasight = this.add.tileSprite(0, 0, 3000, 640, "uskudarseasight");
		uskudarseasight.setOrigin(0, 0);
		uskudarseasight.flipX = true;
		uskudarseasight.tintTopLeft = 11019043;
		uskudarseasight.tintTopRight = 2304309;

		// cicekci
		this.cicekci = this.add.sprite(1568, 364, "cicekci_kiz", 0);
		this.cicekci.setInteractive(new Phaser.Geom.Rectangle(0, 0, 32, 32), Phaser.Geom.Rectangle.Contains);
		this.cicekci.scaleX = 0.4;
		this.cicekci.scaleY = 0.4;
		this.cicekci.visible = false;

		// sprite_1
		this.sprite_1 = this.add.sprite(1236, 376, "dilenci_yuruyor", 0);
		this.sprite_1.setInteractive(new Phaser.Geom.Rectangle(0, 0, 39, 32), Phaser.Geom.Rectangle.Contains);
		this.sprite_1.scaleX = 0.43500281694338416;
		this.sprite_1.scaleY = 0.7749486502826686;
		this.sprite_1.visible = false;
		this.sprite_1.play({"key":"dilenci_yuruyor","timeScale":7});

		// sprite_2
		const sprite_2 = this.add.sprite(1209, 333, "dilenci", 0);
		sprite_2.setInteractive(new Phaser.Geom.Rectangle(0, 0, 32, 32), Phaser.Geom.Rectangle.Contains);
		sprite_2.visible = false;
		sprite_2.play("dilenci_yokluyor");

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */
  cicekci_baslat() {
    this.physics.add.existing(this.cicekci);
    if (this.cicekci.body) {
      this.cicekci.body.setAllowGravity(false);
      this.cicekci.body.setBounce(0);
      this.cicekci.body.setSize(80, 280);
      this.cicekci.body.setOffset(101, 70);
    }
    this.cicekci.visible = true;
  }

  cicekci_guncelle() {
    if (this.cicekci && this.cicekci.body) {
      const ms = Date.now() % 12000;
      const globalTimeSec = ms / 1000;
      const anchorX = 3136 / 2;
      let targetX = anchorX;
      if (globalTimeSec < 4) {
        targetX = anchorX + globalTimeSec * 60;
        this.cicekci.body.setVelocityX(60);
        this.cicekci.flipX = false;
        this.cicekci.play("cicekci_yuru", true);
      } else if (globalTimeSec < 6) {
        targetX = anchorX + 240;
        this.cicekci.body.setVelocityX(0);
        this.cicekci.stop();
        this.cicekci.setFrame(0);
      } else if (globalTimeSec < 10) {
        targetX = anchorX + 240 - ((globalTimeSec - 6) * 60);
        this.cicekci.body.setVelocityX(-60);
        this.cicekci.flipX = true;
        this.cicekci.play("cicekci_yuru", true);
      } else {
        targetX = anchorX;
        this.cicekci.body.setVelocityX(0);
        this.cicekci.stop();
        this.cicekci.setFrame(0);
      }
      this.cicekci.setX(targetX);
    }
  }

  dilenci_baslat() {
    this.sprite_1.scaleX = this.scalex;
    this.sprite_1.scaleY = this.scaley;
    this.sprite_1.visible = true;
    this.physics.add.existing(this.sprite_1);
    this.sprite_1.body.setAllowGravity(false);
    this.dilenciDileniyor = false;
  }
  // Write your code here
  dilenci_yuru(targetX, targetY) {
    if (!this.dilenciDileniyor) return;
    this.dilenciDileniyor = false;
    this.sprite_1.play({ key: "dilenci_yuruyor", timeScale: 1 }, true);
  }
  dilenci_dilen() {
    if (this.dilenciDileniyor) return;
    this.dilenciDileniyor = true;
    this.sprite_1.body.setVelocity(0);
    this.sprite_1.play("dilenci_yokluyor", true);
  }
  dilenci_update(targetX, targetY) {
    if (!this.sprite_1 || !this.sprite_1.body) return;
    const distance = Phaser.Math.Distance.Between(
      this.sprite_1.x, this.sprite_1.y,
      targetX, targetY,
    );
    if (distance < 150) {
      this.dilenci_dilen();
    } else {
      this.dilenci_yuru();
      // Hedefe doğru yürü
      this.sprite_1.flipX = (targetX > this.sprite_1.x);
      this.physics.moveTo(this.sprite_1, targetX, targetY, 80);
    }
  }
  create() {
    this.editorCreate();
    this.dilenci_baslat();
    this.cicekci_baslat();
  }

  /* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
