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

  init(data) {
    this.room = (data && data.room) ? data.room : null;
    this.myData = (data && data.me) ? data.me : null;
  }
  create() {
    this.editorCreate();

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
      this.room.send("ready");

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
    }
    // ─────────────────────────────────────────────────────────────────
  }

  // Rakip kaykaylı sprite'ını oluştur (mavi tint ile ayırt edilir)
  createOtherPlayer(playerData) {
    // Sade sprite kullanıyoruz — fizik yok.
    // Sunucu pozisyonu her 50ms'de setPosition ile geldiği için fizik motoru
    // collision'ı zaten çözemiyor (teleport ediyor). Manuel yaklaşım daha sağlıklı.
    const sprite = this.add.sprite(playerData.x, playerData.y, "kaykayli_kiz", 0);
    sprite.setScale(0.4);
    sprite.setOrigin(0.5, 0.5);
    sprite.setTint(0x4499ff); // Mavi → rakip oyuncu
    if (playerData.anim) sprite.play(playerData.anim, true);
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

  /* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
