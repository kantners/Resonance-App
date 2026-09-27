import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.blueemberwellness.kewt",
  appName: "KEWT",
  webDir: "dist/public",
  server: {
    // Points to Railway production — app loads live data over the internet
    url: "https://kewt-app-production.up.railway.app",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#faf9f6",
      iosSpinnerStyle: "small",
      spinnerColor: "#065f46",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#faf9f6",
      overlaysWebView: false,
    },
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: "#faf9f6",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#faf9f6",
  },
};

export default config;
