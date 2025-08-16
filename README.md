# Chefflow - Restaurant Management App

A comprehensive React Native application built with Expo for restaurant management, featuring authentication, recipe management, order tracking, temperature logging, cleaning checklists, and more.

## 📱 Features

- **Authentication System** - Secure login with Firebase Auth
- **Dashboard Management** - Central hub for restaurant operations
- **Recipe Management** - Add, view, and manage recipes with detailed screens
- **Order Management** - Track orders and prep lists
- **Temperature Logging** - Monitor fridge and delivery temperatures
- **Cleaning Checklists** - Manage cleaning tasks and schedules
- **Handover System** - Shift handover management
- **Invoice Management** - Handle invoices and downloads
- **Task Management** - Organize and track daily tasks
- **Restaurant Selection** - Multi-restaurant support

## 🛠 Prerequisites

Before setting up the project, ensure you have:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Expo CLI** (will be installed during setup)
- **iOS Simulator** (macOS only) or **Android Studio** for emulators
- **Firebase Project** - [Create one here](https://console.firebase.google.com/)

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd Chefflow
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- React Native and Expo SDK
- Firebase SDK
- Navigation libraries
- UI components and fonts

### 3. Install Expo CLI Globally

```bash
npm install -g @expo/cli
```

### 4. Firebase Configuration


#### Step 4.1: Update Firebase Configuration

1. Open `firebase.js` in the project root
2. Replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key-here",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-actual-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-actual-sender-id",
  appId: "your-actual-app-id"
};
```

**⚠️ Important:** Replace ALL placeholder values with your actual Firebase configuration values.

### 5. Update Package Versions (Recommended)

The project may show warnings about package versions. Update them for best compatibility:

```bash
npm install @react-native-async-storage/async-storage@2.1.2
npm install expo@53.0.20
npm install expo-font@~13.3.2
npm install react-native@0.79.5
npm install react-native-gesture-handler@~2.24.0
npm install react-native-safe-area-context@5.4.0
npm install react-native-svg@15.11.2
```

## 🎮 Running the Application

### Start Development Server

```bash
npx expo start
```

This will start the Metro bundler and show a QR code with several options.

### Platform-Specific Launch Commands

#### iOS Simulator (macOS only)
```bash
npx expo start --ios
```

#### Android Emulator
```bash
npx expo start --android
```

#### Web Browser
```bash
npx expo start --web
```

#### Mobile Device (Recommended for Testing)
1. Install **Expo Go** app from App Store (iOS) or Play Store (Android)
2. Scan the QR code shown in terminal
3. App will load directly on your device

### Clear Cache (if issues occur)
```bash
npx expo start --clear
```

## 📱 Testing on Device

### Using Expo Go (Easiest)
1. Download "Expo Go" from your device's app store
2. Scan the QR code from the terminal
3. The app will load and run on your device

### Using iOS Simulator
- Requires macOS and Xcode
- Run: `npx expo start --ios`

### Using Android Emulator
- Requires Android Studio setup
- Run: `npx expo start --android`

## 🏗 Project Structure

```
Chefflow/
├── App.js                 # Main app component
├── firebase.js           # Firebase configuration
├── app.json             # Expo configuration
├── package.json         # Dependencies and scripts
├── assets/              # Images, icons, and static assets
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── ui/         # Basic UI components (Button, Input, Card)
│   │   └── icons/      # Icon components
│   ├── constants/       # App constants (Colors, Typography, Spacing)
│   ├── contexts/        # React contexts
│   ├── hooks/          # Custom React hooks
│   ├── navigation/     # Navigation configuration
│   ├── screens/        # App screens organized by feature
│   │   ├── auth/       # Authentication screens
│   │   ├── dashboard/  # Dashboard screens
│   │   ├── recipes/    # Recipe management
│   │   ├── orders/     # Order management
│   │   ├── cleaning/   # Cleaning checklists
│   │   ├── handover/   # Shift handover
│   │   └── ...         # Other feature screens
│   └── utils/          # Utility functions and helpers
└── node_modules/       # Dependencies (auto-generated)
```

## 🔧 Development Scripts

```bash
# Start development server
npm start
# or
npx expo start

# Start for specific platform
npx expo start --ios
npx expo start --android
npx expo start --web

# Clear cache and restart
npx expo start --clear

# Run with tunnel (for physical device testing)
npx expo start --tunnel
```

## 🚨 Troubleshooting

### Common Issues & Solutions

#### "Unable to resolve Firebase" Error
- Ensure `firebase.js` exists in project root
- Verify all Firebase config values are correctly set
- Check that Firebase services are enabled in console

#### "Expo command not found"
```bash
npm install -g @expo/cli
```

#### "Port already in use"
- Kill existing processes: `pkill -f "expo start"`
- Or use different port when prompted

#### App won't load on device
- Ensure device and computer are on same Wi-Fi network
- Try using tunnel mode: `npx expo start --tunnel`
- Clear Expo cache: `npx expo start --clear`

#### Package version warnings
- Update packages as shown in Step 5 above
- Or run: `npx expo install --fix`

### iOS Specific Issues
- Ensure Xcode is installed for iOS Simulator
- Check iOS Simulator is properly configured

### Android Specific Issues  
- Ensure Android Studio and emulator are properly set up
- Enable Developer options and USB debugging on physical device

## 🔒 Firebase Security Rules

For production, update your Firestore security rules:

```javascript
// Firestore Security Rules (Firebase Console → Firestore → Rules)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🌐 Environment Setup

### For Production Deployment
1. Create production Firebase project
2. Update `firebase.js` with production config
3. Build production version: `npx expo build`

### Environment Variables (Optional)
Create `.env` file for sensitive data:
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
# ... other config values
```

## 📞 Support

If you encounter issues:
1. Check this README for common solutions
2. Clear cache: `npx expo start --clear`  
3. Restart development server
4. Verify Firebase configuration
5. Check network connectivity for device testing

## 🔄 Updates

To update Expo SDK and dependencies:
```bash
npx expo install --fix
```

---

**Happy Cooking! 👨‍🍳👩‍🍳**

Built with ❤️ using React Native, Expo, and Firebase.
