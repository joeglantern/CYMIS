import type { ExpoConfig } from 'expo/config';

// The API address comes from the environment so one build can point at a test
// or a live server. Phones on the yard network use the server's LAN or VPN name.
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const config: ExpoConfig = {
  name: 'Cymis',
  slug: 'cymis',
  scheme: 'cymis',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#ffffff',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.cymis.audit',
    infoPlist: {
      NSFaceIDUsageDescription: 'Cymis uses Face ID so you can unlock the app without typing your password.',
    },
  },
  android: {
    package: 'app.cymis.audit',
    adaptiveIcon: { foregroundImage: './assets/images/adaptive-foreground.png', backgroundColor: '#ffffff' },
    predictiveBackGestureEnabled: true,
  },
  web: {
    output: 'single',
    bundler: 'metro',
    favicon: './assets/images/favicon.png',
    name: 'Cymis',
    shortName: 'Cymis',
    themeColor: '#ffffff',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sqlite',
    'expo-font',
    'expo-video',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-mark.png',
        imageWidth: 96,
        backgroundColor: '#ffffff',
        dark: { image: './assets/images/splash-mark.png', backgroundColor: '#111110' },
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Cymis uses the camera to read container numbers and photograph each box.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Cymis saves where each container was scanned so the yard map stays accurate.',
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Cymis uses Face ID so you can unlock the app without typing your password.' },
    ],
    ['expo-audio', { microphonePermission: false }],
  ],
  experiments: { typedRoutes: true },
  owner: 'afosi',
  extra: {
    apiUrl,
    eas: { projectId: 'd52a58c9-b248-472c-ac64-13145417e669' },
  },
};

export default config;
