# React Native Speaker Control App

This repository contains the **React Native mobile application** for managing Bluetooth-connected speakers. The app allows users to **discover, configure, and control speakers**, including volume adjustments and speaker grouping.

## 🚀 Features
- **Discover and Connect** to Bluetooth speakers
- **Create Speaker Configurations** (grouping multiple speakers)
- **Control Volume** and playback settings

---

## 📂 Project Structure
```
/react-native-speaker-control
├── android/                # Android-specific files
├── ios/                    # iOS-specific files
├── src/                    # Main application code
│   ├── components/         # Reusable UI components
│   ├── screens/            # App screens
│   ├── services/           # API and Bluetooth service logic
│   ├── store/              # State management (Redux or Context API)
│   ├── navigation/         # React Navigation setup
│   └── assets/             # Images, icons, etc.
├── App.js                  # Main application entry point
├── package.json            # Dependencies and scripts
├── README.md               # Documentation
└── .gitignore              # Git ignore file
```

---

## 🛠️ Setup Instructions

### **1️⃣ Install Dependencies**
Ensure you have **Node.js** installed (recommended: Node 18+). Then, install the dependencies:
```sh
npm install
# OR
yarn install
```

### **2️⃣ Run the App Locally**
For development, start the app using **Expo** or the React Native CLI.

#### **Using Expo:**
```sh
npx expo start
```

#### **Using React Native CLI (Android/iOS):**
```sh
npx react-native start
```

**For Android:**
```sh
npx react-native run-android
```

**For iOS (Mac Required):**
```sh
npx react-native run-ios
```

---

## 📡 Architecture Diagram
Below is an **architecture diagram** showing how the mobile app communicates with Bluetooth speakers.

```plaintext
+------------------------+
|  React Native App     |
|  (Mobile Interface)   |
+------------------------+
         ⬇️  
+------------------------+
| Bluetooth Service     |
| (Handles Device Discovery, Pairing, Control) |
+------------------------+
         ⬇️  
+------------------------+
|  Speaker Hardware     |
| (Receives Commands)   |
+------------------------+
```

---

## 📌 Future Improvements
- **Multi-Speaker Synchronization** for grouped playback
- **Cloud-based Speaker Profiles** for saving user configurations
- **Integration with Streaming Services** (Spotify, Apple Music, etc.)



