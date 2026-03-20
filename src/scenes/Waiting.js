// Bekleme odası sahnesi — Colyseus'a bağlanır, 2. oyuncu gelince Level'e geçer

import { Client } from "https://esm.sh/@colyseus/sdk@0.17.17";

const SERVER_URL = "ws://localhost:2567";
//const SERVER_URL = "https://nl-ams-86abf15c.colyseus.cloud";
export default class Waiting extends Phaser.Scene {
    constructor() {
        super("Waiting");
        this.room = null;
        this.myData = null;
        this.startReceived = false;
        this.authToken = null;
        this.transitioned = false;
    }

    init(data) {
        // Login sahnesinden gelen token
        this.authToken = data && data.token !== undefined ? data.token : null;
        this.transitioned = false;
    }

    create() {
        const { width, height } = this.scale;

        // Arka plan
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        this.add.text(width / 2, height / 2 - 100, "🛹 Kaykay Parkı 🛹", {
            fontSize: "56px",
            color: "#ffffff",
            fontStyle: "bold",
        }).setOrigin(0.5);

        this.waitText = this.add.text(width / 2, height / 2 + 20, "Rakip bekleniyor.", {
            fontSize: "30px",
            color: "#aaaaff",
        }).setOrigin(0.5);

        // Nokta animasyonu
        let dots = 0;
        this.dotTimer = this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                dots = (dots + 1) % 4;
                this.waitText.setText("Rakip bekleniyor" + ".".repeat(dots));
            },
        });

        this.connectToServer();
    }

    tryStartLevel() {
        // Only transition when we have BOTH myData and the start signal
        // transitioned flag prevents Waiting's stale handlers from restarting Level
        if (this.myData && this.startReceived && !this.transitioned) {
            this.transitioned = true;
            this.scene.start("Level", { room: this.room, me: this.myData });
        }
    }

    async connectToServer() {
        try {
            const client = new Client(SERVER_URL);
            const options = this.authToken ? { token: this.authToken } : {};
            this.room = await client.joinOrCreate("my_room", options);

            // Sunucu kendi spawn verimizi bildirir (onJoin'de gönderilir)
            this.room.onMessage("currentPlayers", (data) => {
                if (data.you) {
                    this.myData = data.you;
                    this.tryStartLevel();
                }
            });

            // Sunucu 2. oyuncu katılınca "start" yayınlar
            this.room.onMessage("start", () => {
                this.startReceived = true;
                if (this.waitText && this.scene.isActive()) {
                    this.waitText.setText("Rakip bulundu! Başlıyor...");
                }
                this.tryStartLevel();
            });

        } catch (err) {
            console.error("Sunucuya bağlanılamadı:", err);
            if (this.waitText) {
                this.waitText.setText("Sunucuya bağlanılamadı!\n" + err.message);
            }
        }
    }
}
