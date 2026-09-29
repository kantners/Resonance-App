import { CapacitorConfig } from "@capacitor/cli";

// Resonance is its own app: own appId, own server, nothing shared with KEWT.
// No server.url: the native shell loads the bundled web build from webDir.
const config: CapacitorConfig = {
  appId: "com.blueemberwellness.resonance",
  appName: "Resonance",
  webDir: "dist/public",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#F3F4F1",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#F3F4F1",
      overlaysWebView: false,
    },
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: "#F3F4F1",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#F3F4F1",
  },
};

export default config;
