import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>FUGEN <Text style={styles.accentText}>SmartPay</Text></Text>
            </View>

            <View style={styles.buttonGrid}>
                {/* LARGE SCAN BUTTON */}
                <TouchableOpacity
                    style={styles.scanButton}
                    onPress={() => navigation.navigate('Scan')}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="qrcode-scan" size={80} color="white" />
                    <Text style={styles.scanText}>SCAN</Text>
                </TouchableOpacity>

                <View style={styles.bottomRow}>
                    {/* SYSTEM DATA BUTTON */}
                    <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => navigation.navigate('SystemData')}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="database-sync" size={40} color="white" />
                        <Text style={styles.buttonLabel}>System Data</Text>
                    </TouchableOpacity>

                    {/* USERS BUTTON */}
                    <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => navigation.navigate('Users')}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="account-group" size={40} color="white" />
                        <Text style={styles.buttonLabel}>Users</Text>
                    </TouchableOpacity>

                    {/* REPORTS BUTTON */}
                    <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => navigation.navigate('Reports')}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="file-chart" size={40} color="white" />
                        <Text style={styles.buttonLabel}>Reports</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Canteen POS Terminal v1.1</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        height: 100,
        backgroundColor: '#1A237E',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 1,
    },
    accentText: {
        color: '#FFD700',
    },
    buttonGrid: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    scanButton: {
        backgroundColor: '#1A237E',
        height: width * 0.6,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    scanText: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
        marginTop: 10,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        height: 130,
    },
    smallButton: {
        backgroundColor: '#283593',
        width: '31%',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
        elevation: 4,
    },
    buttonLabel: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 8,
        textAlign: 'center',
    },
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    footerText: {
        color: '#666',
        fontSize: 12,
    }
});
