import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = () => {
        if (!username || !password) {
            Alert.alert('Error', 'Please enter both username and password.');
            return;
        }

        setLoading(true);

        // Simulate network delay
        setTimeout(() => {
            if (username === 'grpfive' && password === '170206') {
                navigation.replace('Home');
            } else {
                Alert.alert('Login Failed', 'Invalid username or password.');
            }
            setLoading(false);
        }, 800);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>FUGEN <Text style={styles.accentText}>SmartPay</Text></Text>
                <Text style={styles.subtitle}>Admin Dashboard</Text>
            </View>

            <View style={styles.card}>
                <View style={styles.inputContainer}>
                    <MaterialCommunityIcons name="account-outline" size={24} color="#666" style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Username"
                        placeholderTextColor="#999"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <MaterialCommunityIcons name="lock-outline" size={24} color="#666" style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#999"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={24} color="#666" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.loginButton}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.loginButtonText}>Login to Dashboard</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>FUGEN SmartPay © 2026 | Secure Admin Access</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A237E', // Deep Blue
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    header: {
        marginBottom: 40,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 1,
    },
    accentText: {
        color: '#FFD700', // Yellow
    },
    subtitle: {
        fontSize: 14,
        color: '#E0E0E0',
        marginTop: 5,
        letterSpacing: 0.5,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#D1D1D1', // Simulating the grey card from screenshot
        borderRadius: 15,
        padding: 25,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        borderWidth: 1,
        borderColor: '#999',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 5,
        marginBottom: 15,
        paddingHorizontal: 10,
        height: 50,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    loginButton: {
        backgroundColor: '#BDBDBD', // Button color from screenshot (Greyish)
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#666',
        elevation: 2,
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
    },
    footerText: {
        color: '#B0BEC5',
        fontSize: 10,
        letterSpacing: 0.5,
    }
});
