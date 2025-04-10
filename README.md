# Sync-Sonic App

A React Native application built with Expo for managing and configuring multiple Bluetooth speakers. The app allows users to create speaker configurations, pair devices, and control speaker settings like volume and latency.

## Features

- **Device Selection & Pairing**: Scan for and pair with Bluetooth speakers
- **Speaker Configuration**: Create and manage multiple speaker configurations
- **Volume Control**: Adjust individual speaker volumes
- **Latency Control**: Fine-tune audio latency for each speaker
- **Connection Management**: Connect/disconnect speaker configurations
- **Dark/Light Theme Support**: Automatic theme switching based on system preferences

## Architecture

### Core Components

- **DeviceSelectionScreen**: Handles device scanning and pairing
- **SpeakerConfigScreen**: Manages speaker configurations and settings
- **TopBar**: Common navigation component
- **PairingFunctions**: Utility functions for device pairing
- **SpeakerFunctions**: Utility functions for speaker control
- **ConfigurationFunctions**: Utility functions for configuration management

### Key Technologies

- **Expo Router**: File-based routing and navigation
- **Tamagui**: UI component library with theme support
- **React Native**: Core framework
- **TypeScript**: Type safety and better developer experience
- **SQLite**: Local database for storing configurations

## Project Structure

```
├── app/                    # Main application screens
│   ├── DeviceSelectionScreen.tsx
│   ├── SpeakerConfigScreen.tsx
│   └── ...
├── components/            # Reusable UI components
│   └── TopBar.tsx
├── utils/                # Utility functions
│   ├── PairingFunctions.ts
│   ├── SpeakerFunctions.ts
│   └── ConfigurationFunctions.ts
├── hooks/                # Custom React hooks
├── assets/               # Static assets
└── database.ts          # Database operations
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npx expo start
   ```

3. Run on your preferred platform:
   - iOS Simulator: Press `i`
   - Android Emulator: Press `a`
   - Physical Device: Scan QR code with Expo Go app

## Usage Guide

### Creating a New Configuration

1. Navigate to the device selection screen
2. Select up to 3 speakers to pair
3. Click "Pair selected devices"
4. Enter a name for your configuration
5. The app will create the configuration and navigate to the settings screen

### Managing Speaker Settings

1. Select a configuration from the home screen
2. Adjust volume and latency sliders for each speaker
3. Use the Connect/Disconnect button to manage the connection
4. Changes are automatically saved

### Deleting a Configuration

1. Open the configuration you want to delete
2. Click the Delete button
3. Confirm the deletion

## API Integration

The app communicates with a Raspberry Pi backend for:
- Device scanning
- Speaker pairing
- Connection management
- Audio control

API endpoints:
- `/start-scan`: Initiates device scanning
- `/stop-scan`: Stops device scanning
- `/device-queue`: Returns discovered devices
- `/paired-devices`: Returns previously paired devices
- `/pair`: Pairs selected devices

## Database Schema

The app uses SQLite to store:
- Speaker configurations
- Speaker settings (volume, latency)
- Connection status
- Paired device information


