/**
 * Kaykaylı Kız – oyuncu karakter sınıfı.
 * Sahne (scene) referansı alır, sprite + fizik + animasyonları oluşturur,
 * hareket fonksiyonlarını ve update-input mantığını barındırır.
 * 2.5D hat (lane) sistemini destekler.
 */
export default class KaykayliKiz {

	/** Sabit görüntü boyutu (piksel) — frame boyutlarından bağımsız */
	static BASE_DISPLAY_W = 240;
	static BASE_DISPLAY_H = 360;

	/** 3 hat tanımı: arka (uzak) → ön (yakın) */
	static LANES = [
		{ groundY: 320, scaleMult: 0.85, depth: 15 },  // arka hat (uzak, küçük)
		{ groundY: 360, scaleMult: 1.0,  depth: 25 },  // orta hat (varsayılan)
		{ groundY: 400, scaleMult: 1.15, depth: 30 },  // ön hat (yakın, büyük)
	];

	constructor(scene, x, y) {
		this.scene = scene;
		this.yon = false;
		this.duruyor = true;
		this.adimlayabilir = true;
		this.hareketCekiyor = false;
		this.derinNefesAliyor = false;
		this.currentLane = 1;
		this.laneScaleMult = 1.0;
		this.isChangingLane = false;
		this.isFallAnim = false;

		this._registerAnimations();

		// Sprite + fizik
		this.sprite = scene.physics.add.sprite(x, y, "kaykay_sur", 0);
		this._applyDisplaySize();
		this.sprite.setOrigin(0.5, 0.5);

		// Patch: Phaser frame değişimlerinde boyutu koru
		const self = this;
		const origSizeToFrame = this.sprite.setSizeToFrame;
		this.sprite.setSizeToFrame = function(frame) {
			origSizeToFrame.call(this, frame);
			if (self.isFallAnim) {
				// Düşme/doğrulma sırasında frame'in doğal oranını koru
				const s = self.laneScaleMult * 0.7;
				this.setScale(s);
				return this;
			}
			const w = KaykayliKiz.BASE_DISPLAY_W * self.laneScaleMult;
			const h = KaykayliKiz.BASE_DISPLAY_H * self.laneScaleMult;
			this.displayWidth = w;
			this.displayHeight = h;
			return this;
		};

		if (this.sprite.body) {
			this.sprite.body.setSize(80, 280);
			this.sprite.body.setOffset(38, 40);
			this.sprite.body.setAllowGravity(false);
			this.sprite.setBounce(0);
			this.sprite.setCollideWorldBounds(true);
			this.sprite.setMaxVelocity(400, 0);
			this.sprite.setDragX(300);
		}

		this.sprite.setDepth(KaykayliKiz.LANES[this.currentLane].depth);
	}

	/** Görüntü boyutunu lane'e göre sabitle */
	_applyDisplaySize() {
		if (this.isFallAnim) {
			const s = this.laneScaleMult * 0.7;
			this.sprite.setScale(s);
			return;
		}
		const w = KaykayliKiz.BASE_DISPLAY_W * this.laneScaleMult;
		const h = KaykayliKiz.BASE_DISPLAY_H * this.laneScaleMult;
		this.sprite.setDisplaySize(w, h);
	}

	get x() { return this.sprite.x; }
	set x(v) { this.sprite.x = v; }
	get y() { return this.sprite.y; }
	set y(v) { this.sprite.y = v; }
	get body() { return this.sprite.body; }
	get flipX() { return this.sprite.flipX; }
	set flipX(v) { this.sprite.flipX = v; }

	// ── Hat (lane) görsel güncelleme ────────────────────────────────
	setLaneVisuals(laneIndex) {
		const lane = KaykayliKiz.LANES[laneIndex];
		if (!lane) return;
		this.currentLane = laneIndex;
		this.laneScaleMult = lane.scaleMult;
		this.sprite.setDepth(lane.depth);
		this._applyDisplaySize();
	}

	/** Her frame çağrılmalı — boyutu sabitler */
	enforceSize() {
		this._applyDisplaySize();
	}

