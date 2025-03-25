# ![Logo](https://github.com/BrooksWimer/Sync-Sonic-App/blob/f6a550cdf0a6c3ca73bfe71b05a6d3c69bdbe043/assets/images/horizontalPinkLogo.png?raw=true) Sync-Sonic App ![Logo](https://github.com/BrooksWimer/Sync-Sonic-App/blob/f6a550cdf0a6c3ca73bfe71b05a6d3c69bdbe043/assets/images/horizontalPinkLogo.png?raw=true)

## Overview

The Sync-Sonic App provides an intuitive interface for:
- Creating and managing speaker configurations
- Discovering and pairing Bluetooth speakers
- Controlling volume and latency for each speaker
- Managing multiple audio zones
- Connecting/disconnecting speaker configurations

## Features

- **Speaker Discovery**: Scan and find available Bluetooth speakers
- **Configuration Management**: Create, edit, and delete speaker configurations
- **Audio Control**: 
  - Individual volume control for each speaker
  - Latency adjustment for perfect synchronization
  - Global configuration connection management
- **Multi-Controller Support**: Utilize multiple Bluetooth adapters for expanded speaker support
- **Real-time Status**: Monitor connection status and speaker health

## Prerequisites

- Node.js (LTS version recommended)
- npm or yarn
- Expo CLI
- iOS/Android development environment (for native builds)
- [SyncSonicPi](link-to-pi-repo) backend running on a Raspberry Pi

## Getting Started

1. **Clone the Repository**
```bash
git clone https://github.com/BrooksWimer/Sync-Sonic-App
cd Sync-Sonic-App
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure the App**
- Update the Pi's IP address in `app/SpeakerConfigScreen.tsx`:
```typescript
const PI_API_URL = 'http://your.pi.ip.address:3000';
```

4. **Start the Development Server**
```bash
npx expo start
```

5. **Run the App**
- Press `a` for Android
- Press `i` for iOS simulator
- Scan QR code with Expo Go app
- Press `d` for development build

## Project Structure
app/
├── SpeakerConfigScreen.tsx # Speaker configuration management
├── DeviceSelectionScreen.tsx # Bluetooth device discovery and selection
├── database.ts # Local SQLite database operations
├── home.tsx # Main app screen
└── settings/ # Configuration settings screens
├── config.tsx # Configuration editor
├── latency.tsx # Latency adjustment
└── speakerSettings.tsx # Speaker-specific settings

## Integration with SyncSonicPi

The app communicates with the Raspberry Pi backend through a REST API:

- **Device Discovery**
  ```typescript
  GET http://<pi-ip>:3000/scan
  ```

- **Speaker Configuration**
  ```typescript
  POST http://<pi-ip>:3000/connect
  {
    "configID": "string",
    "configName": "string",
    "speakers": {"mac": "name"},
    "settings": {"mac": {"volume": number, "latency": number}}
  }
  ```

- **Audio Control**
  ```typescript
  POST http://<pi-ip>:3000/volume
  POST http://<pi-ip>:3000/latency
  ```

## Development

### Building for Production

1. **iOS**
```bash
eas build --platform ios
```

2. **Android**
```bash
eas build --platform android
```

### Testing

```bash
npm test
```

## Troubleshooting

1. **Connection Issues**
   - Ensure the Pi is running and accessible
   - Verify the correct IP address in configuration
   - Check that the Pi's API server is running

2. **Speaker Discovery Problems**
   - Ensure speakers are in pairing mode
   - Verify Bluetooth adapters are properly connected to Pi
   - Check Pi's Bluetooth service status

3. **Database Issues**
   - Clear app data and restart
   - Check SQLite database integrity
