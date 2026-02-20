const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package exports for packages like axios
config.resolver.unstable_enablePackageExports = true;

// Add mp3 and other audio formats to asset extensions
config.resolver.assetExts.push('mp3', 'wav', 'ogg', 'm4a');

module.exports = config;