	// ── Animasyon kaydı ─────────────────────────────────────────────
	_registerAnimations() {
		const a = this.scene.anims;
		const reg = (key, sheet, start, end, rate, rpt) => {
			if (!a.exists(key)) {
				a.create({ key, frames: a.generateFrameNumbers(sheet, { start, end }), frameRate: rate, repeat: rpt });
			}
		};
		reg("player-idle",           "kaykay_sur",         0, 15, 10, -1);
		reg("kaykay_sur",            "kaykay_sur",         0, 15, 10,  0);
		reg("kaykay_cok",            "kaykay_cok",         0, 15,  7,  0);
		reg("kaykay_derinnefes",     "kaykay_derinnefes",  0, 15,  6,  0);
		reg("kaykay_dogrul",         "kaykay_cok",         8, 15, 10,  0);
		reg("kaykay_ziplama",        "kaykay_zipla",       0, 15, 10,  0);
		reg("kaykaydan_dusme",       "kaykay_dus",         0, 15, 12,  0);
		reg("kaykay_hareket_cekme",  "kaykay_hareket_cek", 0, 15, 10,  0);
		reg("kaykay_stabilize",      "kaykay_sur",         0, 15, 10,  0);
		reg("kaykay_sur_hizli",      "kaykay_sur",         0, 15, 20,  0);
	}

	// ── Hareket fonksiyonları ────────────────────────────────────────
	dur() {
		if (!this.isChangingLane) {
			this.sprite.stop();
		}
		this.sprite.setAccelerationX(0);
		this.duruyor = true;
	}

	git(yon) {
		if (!this.adimlayabilir) return;
		this.adimlayabilir = false;
		this.scene.time.delayedCall(400, () => { 
			this.adimlayabilir = true; 
		});

		this.duruyor = false;
		const mevcutHiz = this.sprite.body.velocity.x;
		yon
			? this.sprite.setVelocityX(mevcutHiz - 250)
			: this.sprite.setVelocityX(mevcutHiz + 250);

		this.sprite.flipX = yon;
		if (!this.hareketCekiyor) {
			this.sprite.play("kaykay_sur", true);
		}
	}

	zipla() {
		if (this._isJumping) return;
		this._isJumping = true;
		const baseY = this.sprite.y;
		this.sprite.play("kaykay_cok", true).chain("kaykay_ziplama").chain("kaykay_stabilize");
		this.scene.tweens.add({
			targets: this.sprite,
			y: baseY - 100,
			duration: 300,
			ease: 'Power2',
			yoyo: true,
			onComplete: () => {
				this.sprite.y = baseY;
				this._isJumping = false;
			}
		});
	}

	cok() {
		if (this._isCrouching) return;
		this._isCrouching = true;
		this.sprite.play("kaykay_cok", true);
		this.sprite.once("animationcomplete-kaykay_cok", () => {
			this._isCrouching = false;
			this.sprite.play("kaykay_sur", true);
		});
	}

	derinNefesAl() {
		if (this.derinNefesAliyor) return;
		this.derinNefesAliyor = true;
		this.sprite.setVelocityX(0);
		this.sprite.setAccelerationX(0);
		this.sprite.play("kaykay_derinnefes", true);
		this.sprite.once("animationcomplete-kaykay_derinnefes", () => {
			this.sprite.play("kaykay_sur", true);
			this.derinNefesAliyor = false;
		});
	}

	hareket_cek() {
		if (this.duruyor) return;
		if (this.hareketCekiyor) return;
		if (this._isJumping) return;
		this.hareketCekiyor = true;
		const baseY = this.sprite.y;
		this.sprite.play("kaykay_hareket_cekme", true).chain("kaykay_stabilize");
		this.scene.tweens.add({
			targets: this.sprite,
			y: baseY - 80,
			duration: 400,
			ease: 'Power2',
			yoyo: true,
			onComplete: () => {
				this.sprite.y = baseY;
			}
		});
		this.scene.time.delayedCall(1800, () => { this.hareketCekiyor = false; });
	}

	// ── Her frame çağrılacak input işleme ────────────────────────────
	// Yukarı/Aşağı artık hat değiştirme (scene tarafından yönetilir).
	// Bu metot sadece yatay hareket + dur mantığı içerir.
	handleInput(cursors, isUpPressed, isDownPressed, isLeftPressed, isRightPressed) {
		if (this.derinNefesAliyor) return;
		if (this._isCrouching) return;

		if (cursors.left.isDown || isLeftPressed) {
			this.yon = true;
			this.git(this.yon);
		} else if (cursors.right.isDown || isRightPressed) {
			this.yon = false;
			this.git(this.yon);
		} else {
			this.sprite.setAccelerationX(0);
			if (Math.abs(this.sprite.body.velocity.x) < 5) {
				this.dur();
			}
		}
	}

	/** Mevcut animasyon adı */
	getCurrentAnim() {
		return this.sprite.anims.currentAnim ? this.sprite.anims.currentAnim.key : "player-idle";
	}

	play(key, ignoreIfPlaying) {
		return this.sprite.play(key, ignoreIfPlaying);
	}
}
