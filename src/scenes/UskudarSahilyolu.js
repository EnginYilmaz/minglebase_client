// You can write more code here
import { getDb, checkMatchAndCrush, listenToMessages, sendSimsMessage } from "../firebase-chat.js";
import { getMutualMatches } from "../firebase-matches.js";
import { collection, query, where, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import KaykayliKiz from "../KaykayliKiz.js";

/* START OF COMPILED CODE */

export default class UskudarSahilyolu extends uskudarsahilyolu {

	constructor() {
		super();

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// Create dilenci animation before editor tries to play it
		if (!this.anims.exists("dilenci_idle")) {
			this.anims.create({
				key: "dilenci_idle",
				frames: this.anims.generateFrameNumbers("dilenci_yokluyor", { start: 0, end: 7 }),
				frameRate: 8,
				repeat: -1
			});
		}

		if (!this.anims.exists("dilenci_yuruyor")) {
			this.anims.create({
				key: "dilenci_yuruyor",
				frames: this.anims.generateFrameNumbers("dilenci_yuruyor", { start: 0, end: 7 }),
				frameRate: 10,
				repeat: -1
			});
		}

		if (!this.anims.exists("dilenci_yokluyor")) {
			this.anims.create({
				key: "dilenci_yokluyor",
				frames: this.anims.generateFrameNumbers("dilenci_yokluyor", { start: 0, end: 7 }),
				frameRate: 10,
				repeat: -1
			});
		}

		if (!this.anims.exists("cicekci_yuru")) {
			this.anims.create({
				key: "cicekci_yuru",
				frames: this.anims.generateFrameNumbers("cicekci_kiz", { start: 0, end: 15 }),
				frameRate: 10,
				repeat: -1
			});
		}

		super.editorCreate();
	}

	/* START-USER-CODE */

	// Durum değişkenleri
	room = null;
	myData = null;
	otherPlayers = {};
	lastSent = 0;
	cursors = null;
	karakterin = null; // KaykayliKiz instance
	yon = false;
	duruyor = true;
	adimlayabilir = true;
	cokebilir = true;
	carpisiyor = false;
	hareketCekiyor = false;
	collidingWith = {}; // Hangi oyuncularla çarpışıldığını tutar


	derinNefesAliyor = false;
	isUpPressed = false;
	isDownPressed = false;
	isLeftPressed = false;
	isRightPressed = false;
	crushButton = null;
	crushTargetId = null;
	crushSentTo = {};
	matchedUids = {};
	sevgiGosteriyor = false;

	init(data) {
		this.room = (data && data.room) ? data.room : null;
		this.myData = (data && data.me) ? data.me : null;
		this.otherPlayers = {};
		this.lastSent = 0;
	}

	create() {
		this.editorCreate();
		this.dilenci_baslat();

		// ── 2.5D Hat (lane) sistemi — set early for room handlers ──
		this.LANE_CONFIG = KaykayliKiz.LANES;
		this._isChangingLane = false;

		// ── Çok oyunculu mesaj dinleyicileri (register EARLY) ──
		if (this.room) {
			this.room.onMessage("currentPlayers", (data) => {
				data.players.forEach(p => this.createOtherPlayer(p));
			});
			this.room.onMessage("playerJoined", (playerData) => {
				this.createOtherPlayer(playerData);
			});
			this.room.onMessage("playerLeft", ({ sessionId }) => {
				if (this.otherPlayers[sessionId]) {
					this.otherPlayers[sessionId].destroy();
					delete this.otherPlayers[sessionId];
				}
			});
			this.room.onMessage("playerMoved", (data) => {
				const other = this.otherPlayers[data.sessionId];
				if (other) {
					other.setPosition(data.x, data.y);
					other.flipX = data.flipX;
					if (data.anim && other.anims) other.play(data.anim, true);
					if (data.lane !== undefined) {
						other.lane = data.lane;
						const laneConf = this.LANE_CONFIG[data.lane] || this.LANE_CONFIG[1];
						other.setDepth(laneConf.depth);
					}
				}
			});
			this.room.onMessage("crushReceived", (data) => {
				this.showCrushNotification(data.fromName || "Biri");
			});
			this.room.onMessage("crushSent", (data) => {
				this.showInfoNotification("Crush gönderildi! <3");
			});
			this.room.send("ready");
		}

		const bgWidth = 1875;

		// ── Kendi karakter oluştur (dinamik) ──
		const spawnX = (this.myData && this.myData.x) ? this.myData.x : bgWidth / 2;
		this.karakterin = new KaykayliKiz(this, spawnX, 80);
		this.karakterim = this.karakterin.sprite;

		// ── Çiçekçi Kız NPC (base class'tan gelen sprite'ı fizikle donat) ──
		this.cicekci_baslat();
		this.cicekci.setDepth(KaykayliKiz.LANES[2].depth);



		// Yatay sınır (sadece X sınırı, gravity yok)
		this.physics.world.setBounds(0, 0, bgWidth, 1000);

		// Karakteri orta hatın zeminine yerleştir
		this.karakterim.y = this.LANE_CONFIG[1].groundY;

		// ── Klavye (ESDF + J/A/C/B) ──
		this.cursors = this.input.keyboard.createCursorKeys();
		this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
		this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
		this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
		this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
		this.keyJ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
		this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
		this.keyC = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
		this.keyB = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);

		// ── Kamera ──
		this.cameras.main.setZoom(1.4);
		this.cameras.main.setBounds(0, 0, bgWidth, 520);
		this.cameras.main.startFollow(this.karakterim, true, 0.1, 0.1);

		// ── Firebase auth + eşleşme dinleyicisi ──
		this.setupChatUI();
		import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js").then((authModule) => {
			const { getAuth, onAuthStateChanged } = authModule;
			onAuthStateChanged(getAuth(), async (user) => {
				if (user) {
					this.myData = user;
					this.matchedUids = await getMutualMatches(user.uid);

					if (!window.matchesListenerInitialized && this.myData && this.myData.uid) {
						window.matchesListenerInitialized = true;
						window.startupTime = Date.now();
						const db = getDb();
						const crushesRef = collection(db, "crushes");
						const targetIdQuery = query(crushesRef, where("toId", "==", this.myData.uid));
						onSnapshot(targetIdQuery, (snapshot) => {
							snapshot.docChanges().forEach((change) => {
								if (change.type === "added") {
									const docData = change.doc.data();
									const senderUid = docData.fromId;
									const myCrushesQuery = query(crushesRef, where("fromId", "==", this.myData.uid), where("toId", "==", senderUid));
									getDocs(myCrushesQuery).then(mySnap => {
										if (!mySnap.empty) {
											this.matchedUids[senderUid] = true;
											if (Date.now() - window.startupTime < 2000) return;
											let senderName = "Rakip";
											for (const sessionId in this.otherPlayers) {
												if (this.otherPlayers[sessionId].uid === senderUid) {
													senderName = this.otherPlayers[sessionId].name;
													break;
												}
											}
											const chatContainer = document.getElementById("chat-ui-container");
											if (chatContainer && chatContainer.style.display !== "flex") {
												this.showInfoNotification("Biriyle eşleştin! Chat açılıyor... ✨");
												this.openChatUI(senderUid, senderName);
											}
										}
									});
								}
							});
						});
					}
				}
			});
		});

		// ── Crush butonu (başlangıçta gizli) ──
		this.crushButton = this.add.text(0, 0, "Crush <3", {
			fontFamily: "Arial",
			fontSize: "20px",
			color: "#ffffff",
			backgroundColor: "#e91e63",
			padding: { x: 14, y: 10 },
			align: "center",
		})
		.setOrigin(0.5, 0.5)
		.setScrollFactor(0)
		.setDepth(9999)
		.setVisible(false)
		.setInteractive({ useHandCursor: true });

		this.crushButton.on("pointerdown", async () => {
			if (this.crushTargetId && this.room) {
				const targetSessionId = this.crushTargetId;
				const targetSprite = this.otherPlayers && this.otherPlayers[targetSessionId];
				if (!targetSprite) return;
				const targetUid = targetSprite.uid;
				if (!targetUid) return;

				if (this.matchedUids && this.matchedUids[targetUid]) {
					this.openChatUI(targetUid, targetSprite.name || "Rakip");
					return;
				}

				const isMatched = await checkMatchAndCrush(this.myData.uid, targetUid);

				if (!this.crushSentTo[targetSessionId]) {
					this.room.send("crush", { targetSessionId: targetSessionId });
				}
				this.crushSentTo[targetSessionId] = true;

				if (isMatched) {
					this.matchedUids[targetUid] = true;
					this.showInfoNotification("EŞLEŞTİNİZ! Mesajlaşma paneli açılıyor... ✨");
					this.openChatUI(targetUid, targetSprite.name || "Rakip");
				} else {
					this.showInfoNotification("Crush gönderildi! Karşılık bekleniyor... <3");
					this.crushButton.setVisible(false);
					this.crushTargetId = null;
				}
			}
		});

		// ── Mobil butonlar ──
		this.createMobileControls();
	}

	// ── Mobil butonlar ────────────────────────────────────────────────
	createMobileControls() {
		this.input.addPointer(2);

		const cam = this.cameras.main;
		const z = cam.zoom;
		const cx = cam.width / 2;
		const cy = cam.height / 2;

		const screenLeft = cx - cx / z;
		const screenRight = cx + cx / z;
		const screenBottom = cy + cy / z;

		const paddingX = 40 / z;
		const paddingY = 40 / z;

		const createBtn = (x, y, key, onPress, onRelease) => {
			const btn = this.add.image(x, y, key)
				.setScrollFactor(0)
				.setDepth(9999)
				.setAlpha(0.7)
				.setOrigin(0.5)
				.setDisplaySize(70, 70)
				.setInteractive();

			btn.on('pointerdown', () => {
				btn.setAlpha(1);
				btn.setDisplaySize(60, 60);
				onPress();
			});
			const restoreBtn = () => {
				btn.setAlpha(0.7);
				btn.setDisplaySize(70, 70);
				onRelease();
			};
			btn.on('pointerup', restoreBtn);
			btn.on('pointerout', restoreBtn);
			return btn;
		};

		this.btnLeft = createBtn(screenLeft + paddingX * 2, screenBottom - paddingY * 2, 'sola', () => this.isLeftPressed = true, () => this.isLeftPressed = false);
		this.btnRight = createBtn(screenLeft + paddingX * 6, screenBottom - paddingY * 2, 'saga', () => this.isRightPressed = true, () => this.isRightPressed = false);
		this.btnDown = createBtn(screenRight - paddingX * 5, screenBottom - paddingY * 2, 'asagi', () => this.switchPlayerLane(1), () => {});
		this.btnUp = createBtn(screenRight - paddingX * 5, screenBottom - paddingY * 6, 'yukari', () => this.switchPlayerLane(-1), () => {});
		this.btnA = createBtn(screenRight - paddingX * 1.5, screenBottom - paddingY * 8.5, 'akrobatik', () => {
			if (this.karakterin.duruyor) {
				this.karakterin.zipla();
			} else {
				this.karakterin.hareket_cek();
			}
		}, () => {});
	}

	// ── Chat UI ──────────────────────────────────────────────────────
	setupChatUI() {
		const chatContainer = document.getElementById("chat-ui-container");
		const closeBtn = document.getElementById("close-chat-btn");
		const sendBtn = document.getElementById("chat-send-btn");
		const inputField = document.getElementById("chat-input");
		if (!chatContainer) return;

		closeBtn.onclick = () => {
			chatContainer.style.display = "none";
			window.activeChatTargetUid = null;
		};

		const handleSend = () => {
			const text = inputField.value.trim();
			if (text && window.activeChatTargetUid && this.myData && this.myData.uid) {
				sendSimsMessage(this.myData.uid, window.activeChatTargetUid, text);
				inputField.value = "";
			}
		};

		sendBtn.onclick = handleSend;
		inputField.onkeypress = (e) => { if (e.key === "Enter") handleSend(); };
		inputField.addEventListener('focus', () => { this.input.keyboard.enabled = false; });
		inputField.addEventListener('blur', () => { this.input.keyboard.enabled = true; });
	}

	openChatUI(targetUid, targetName) {
		const chatContainer = document.getElementById("chat-ui-container");
		const chatMessages = document.getElementById("chat-messages");
		if (chatContainer) {
			chatContainer.style.display = "flex";
			window.activeChatTargetUid = targetUid;
			chatContainer.querySelector("h3").innerText = targetName + " ile Sohbet";
			listenToMessages(this.myData.uid, targetUid, (messages) => {
				chatMessages.innerHTML = "";
				messages.forEach(msg => {
					const msgEl = document.createElement("div");
					msgEl.style.marginBottom = "8px";
					msgEl.style.padding = "5px";
					msgEl.style.borderRadius = "4px";
					if (msg.senderId === this.myData.uid) {
						msgEl.style.backgroundColor = "#e1ffc7";
						msgEl.style.color = "#000000";
						msgEl.style.wordBreak = "break-word";
						msgEl.style.textAlign = "right";
						msgEl.style.marginLeft = "auto";
						msgEl.style.maxWidth = "80%";
					} else {
						msgEl.style.backgroundColor = "#fff";
						msgEl.style.color = "#000000";
						msgEl.style.wordBreak = "break-word";
						msgEl.style.textAlign = "left";
						msgEl.style.marginRight = "auto";
						msgEl.style.maxWidth = "80%";
					}
					msgEl.innerText = msg.text;
					chatMessages.appendChild(msgEl);
				});
				setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 50);
			});
		}
	}

	// ── Bildirimler ──────────────────────────────────────────────────
	showCrushNotification(fromName) {
		const cam = this.cameras.main;
		const z = cam.zoom;
		const notif = this.add.text(cam.width / 2, cam.height / 2 + (-cam.height / 2 + 60) / z, `<3 ${fromName} sana crush attı!`, {
			fontFamily: "Arial", fontSize: "22px", color: "#ffffff",
			backgroundColor: "#e91e63", padding: { x: 16, y: 10 }, align: "center",
		}).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1001);
		this.tweens.add({ targets: notif, alpha: 0, y: notif.y - 15 / z, duration: 3000, ease: "Power2", onComplete: () => notif.destroy() });
	}

	showInfoNotification(message) {
		const cam = this.cameras.main;
		const z = cam.zoom;
		const notif = this.add.text(cam.width / 2, cam.height / 2 + (-cam.height / 2 + 100) / z, message, {
			fontFamily: "Arial", fontSize: "18px", color: "#ffffff",
			backgroundColor: "#4caf50", padding: { x: 12, y: 8 }, align: "center",
		}).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1001);
		this.tweens.add({ targets: notif, alpha: 0, y: notif.y - 15 / z, duration: 2500, ease: "Power2", onComplete: () => notif.destroy() });
	}

	// ── Diğer oyuncu oluştur ──────────────────────────────────────────
	createOtherPlayer(playerData) {
		const sprite = this.add.sprite(playerData.x, playerData.y, "kaykay_sur", 0);
		const initLane = playerData.lane !== undefined ? playerData.lane : 1;
		sprite.lane = initLane;
		const laneConf = this.LANE_CONFIG[initLane] || this.LANE_CONFIG[1];
		const w = KaykayliKiz.BASE_DISPLAY_W * laneConf.scaleMult;
		const h = KaykayliKiz.BASE_DISPLAY_H * laneConf.scaleMult;
		sprite.setDisplaySize(w, h);
		sprite.setOrigin(0.5, 0.5);
		sprite.setTint(0x4499ff);
		sprite.setDepth(laneConf.depth);
		sprite.on('animationstart', () => {
			const lc = this.LANE_CONFIG[sprite.lane] || this.LANE_CONFIG[1];
			sprite.setDisplaySize(
				KaykayliKiz.BASE_DISPLAY_W * lc.scaleMult,
				KaykayliKiz.BASE_DISPLAY_H * lc.scaleMult
			);
		});
		if (playerData.anim) sprite.play(playerData.anim, true);
		sprite.uid = playerData.uid;
		sprite.name = playerData.name;
		this.otherPlayers[playerData.sessionId] = sprite;
	}

	// ── Hareket fonksiyonları (KaykayliKiz'e delege) ────────────────
	dur() { this.karakterin.dur(); }
	derinNefesAl() { this.karakterin.derinNefesAl(); }
	hareket_cek() { this.karakterin.hareket_cek(); }
	git(yon) { this.karakterin.git(yon); }
	async cok() { this.karakterin.cok(); }
	async zipla() { this.karakterin.zipla(); }

	// ── Hat değiştirme (2.5D lane switch) ────────────────────────────
	switchPlayerLane(direction) {
		const newLane = this.karakterin.currentLane + direction;
		if (newLane < 0 || newLane >= this.LANE_CONFIG.length) return;
		if (this._isChangingLane) return;
		if (this.karakterin._isJumping) return;
		this._isChangingLane = true;
		this.karakterin.isChangingLane = true;

		const newGroundY = this.LANE_CONFIG[newLane].groundY;

		// Görsel güncelle (scale, depth)
		this.karakterin.setLaneVisuals(newLane);
		if (this.karakterin.duruyor) {
			this.karakterin.sprite.play("kaykay_sur", true);
		}

		// Duruyorsa X ekseninde de biraz ilerlesin (çapraz geçiş)
		const tweenProps = { y: newGroundY };
		if (this.karakterin.duruyor) {
			const xOffset = this.karakterim.flipX ? -80 : 80;
			tweenProps.x = this.karakterim.x + xOffset;
		}

		// Tween ile yumuşak geçiş
		this.tweens.add({
			targets: this.karakterim,
			...tweenProps,
			duration: 200,
			ease: 'Power1',
			onComplete: () => {
				this._isChangingLane = false;
				this.karakterin.isChangingLane = false;
			}
		});
	}

	// ── Update döngüsü ───────────────────────────────────────────────
	update(time, delta) {
		if (!this.karakterim || !this.karakterim.body) return;

		// ── Çiçekçi kız AI (base class metodu) ──
		this.cicekci_guncelle();

		// ── Dilenci AI: en yakın oyuncuya git (deterministik, tüm client'lar aynı sonucu görür) ──
		let closestX = this.karakterim.x;
		let closestY = this.karakterim.y;
		let closestDist = Phaser.Math.Distance.Between(this.sprite_1.x, this.sprite_1.y, closestX, closestY);
		for (const id in this.otherPlayers) {
			const other = this.otherPlayers[id];
			const d = Phaser.Math.Distance.Between(this.sprite_1.x, this.sprite_1.y, other.x, other.y);
			if (d < closestDist) {
				closestDist = d;
				closestX = other.x;
				closestY = other.y;
			}
		}
		this.dilenci_update(closestX, closestY);

		// Sunucuya pozisyon gönder
		if (this.room) {
			const now = Date.now();
			if (now - this.lastSent > 50) {
				let anim = this.karakterin.getCurrentAnim();
				this.room.send("move", {
					x: this.karakterim.x,
					y: this.karakterim.y,
					anim: anim,
					flipX: this.karakterim.flipX,
					lane: this.karakterin.currentLane
				});
				this.lastSent = now;
			}
		}

		// E / ↑ → üst hat, D / ↓ → alt hat
		if (Phaser.Input.Keyboard.JustDown(this.keyE) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
			this.switchPlayerLane(-1);
		}
		if (Phaser.Input.Keyboard.JustDown(this.keyD) || Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
			this.switchPlayerLane(1);
		}

		// J → zıpla
		if (Phaser.Input.Keyboard.JustDown(this.keyJ)) {
			this.karakterin.zipla();
		}
		// A → hareket çek
		if (Phaser.Input.Keyboard.JustDown(this.keyA)) {
			this.karakterin.hareket_cek();
		}
		// C → çök
		if (Phaser.Input.Keyboard.JustDown(this.keyC)) {
			this.karakterin.cok();
		}
		// B → derin nefes
		if (Phaser.Input.Keyboard.JustDown(this.keyB)) {
			this.karakterin.derinNefesAl();
		}

		// S / ← → sola, F / → → sağa  (+ mobil butonlar)
		const leftActive = this.isLeftPressed || this.keyS.isDown;
		const rightActive = this.isRightPressed || this.keyF.isDown;
		this.karakterin.handleInput(this.cursors, this.isUpPressed, this.isDownPressed, leftActive, rightActive);

		// Boyutu her frame sabitle (animasyon frame farkı koruması)
		this.karakterin.enforceSize();

		// ── Crush butonu: 200px yakınlıktaki oyuncuya göster ──
		if (!this.crushSentTo) this.crushSentTo = {};
		const crushRadius = 200;
		let closestCrushId = null;
		let closestCrushDist = Infinity;
		for (const id in this.otherPlayers) {
			const other = this.otherPlayers[id];
			// Sadece aynı hattaki oyuncularla crush
			const otherLane = other.lane !== undefined ? other.lane : 1;
			if (otherLane !== this.karakterin.currentLane) continue;
			const dx = Math.abs(this.karakterim.x - other.x);
			const dy = Math.abs(this.karakterim.y - other.y);
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < crushRadius && dy < 100 && dist < closestCrushDist) {
				closestCrushDist = dist;
				closestCrushId = id;
			}
		}
		if (closestCrushId) {
			this.crushTargetId = closestCrushId;
			const targetSprite = this.otherPlayers[this.crushTargetId];
			const targetUid = targetSprite ? targetSprite.uid : null;
			if (this.matchedUids && targetUid && this.matchedUids[targetUid]) {
				this.crushButton.setText("Sohbet");
				this.crushButton.setStyle({ backgroundColor: "#4CAF50" });
			} else {
				this.crushButton.setText("Crush <3");
				this.crushButton.setStyle({ backgroundColor: "#e91e63" });
			}
			const cam = this.cameras.main;
			const z = cam.zoom;
			const btnX = cam.width / 2;
			const btnY = cam.height / 2 + (cam.height / 2 - 60) / z;
			this.crushButton.setPosition(btnX, btnY);
			this.crushButton.setVisible(true);
		} else {
			this.crushButton.setVisible(false);
			this.crushTargetId = null;
		}

		// ── Manuel çarpışma: diğer oyuncularla (sadece aynı hat) ──
		const hitRadius = 60;
		const nowColliding = {}; // Bu frame'de kimlerle çarpışıldığını tut

		for (const id in this.otherPlayers) {
			const other = this.otherPlayers[id];
			const otherLane2 = other.lane !== undefined ? other.lane : 1;
			if (otherLane2 !== this.karakterin.currentLane) continue;

			const dx = this.karakterim.x - other.x;
			const dy = this.karakterim.y - other.y;
			const targetUid = other.uid;
			const isMatched = this.matchedUids && targetUid && this.matchedUids[targetUid];

			// Çarpışma var mı?
			if (Math.abs(dy) < 60 && Math.abs(dx) < hitRadius) {
				nowColliding[id] = true;

				// Eğer bu oyuncuyla zaten çarpışma halinde değilsek, yeni çarpışmayı başlat
				if (!this.collidingWith[id]) {
					this.collidingWith[id] = true;

					// Bounce back: çarpışma yönünün tersine geri sek
					const bounceDir = dx > 0 ? 1 : -1;
					const bounceX = this.karakterim.x + bounceDir * 120;
					this.karakterim.setVelocityX(0);
					this.karakterim.setAccelerationX(0);

					this.tweens.add({
						targets: this.karakterim,
						x: bounceX,
						duration: 250,
						ease: 'Back.easeOut',
					});

					// Sadece eşleşmişse ekstra olarak sevgi göster
					if (isMatched && !this.sevgiGosteriyor) {
						this.sevgiGosteriyor = true;
						console.log("Sevgi gösteriliyor!");
						this.time.delayedCall(2000, () => { this.sevgiGosteriyor = false; });
					}
				}
			}
		}

		// Çarpışmadan çıkanları temizle
		for (const id in this.collidingWith) {
			if (!nowColliding[id]) {
				delete this.collidingWith[id];
			}
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
