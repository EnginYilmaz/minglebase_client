import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from "../firebase-config.js";

function ensureFirebase() {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return getAuth(app);
}

function getPlatform() {
    if (window.Capacitor) return window.Capacitor.getPlatform();
    // Detect iOS Safari when not running in Capacitor
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        return 'ios';
    }
    return 'web';
}

function getIsNative() {
    return window.Capacitor && window.Capacitor.getPlatform() !== 'web';
}

export default class Login extends Phaser.Scene {
    constructor() {
        super("Login");
    }

    create() {
        // Always initialize Firebase Web SDK (needed for Firestore on all platforms)
        ensureFirebase();

        const { width, height } = this.scale;
        const platform = getPlatform();

        // Arka plan
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        // Başlıklar
        this.add.text(width / 2, height / 2 - 200, "🛹 Kaykay Parkı 🛹", {
            fontSize: "64px", color: "#ffffff", fontStyle: "bold",
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 - 100, "Oyuna katılmak için giriş yap", {
            fontSize: "28px", color: "#aaaaff",
        }).setOrigin(0.5);

        // --- 1. GOOGLE BUTONU (iOS'ta gizle) ---
        if (platform !== 'ios') {
            const googleBtn = this.add.rectangle(width / 2, height / 2 + 20, 400, 70, 0x4285f4, 1).setInteractive({ useHandCursor: true });
            this.add.text(width / 2, height / 2 + 20, "Google ile Giriş", { fontSize: "30px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
            googleBtn.on("pointerdown", () => this.handleGoogleLogin());
        }

        // --- 2. APPLE BUTONU (Sadece iOS'ta göster) ---
        if (platform === 'ios') {
            const appleBtn = this.add.rectangle(width / 2, height / 2 + 20, 400, 70, 0x000000, 1).setInteractive({ useHandCursor: true });
            this.add.text(width / 2, height / 2 + 20, " Apple ile Sürdür", { fontSize: "30px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
            
            appleBtn.on("pointerover", () => appleBtn.setFillStyle(0x333333));
            appleBtn.on("pointerout", () => appleBtn.setFillStyle(0x000000));
            appleBtn.on("pointerdown", () => this.handleAppleLogin());
        }

        // --- 3. MİSAFİR BUTONU ---
        const guestBtnY = height / 2 + 110;
        const guestBtn = this.add.rectangle(width / 2, guestBtnY, 400, 70, 0x555555, 1).setInteractive({ useHandCursor: true });
        this.add.text(width / 2, guestBtnY, "Misafir Olarak Gir", { fontSize: "30px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
        guestBtn.on("pointerdown", () => this.handleGuestLogin());

        // Durum metni (+280)
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const statusFontSize = isMobile ? "32px" : "24px";
        this.statusText = this.add.text(width / 2, height / 2 + 280, "", { fontSize: statusFontSize, color: "#ff6666" }).setOrigin(0.5);
//      this.statusText = this.add.text(width / 2, height / 2 + 280, "", { fontSize: "24px", color: "#ff6666" }).setOrigin(0.5);
    }
async handleGoogleLogin() {
        this.statusText.setText("Google ile giriş yapılıyor...");
        try {
            if (getIsNative()) {
                const FirebaseAuthentication = Capacitor.Plugins.FirebaseAuthentication;
                const result = await FirebaseAuthentication.signInWithGoogle();

                // Sync native auth → Web Firebase SDK (Firestore için gerekli)
                const auth = ensureFirebase();
                const idToken = result.credential?.idToken;
                if (idToken) {
                    const credential = GoogleAuthProvider.credential(idToken);
                    await signInWithCredential(auth, credential);
                }

                const tokenResult = await FirebaseAuthentication.getIdToken();
                this.scene.start("Waiting", { token: tokenResult.token });
            } else {
                const auth = ensureFirebase();
                const provider = new GoogleAuthProvider();
                const result = await signInWithPopup(auth, provider);
                const idToken = await result.user.getIdToken();
                this.scene.start("Waiting", { token: idToken });
            }
        } catch (err) {
            this.statusText.setText("Giriş hatası: " + err.message);
        }
    }

    async handleAppleLogin() {
        this.statusText.setText("Apple ile bağlanılıyor...");
        try {
            const FirebaseAuthentication = Capacitor.Plugins.FirebaseAuthentication;
            const result = await FirebaseAuthentication.signInWithApple();
            const user = result?.user;
            const displayName = user?.displayName || user?.email || null;
            const { token } = await FirebaseAuthentication.getIdToken();
            this.scene.start("Waiting", { token, displayName });
        } catch (err) {
            this.statusText.setText("Apple hatası: " + err.message);
        }
    }

    handleGuestLogin() {
        this.scene.start("Waiting", { token: null });
    }
}