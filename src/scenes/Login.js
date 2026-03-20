// Giriş ekranı — Google OAuth veya Misafir girişi, sonra Waiting'e geçer

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from "../firebase-config.js";

let firebaseApp;
let firebaseAuth;

try {
    firebaseApp = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
} catch (e) {
    console.error("Firebase init error:", e);
}

export default class Login extends Phaser.Scene {
    constructor() {
        super("Login");
    }

    create() {
        const { width, height } = this.scale;

        // Arka plan
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        // Başlık
        this.add.text(width / 2, height / 2 - 200, "🛹 Kaykay Parkı 🛹", {
            fontSize: "64px",
            color: "#ffffff",
            fontStyle: "bold",
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 - 100, "Oyuna katılmak için giriş yap", {
            fontSize: "28px",
            color: "#aaaaff",
        }).setOrigin(0.5);

        // Google ile giriş butonu
        const googleBtn = this.add.rectangle(width / 2, height / 2 + 20, 400, 70, 0x4285f4, 1)
            .setInteractive({ useHandCursor: true });
        this.add.text(width / 2, height / 2 + 20, "Google ile Giriş", {
            fontSize: "30px",
            color: "#ffffff",
            fontStyle: "bold",
        }).setOrigin(0.5);

        googleBtn.on("pointerover", () => googleBtn.setFillStyle(0x357ae8));
        googleBtn.on("pointerout", () => googleBtn.setFillStyle(0x4285f4));
        googleBtn.on("pointerdown", () => this.handleGoogleLogin());

        // Misafir giriş butonu
        const guestBtn = this.add.rectangle(width / 2, height / 2 + 120, 400, 70, 0x555555, 1)
            .setInteractive({ useHandCursor: true });
        this.add.text(width / 2, height / 2 + 120, "Misafir Olarak Gir", {
            fontSize: "30px",
            color: "#ffffff",
            fontStyle: "bold",
        }).setOrigin(0.5);

        guestBtn.on("pointerover", () => guestBtn.setFillStyle(0x777777));
        guestBtn.on("pointerout", () => guestBtn.setFillStyle(0x555555));
        guestBtn.on("pointerdown", () => this.handleGuestLogin());

        // Durum metni
        this.statusText = this.add.text(width / 2, height / 2 + 230, "", {
            fontSize: "24px",
            color: "#ff6666",
        }).setOrigin(0.5);
    }

    async handleGoogleLogin() {
        if (!firebaseAuth) {
            this.statusText.setText("Firebase başlatılamadı!");
            return;
        }

        this.statusText.setColor("#aaaaff");
        this.statusText.setText("Google ile giriş yapılıyor...");

        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(firebaseAuth, provider);
            const idToken = await result.user.getIdToken();

            this.statusText.setText("Giriş başarılı! Bekleme odasına yönlendiriliyorsunuz...");
            this.scene.start("Waiting", { token: idToken });
        } catch (err) {
            console.error("Google login error:", err);
            this.statusText.setColor("#ff6666");
            this.statusText.setText("Giriş hatası: " + err.message);
        }
    }

    handleGuestLogin() {
        this.statusText.setColor("#aaaaff");
        this.statusText.setText("Misafir olarak bağlanılıyor...");
        this.scene.start("Waiting", { token: null });
    }
}
