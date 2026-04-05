// You can write more code here
import { getDb, sendCrush, listenToMessages, sendSimsMessage } from "../firebase-chat.js";
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
	_crushButtonMode = null;
	_isSendingCrush = false;
	sevgiGosteriyor = false;

	// ── Tutarlı UID çözümleme (guest dahil) ──
	_getMyUid() {
		return this._firebaseUid
			|| (this.myData && (this.myData.uid || this.myData.odaUid))
			|| (this.room && this.room.sessionId)
			|| null;
	}

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

		// Room uid'den eşleşme sistemini başlat (tüm platformlarda çalışır)
		const roomUid = this._getMyUid();
		console.log("[BADGE] roomUid:", roomUid, "myData keys:", this.myData ? Object.keys(this.myData) : "null");
		if (roomUid) {
			this.initMatchSystem(roomUid);
		} else {
			console.warn("[BADGE] roomUid boş! myData:", JSON.stringify(this.myData));
		}

		// Web platformunda Firebase Auth ile daha doğru uid al
		// Capacitor (native) ortamda gapi.iframes CORS hatası veriyor, sadece web'de çalıştır
		const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
		if (!isNative) {
			import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js").then((authModule) => {
				const { getAuth, onAuthStateChanged } = authModule;
				onAuthStateChanged(getAuth(), async (user) => {
					console.log("[BADGE] onAuthStateChanged fired, user:", user ? user.uid : "null", "roomUid:", roomUid);
					if (user) {
						this._firebaseUid = user.uid;
						if (user.uid !== roomUid) {
							console.log("[BADGE] Firebase uid farklı, yeniden initMatchSystem:", user.uid);
							this.initMatchSystem(user.uid);
						}
					}
				});
			});
		} else {
			console.log("[BADGE] Native platform, Capacitor FirebaseAuthentication kullanılıyor");
			(async () => {
				try {
					const FirebaseAuthentication = window.Capacitor?.Plugins?.FirebaseAuthentication;
					if (FirebaseAuthentication) {
						const result = await FirebaseAuthentication.getCurrentUser();
						const nativeUser = result?.user;
						if (nativeUser && nativeUser.uid) {
							console.log("[BADGE] Native Firebase uid alındı:", nativeUser.uid);
							this._firebaseUid = nativeUser.uid;
							if (nativeUser.uid !== roomUid) {
								console.log("[BADGE] Native uid farklı, yeniden initMatchSystem:", nativeUser.uid);
								this.initMatchSystem(nativeUser.uid);
							}
						} else {
							console.warn("[BADGE] Native FirebaseAuthentication: kullanıcı yok (guest?)");
						}
					}
				} catch (e) {
					console.warn("[BADGE] Native FirebaseAuthentication hatası:", e);
				}
			})();
		}

		// ── Crush butonu (başlangıçta gizli) ──
		this._recreateCrushButton('crush'); // İlk oluşturma
		this.crushButton.setVisible(false); // Başlangıçta gizle

		// ── Okunmamış mesaj badge (kırmızı daire + sayı) ──
		this.badgeCircle = this.add.circle(0, 0, 12, 0xff2222)
			.setScrollFactor(0)
			.setDepth(10001)
			.setVisible(false);

		this.badgeText = this.add.text(0, 0, "", {
			fontFamily: "Arial",
			fontSize: "13px",
			color: "#ffffff",
			fontStyle: "bold",
		})
			.setOrigin(0.5, 0.5)
			.setScrollFactor(0)
			.setDepth(10002)
			.setVisible(false);

		// ── Mobil butonlar ──
		this.createMobileControls();
	}

	// ── Crush butonu yeniden oluştur (iOS render sorunları için) ──
	_recreateCrushButton(mode) {
		// Önceki butonu yok et (varsa)
		if (this.crushButton) {
			this.crushButton.destroy();
			this.crushButton = null;
		}

		const cam = this.cameras.main;
		const z = cam.zoom;
		const btnX = cam.width / 2;
		const btnY = cam.height / 2 + (cam.height / 2 - 120) / z;

		let text, style;
		if (mode === 'sohbet') {
			text = "Sohbet";
			style = {
				fontFamily: "Arial", fontSize: "28px", color: "#ffffff",
				backgroundColor: "#4CAF50", padding: { x: 22, y: 14 }, align: "center"
			};
		} else { // 'crush'
			text = "Crush <3";
			style = {
				fontFamily: "Arial", fontSize: "28px", color: "#ffffff",
				backgroundColor: "#e91e63", padding: { x: 22, y: 14 }, align: "center"
			};
		}

		this.crushButton = this.add.text(btnX, btnY, text, style)
			.setOrigin(0.5, 0.5)
			.setScrollFactor(0)
			.setDepth(9999)
			.setVisible(true)
			.setInteractive({ useHandCursor: true });

		// Event listener'ı YENİ butona tekrar bağla
		this.crushButton.on("pointerdown", this._handleCrushButtonPress, this);

		this._crushButtonMode = mode;
	}

	// ── Crush butonu tıklama yönetimi ───────────────────────────────
	async _handleCrushButtonPress() {
		if (!this.crushTargetId || !this.room) return;

		const targetSessionId = this.crushTargetId;
		const targetSprite = this.otherPlayers?.[targetSessionId];
		if (!targetSprite) {
			console.warn("[CRUSH] Hedef oyuncu sprite'ı bulunamadı.");
			return;
		}

		const targetUid = targetSprite.uid;
		const myUid = this._getMyUid();

		if (!targetUid || !myUid) {
			this.showInfoNotification("Kimlik bilgileri eksik, işlem yapılamadı.");
			return;
		}

		// Zaten eşleşilmişse doğrudan sohbet aç
		if (this.matchedUids && this.matchedUids[targetUid]) {
			this.openChatUI(targetUid, targetSprite.name || "Rakip");
			return;
		}

		// Crush gönderme işlemini başlat
		try {
			const result = await sendCrush(myUid, targetUid);
			const isMatched = result?.status === "mutual";

			// Sunucuya crush etkileşimi olduğunu bildir (animasyon vb. için)
			const myName = this.myData?.name || this.myData?.displayName || this.karakterim?.name || null;
			this.room.send("crush", { targetSessionId: targetSessionId, fromName: myName });

			if (isMatched) {
				this.matchedUids[targetUid] = true;
				this.showInfoNotification("EŞLEŞTİNİZ! Mesajlaşma paneli açılıyor... ✨");
				// Gecikmeli yap ki "Eşleştiniz" bildirimi görünsün
				this.time.delayedCall(1000, () => {
					this._recreateCrushButton('sohbet');
					this.openChatUI(targetUid, targetSprite.name || "Rakip");
				});
			} else {
				this.showInfoNotification("Crush gönderildi! Karşılık bekleniyor... <3");
			}
		} catch (err) {
			console.error("[CRUSH] HATA:", err);
			this.showInfoNotification("Crush gönderilemedi: " + (err.message || "Bilinmeyen bir hata oluştu."));
		}
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

	// ── Eşleşme sistemi başlat (tüm platformlarda çalışır) ─────────
	async initMatchSystem(uid) {
		if (this._matchSystemUid === uid) return;
		this._matchSystemUid = uid;
		console.log("[BADGE] initMatchSystem başladı, uid:", uid);

		try {
			this.matchedUids = await getMutualMatches(uid);
		} catch (err) {
			console.error("getMutualMatches hatası:", err);
			this.matchedUids = {};
		}

		// ── Bağımsız gelen mesaj dinleyicisi (badge için) ──
		const db = getDb();
		const msgRef = collection(db, "messages");
		const incomingQuery = query(msgRef, where("receiverId", "==", uid));
		this._lastIncomingCount = null;
		this._currentIncomingTotal = 0;
		console.log("[BADGE] Firestore listener kuruluyor, receiverId:", uid);
		onSnapshot(incomingQuery, (snapshot) => {
			const totalIncoming = snapshot.size;
			this._currentIncomingTotal = totalIncoming;
			console.log("[BADGE] snapshot geldi, totalIncoming:", totalIncoming, "lastCount:", this._lastIncomingCount);
			// İlk yüklenmede mevcut mesaj sayısını kaydet (bunlar zaten okunmuş)
			if (this._lastIncomingCount === null) {
				this._lastIncomingCount = totalIncoming;
				console.log("[BADGE] İlk snapshot, baseline:", totalIncoming);
				return;
			}
			const chatContainer = document.getElementById("chat-ui-container");
			const chatOpen = chatContainer && chatContainer.style.display === "flex";
			if (chatOpen) {
				// Chat açık, okunmuş say
				this._lastIncomingCount = totalIncoming;
				window.unreadMessageCount = 0;
				console.log("[BADGE] Chat açık, badge sıfırlandı");
			} else {
				const newCount = totalIncoming - this._lastIncomingCount;
				console.log("[BADGE] Chat kapalı, newCount:", newCount);
				if (newCount > 0) {
					// Chat kapalı — badge göster
					window.unreadMessageCount = newCount;
					this.updateBadge(newCount);
					console.log("[BADGE] Badge güncellendi:", newCount);
				}
			}
		}, (error) => {
			console.error("[BADGE] Incoming message listener hatası:", error);
		});

		if (!window.matchesListenerInitialized) {
			window.matchesListenerInitialized = true;
			window.startupTime = Date.now();
			const crushesRef = collection(db, "crushes");
			const targetIdQuery = query(crushesRef, where("toId", "==", uid));
			onSnapshot(targetIdQuery, (snapshot) => {
				snapshot.docChanges().forEach((change) => {
					if (change.type === "added") {
						const docData = change.doc.data();
						const senderUid = docData.fromId;
						const myCrushesQuery = query(crushesRef, where("fromId", "==", uid), where("toId", "==", senderUid));
						getDocs(myCrushesQuery).then(mySnap => {
							if (!mySnap.empty) {
								this.matchedUids[senderUid] = true;
								this._crushButtonMode = null; // force re-evaluate in update()
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
			const myUid = this._getMyUid();
			if (text && window.activeChatTargetUid && myUid) {
				sendSimsMessage(myUid, window.activeChatTargetUid, text);
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
		const myUid = this._getMyUid();
		if (chatContainer && myUid) {
			// Sohbet açılınca badge'i sıfırla
			window.unreadMessageCount = 0;
			// Gelen mesaj sayısını güncelle — artık hepsi okunmuş
			if (this._currentIncomingTotal != null) {
				this._lastIncomingCount = this._currentIncomingTotal;
			}
			if (this.badgeCircle) this.badgeCircle.setVisible(false);
			if (this.badgeText) this.badgeText.setVisible(false);

			chatContainer.style.display = "flex";
			window.activeChatTargetUid = targetUid;
			chatContainer.querySelector("h3").innerText = targetName + " ile Sohbet";

			listenToMessages(myUid, targetUid, (messages) => {
				chatMessages.innerHTML = "";
				messages.forEach(msg => {
					const msgEl = document.createElement("div");
					msgEl.style.marginBottom = "8px";
					msgEl.style.padding = "5px";
					msgEl.style.borderRadius = "4px";
					if (msg.senderId === myUid) {
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

	// ── Badge güncelle ─────────────────────────────────────────────
	updateBadge(count) {
		if (!this.badgeCircle || !this.badgeText) return;
		if (count <= 0) {
			this.badgeCircle.setVisible(false);
			this.badgeText.setVisible(false);
			return;
		}
		// Crush butonu görünürse onun sağ üstüne, değilse ekranın sağ alt köşesine sabit
		const cam = this.cameras.main;
		const z = cam.zoom;
		let bx, by;
		if (this.crushButton && this.crushButton.visible) {
			bx = this.crushButton.x + 50;
			by = this.crushButton.y - 22;
		} else {
			// Sabit sağ alt köşe (kamera koordinatı değil, canvas koordinatı)
			bx = cam.width  / 2 + (cam.width  / 2 - 30) / z;
			by = cam.height / 2 + (cam.height / 2 - 30) / z;
		}
		this.badgeCircle.setPosition(bx, by).setVisible(true);
		this.badgeText.setText(count > 9 ? "9+" : String(count)).setPosition(bx, by).setVisible(true);
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
		const crushRadius = 200;
		let closestCrushId = null;
		let closestCrushDist = Infinity;

		for (const id in this.otherPlayers) {
			const other = this.otherPlayers[id];
			const otherLane = other.lane !== undefined ? other.lane : 1;
			if (otherLane !== this.karakterin.currentLane) continue;

			const dist = Phaser.Math.Distance.Between(this.karakterim.x, this.karakterim.y, other.x, other.y);
			if (dist < crushRadius && dist < closestCrushDist) {
				closestCrushDist = dist;
				closestCrushId = id;
			}
		}

		this.crushTargetId = closestCrushId; // Hedefi her zaman güncelle

		if (this.crushTargetId) {
			// Eşleşme durumuna göre buton modunu belirle
			const targetSprite = this.otherPlayers[this.crushTargetId];
			const targetUid = targetSprite && targetSprite.uid;
			const isTargetMatched = targetUid && this.matchedUids && this.matchedUids[targetUid];
			const desiredMode = isTargetMatched ? 'sohbet' : 'crush';
			if (this._crushButtonMode !== desiredMode || !this.crushButton) {
				this._recreateCrushButton(desiredMode);
			}
			// Her durumda butonu görünür yap
			this.crushButton.setVisible(true);

			// Badge konumunu güncelle
			if (window.unreadMessageCount > 0) {
				this.updateBadge(window.unreadMessageCount);
			}
		} else {
			// Yakında kimse yoksa butonu gizle
			if (this.crushButton && this.crushButton.visible) {
				this.crushButton.setVisible(false);
			}
			this._crushButtonMode = null; // Modu sıfırla

			// Uzaktayken okunmamış mesaj varsa badge'i sabit konumda göster
			if (window.unreadMessageCount > 0) {
				this.updateBadge(window.unreadMessageCount);
			} else {
				if (this.badgeCircle) this.badgeCircle.setVisible(false);
				if (this.badgeText) this.badgeText.setVisible(false);
			}
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
