import { getDb, checkMatchAndCrush, listenToMessages, sendSimsMessage } from "../firebase-chat.js";
import { getMutualMatches } from "../firebase-matches.js";
import { collection, query, where, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Level extends Phaser.Scene {
  constructor() {
    super("Level");

    /* START-USER-CTR-CODE */
    // Write your code here.
    /* END-USER-CTR-CODE */
  }

  /** @returns {void} */
  editorCreate() {
    this.events.emit("scene-awake");
  }

  update(time, delta) {}

  /* START-USER-CODE */

  cursors;
  karakterim;
  bg;
  yon = false;
  duruyor = true;
  adimlayabilir = true;
  cokebilir = true;

  // Çok oyunculu
  room = null;
  myData = null;
  otherPlayers = {};
  lastSent = 0;
  carpisiyor = false; // Çarpışma animasyonu spam'ını önler
  hareketCekiyor = false; // hareket_cek animasyonu bitene kadar kaykay_sur'u bloklar

  // Crush sistemi
  crushButton = null;
  crushTargetId = null; // Şu an crush butonu gösterilen oyuncunun sessionId'si
  crushSentTo = {};     // Zaten crush gönderdiğimiz oyuncular (spam engeli)

  init(data) {
    this.room = (data && data.room) ? data.room : null;
    this.myData = (data && data.me) ? data.me : null;
  }
  create() {
        // Eksik animasyon: player-idle (kaykay_sur ile aynı frameler)
        this.anims.create({
          key: "player-idle",
          frames: this.anims.generateFrameNumbers("kaykayli_kiz", {
            start: 0,
            end: 15,
          }),
          frameRate: 10,
          repeat: -1,
        });
    this.editorCreate();

    this.setupChatUI();
    
    import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js").then((authModule) => {
      const { getAuth, onAuthStateChanged } = authModule;
      onAuthStateChanged(getAuth(), async (user) => {
        if (user) {
          this.myData = user;
          
          if (!this.matchedUids) this.matchedUids = {};
          this.matchedUids = await getMutualMatches(user.uid);
          
          // Initialize global matches listener so both parties know when they are matched.
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
                           
                           // Check if I also crushed them (is mutual)
                           const myCrushesQuery = query(
                               crushesRef,
                               where("fromId", "==", this.myData.uid),
                               where("toId", "==", senderUid)
                           );
                           getDocs(myCrushesQuery).then(mySnap => {
                               if (!mySnap.empty) {
                                   this.matchedUids[senderUid] = true;
                                   
                                   // Eğer eski bir veri geliyorsa otomatik pencere açma (2 saniye tolerans)
                                   if (Date.now() - window.startupTime < 2000) return;
                                   
                                   console.log("Yeni Karşılıklı eşleşme algılandı!", senderUid);
                                   
                                   // Mevcut oyunculardan ismini bulalım
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


    // Kaykaylı kız animasyonunu oluştur
    this.anims.create({
      key: "kaykay_sur",
      frames: this.anims.generateFrameNumbers("kaykayli_kiz", {
        start: 0,
        end: 15,
      }),
      frameRate: 10,
      repeat: 0,
    });

    // Eğilme (çömelme) animasyonunu oluştur
    this.anims.create({
      key: "kaykay_cok",
      frames: this.anims.generateFrameNumbers("kaykayli_kiz", {
        start: 25,
        end:28,
      }),
      frameRate: 7,
      repeat: 0,
    });

        // Eğilme (çömelme) animasyonunu oluştur
    this.anims.create({
      key: "kaykay_dogrul",
      frames: this.anims.generateFrameNumbers("kaykayli_kiz", {
        start: 28,
        end: 31,
      }),
      frameRate: 10,
      repeat: 0,
    });

    this.anims.create({
      key: "kaykay_ziplama",
      frames: this.anims.generateFrameNumbers("kaykayli_kiz", {
        start: 32,
        end: 47,
      }),
      frameRate: 10,
      repeat: 0,
    });
    this.anims.create({
      key: "kaykaydan_dusme",
      frames: this.anims.generateFrameNumbers("kaykayli_kiz", {
        start: 48,
        end: 63,
      }),
      frameRate: 6,
      repeat: 0,
    });

    this.anims.create({
      key: "kaykay_hareket_cekme",
      frames: this.anims.generateFrameNumbers("kaykayli_kiz", {
        start: 16,
        end: 31,
      }),
      frameRate: 10,
      repeat: 0,
    });

    this.anims.create({
      key: "kaykay_stabilize",
      frames: this.anims.generateFrameNumbers("kaykayli_kiz", {
        start: 0,
        end: 15,
      }),
      frameRate: 10,
      repeat: 0,
    });

    // Arkaplanı ekle (Orijinal boyutunda kalsın, kamerayı zoom ile ayarlayacağız)
    this.bg = this.add.image(0, 0, "istiklalcaddesi_1").setOrigin(0, 0);
    this.children.sendToBack(this.bg); // En altta kalsın

    // Görselin genişliğini alıp kamera sınırlarını ona göre ayarlıyoruz
    const bgWidth = this.bg.width;
    const bgHeight = this.bg.height;

    // Spawn pozisyonu: sunucudan geldiyse onu kullan, yoksa ortaya koy
    const spawnX = (this.myData && this.myData.x) ? this.myData.x : bgWidth / 2;
    this.karakterim = this.physics.add.sprite(
      spawnX,
      80,
      "kaykayli_kiz",
      0,
    );

    // Origin'i (0.5, 0.5) yani merkeze geri alalım (Bunu silmek varsayılanı kullanmaktır)
    // Böylece kamera kızı takip ederken karakter tam ekranın ortasında kalır.
    // --------------------------------------------------

    // Animasyonu oynatmaya başlatıyoruz

    // Yeni görsel oldukça büyük, ekrana sığması için 0.4 oranına küçülttüm (istenirse değişebilir)
    this.karakterim.setScale(0.4);
    // setOrigin'i setScale'den SONRA çağırıyoruz ki displayOrigin doğru hesaplansın
    this.karakterim.setOrigin(0.5, 0.5);

    if (this.karakterim.body) {
      // Fizik gövdesini karakterin görsel boyutuna sığacak şekilde küçült
      // Frame 156x327, karakter görseli frame'in ortasında ~80x280 px civarı
      this.karakterim.body.setSize(80, 280);
      this.karakterim.body.setOffset(38, 40);

      this.karakterim.body.setGravityY(600);
      this.karakterim.setBounce(0.3);
      this.karakterim.setCollideWorldBounds(true);

      // İvme ve sürtünme (kayma) ayarları
      this.karakterim.setMaxVelocity(400, 800); // Maksimum hız limitini 400'e çıkardık ki hızlanabilsin
      this.karakterim.setDragX(300); // Sürtünme: 500 çok fazlaydı ve hızlanmayı yeniyordu, 300'e düşürdük
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);

    // 1. GÖRÜNTÜ ALANINI DOLDUR: Oyun ekranı 1920x1080.
    // O yüzden 489 yüksekliğindeki arkaplanı ve kızı dev ekrana yaklaştırmak için
    // zoom'u 2.2 değerine çıkartıyoruz (1.5 çok karınca gibi bırakır).
    this.cameras.main.setZoom(2.2);

    // 2. KAMERA SINIRLARI: Kameranın arkaplan resminin dışındaki siyah (boş) alanlara çıkmasını engellemek için sınırları tekrar açıyoruz.
    this.cameras.main.setBounds(0, 0, bgWidth, bgHeight);

    this.physics.world.setBounds(0, 0, bgWidth, 395);

    // 3. KAMERA KIZI TAKİP ETSİN: Tam merkezde.
    this.cameras.main.startFollow(this.karakterim, true, 0.1, 0.1);

    // ── Çok oyunculu mesaj dinleyicileri ──────────────────────────────
    if (this.room) {
      // Sunucuya hazır olduğumuzu bildir → mevcut oyuncuları geri gönderir
      // Move send ready below listeners

      // Mevcut oyuncuların listesi (ready cevabı)
      this.room.onMessage("currentPlayers", (data) => {
        data.players.forEach(p => this.createOtherPlayer(p));
      });

      // Yeni oyuncu katıldı
      this.room.onMessage("playerJoined", (playerData) => {
        this.createOtherPlayer(playerData);
      });

      // Oyuncu ayrıldı
      this.room.onMessage("playerLeft", ({ sessionId }) => {
        if (this.otherPlayers[sessionId]) {
          this.otherPlayers[sessionId].destroy();
          delete this.otherPlayers[sessionId];
        }
      });

      // Diğer oyuncu hareket etti
      this.room.onMessage("playerMoved", (data) => {
        const other = this.otherPlayers[data.sessionId];
        if (other) {
          other.setPosition(data.x, data.y);
          other.flipX = data.flipX;
          if (data.anim && other.anims) other.play(data.anim, true);
        }
      });

      // ── Crush sistemi mesajları ──
      this.room.onMessage("crushReceived", (data) => {
        this.showCrushNotification(data.fromName || "Biri");
      });

      this.room.onMessage("crushSent", (data) => {
        this.showInfoNotification("Crush gönderildi! 💘");
      });
    }

      this.room.send("ready"); // Hazır olduğumuzu geç bildiriyoruz ki hata almayalım
    // ─────────────────────────────────────────────────────────────────

    // ── Crush butonu oluştur (başlangıçta gizli) ────────────────────
    this.crushButton = this.add.text(0, 0, "💘 Crush", {
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
        
        // Zaten Eşleşilmiş miydik? Sohbeti DİREKT aç
        if (this.matchedUids && this.matchedUids[targetUid]) {
            this.openChatUI(targetUid, targetSprite.name || "Rakip");
            return;
        }

        // Değilsek crush veritabanını kontrol et
        const isMatched = await checkMatchAndCrush(this.myData.uid, targetUid);
        
        if (!this.crushSentTo || !this.crushSentTo[targetSessionId]) {
            this.room.send("crush", { targetSessionId: targetSessionId });
        }
        
        if (!this.crushSentTo) this.crushSentTo = {};
        this.crushSentTo[targetSessionId] = true;
        
        if (isMatched) {
            if (!this.matchedUids) this.matchedUids = {};
            this.matchedUids[targetUid] = true;
            this.showInfoNotification("EŞLEŞTİNİZ! Mesajlaşma paneli açılıyor... ✨");
            this.openChatUI(targetUid, targetSprite.name || "Rakip");
        } else {
            this.showInfoNotification("Crush gönderildi! Karşılık bekleniyor... 💘");
            this.crushButton.setVisible(false);
            this.crushTargetId = null;
        }
      }
    });
    // ────────────────────────────────────────────────────────────────
  }

  // Rakip kaykaylı sprite'ını oluştur (mavi tint ile ayırt edilir)
  
  showInfoNotification(message) {
    const container = document.getElementById("info-notification-container");
    const textEl = document.getElementById("info-notification-text");
    if (!container || !textEl) return;

    textEl.innerText = message;
    container.style.display = "block";

    setTimeout(() => {
        container.style.display = "none";
    }, 3000);
  }

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
    inputField.onkeypress = (e) => {
      if (e.key === "Enter") handleSend();
    };

    inputField.addEventListener('focus', () => {
        this.input.keyboard.enabled = false;
    });
    inputField.addEventListener('blur', () => {
        this.input.keyboard.enabled = true;
    });
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
                   msgEl.innerText = msg.text;
               } else {
                   msgEl.style.backgroundColor = "#fff";
                   msgEl.style.color = "#000000";
                   msgEl.style.wordBreak = "break-word";
                   msgEl.style.textAlign = "left";
                   msgEl.style.marginRight = "auto";
                   msgEl.style.maxWidth = "80%";
                   msgEl.innerText = msg.text;
               }
               chatMessages.appendChild(msgEl);
           });
           setTimeout(() => {
               chatMessages.scrollTop = chatMessages.scrollHeight;
           }, 50);
       });
    }
  }


  createOtherPlayer(playerData) {
    // Sade sprite kullanıyoruz — fizik yok.
    // Sunucu pozisyonu her 50ms'de setPosition ile geldiği için fizik motoru
    // collision'ı zaten çözemiyor (teleport ediyor). Manuel yaklaşım daha sağlıklı.
    const sprite = this.add.sprite(playerData.x, playerData.y, "kaykayli_kiz", 0);
    sprite.setScale(0.4);
    sprite.setOrigin(0.5, 0.5);
    sprite.setTint(0x4499ff); // Mavi → rakip oyuncu
    if (playerData.anim) sprite.play(playerData.anim, true);
            sprite.uid = playerData.uid;
      sprite.name = playerData.name;
this.otherPlayers[playerData.sessionId] = sprite;
  }
  dur() {
    this.karakterim.stop();
    this.karakterim.setAccelerationX(0); // Motor gücünü kes
    this.duruyor = true;
  }
  hareket_cek() {
    if (this.duruyor) return; // Duruyorsa hareket çekemez
    if (this.hareketCekiyor) return;
    this.hareketCekiyor = true;
    this.karakterim.setVelocityY(-350);
    this.karakterim.play("kaykay_hareket_cekme", true).chain("kaykay_stabilize");
    this.time.delayedCall(1800, () => {
      this.hareketCekiyor = false;
    });
  }
  git(yon) {
    if (!this.adimlayabilir) {
      return; // Eğer kilitleme süresindeyse (timeout bitmediyse) itki yapma
    }

    this.adimlayabilir = false; // Kilitlendi

    // 400 milisaniye sonra kilidi tekrar açar (önceki 600 çok uzundu, hızı kaybediyordun)
    this.time.delayedCall(400, () => {
      this.adimlayabilir = true;
    });

    this.duruyor = false;
    let mevcutHiz = this.karakterim.body.velocity.x;

    // Her tuşa basıldığında 250 kuvvetinde itki verir
    yon
      ? this.karakterim.setVelocityX(mevcutHiz - 250)
      : this.karakterim.setVelocityX(mevcutHiz + 250);

    this.karakterim.flipX = yon; // Sağa veya sola döner
    if (this.karakterim.body.blocked.down && !this.hareketCekiyor) {
      this.karakterim.play("kaykay_sur", true); // Yerdeyken animasyon
    }
  }
  async cok() {
    this.karakterim.play("kaykay_cok", true);
  }
  async zipla() {
    this.karakterim.setVelocityY(-300);

    // Phaser'da animasyonlar Promise (then) desteklemez.
    // Birbiri ardına animasyon oynatmak için chain() kullanabilirsiniz.
    this.karakterim
      .play("kaykay_cok", true)
      .chain("kaykay_ziplama")
      .chain("kaykay_stabilize");
  }
  update(time, delta) {
    // 3. Hareket Kodları
    if (!this.karakterim) {
      return;
    }

    // Kendi konumumuzu sunucuya bildir (50ms'de bir)
    if (this.room) {
      const now = Date.now();
      if (now - this.lastSent > 50) {
        this.lastSent = now;
        this.room.send("move", {
          x: Math.round(this.karakterim.x),
          y: Math.round(this.karakterim.y),
          flipX: this.karakterim.flipX,
          anim: this.karakterim.anims.currentAnim
            ? this.karakterim.anims.currentAnim.key
            : "kaykay_sur",
        });
      }
    }
    // Arkaplan artık sabit değil, kamera ile akıyor
    if (Phaser.Input.Keyboard.JustDown(this.keyA)) {
      this.hareket_cek();
    }
    if (this.cursors.up.isDown && this.karakterim.body.blocked.down) {
      this.zipla(); // Zıplama kuvveti
    }

    if (this.cursors.down.isDown && this.karakterim.body.blocked.down) {
      this.cok();
    }

    if (this.cursors.left.isDown) {
      this.yon = true;
      this.git(this.yon);
      //this.karakterim.setAccelerationX(0); // Sadece anlık itki (setVelocity) uyguluyoruz
    } else if (this.cursors.right.isDown) {
      this.yon = false;
      this.git(this.yon);
      //this.karakterim.setAccelerationX(0);
    } else {
      // Tuşlara basılmadığında motoru kapat, Phaser'ın setDragX sürtünmesi yavaşlatacak.
      this.karakterim.setAccelerationX(0);

      // Hızı tamamen bitmeye yaklaştığında durdur ve animasyonu kes.
      if (Math.abs(this.karakterim.body.velocity.x) < 5) {
        this.dur();
      }
    }

    // ── Crush butonu: 200px yakınlıktaki oyuncuya göster ────────────
    if (!this.crushSentTo) this.crushSentTo = {};
    const crushRadius = 200;
    let closestCrushId = null;
    let closestCrushDist = Infinity;
    for (const id in this.otherPlayers) {
        // 
      // if (this.crushSentTo[id]) continue;
      const other = this.otherPlayers[id];
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
        
        // Zaten eşleşilmiş birisi ise:
        if (this.matchedUids && targetUid && this.matchedUids[targetUid]) {
            this.crushButton.setText("💬 Sohbet");
            this.crushButton.setStyle({ backgroundColor: "#4CAF50" });
        } else {
            this.crushButton.setText("💘 Crush");
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

    // ── Manuel çarpışma: Diğer oyuncularla yan yana gelince it ──────
    // Sprite 344px geniş, 0.4 scale ile ~138px. Ama karakterin kendisi görselin ortasında daha dar.
    // 60px → iki karakter fiilen temas ettiğinde tetiklenir.
    const hitRadius = 60;
    for (const id in this.otherPlayers) {
      const other = this.otherPlayers[id];
      const dx = this.karakterim.x - other.x;
      const dy = this.karakterim.y - other.y;
      // Sadece aynı yükseklikte yan yana geldiklerinde (üst üste zıplama hali hariç)
      if (Math.abs(dy) < 60 && Math.abs(dx) < hitRadius) {
        const yon = dx >= 0 ? 1 : -1;
        const overlap = hitRadius - Math.abs(dx);
        this.karakterim.x += yon * overlap; // Anlık konum düzeltmesi
        this.karakterim.body.setVelocityX(
          this.karakterim.body.velocity.x + yon * 200
        );
        // Çarpışma animasyonu — aynı anda birden fazla tetiklenmesin
        if (!this.carpisiyor) {
          this.carpisiyor = true;
          const hiz = Math.abs(this.karakterim.body.velocity.x);
          if (hiz >= 150) {
            // Yüksek hız → şiddetli düşme
            this.karakterim.play("kaykaydan_dusme", true).chain("kaykay_stabilize");
            this.time.delayedCall(1200, () => { this.carpisiyor = false; });
          } else {
            // Düşük hız → hafif sarsılma
            this.karakterim.play("kaykay_cok", true).chain("kaykay_dogrul");
            this.time.delayedCall(600, () => { this.carpisiyor = false; });
          }
        }
      }
    }
    // ────────────────────────────────────────────────────────────────
  }

  // Crush bildirimi göster (biri sana crush attığında)
  showCrushNotification(fromName) {
    const cam = this.cameras.main;
    const z = cam.zoom;
    const notif = this.add.text(cam.width / 2, cam.height / 2 + (-cam.height / 2 + 60) / z, `💘 ${fromName} sana crush attı!`, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      backgroundColor: "#e91e63",
      padding: { x: 16, y: 10 },
      align: "center",
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(1001);

    this.tweens.add({
      targets: notif,
      alpha: 0,
      y: notif.y - 15 / z,
      duration: 3000,
      ease: "Power2",
      onComplete: () => notif.destroy(),
    });
  }

  // Bilgi bildirimi göster
  showInfoNotification(message) {
    const cam = this.cameras.main;
    const z = cam.zoom;
    const notif = this.add.text(cam.width / 2, cam.height / 2 + (-cam.height / 2 + 100) / z, message, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      backgroundColor: "#4caf50",
      padding: { x: 12, y: 8 },
      align: "center",
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(1001);

    this.tweens.add({
      targets: notif,
      alpha: 0,
      y: notif.y - 15 / z,
      duration: 2500,
      ease: "Power2",
      onComplete: () => notif.destroy(),
    });
  }

  /* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
