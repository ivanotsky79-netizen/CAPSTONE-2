import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator, TouchableOpacity, ScrollView, Modal, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { transactionService, studentService, socket } from '../services/api';

export default function ScanScreen({ navigation }) {
    const isFocused = useIsFocused();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [stats, setStats] = useState({
        totalSales: 0,
        totalCash: 0,
        totalCredit: 0,
        creditCount: 0,
        creditList: [],
        cashList: []
    });
    const [showCredits, setShowCredits] = useState(false);
    const [showCash, setShowCash] = useState(false);
    const [showIdentifyModal, setShowIdentifyModal] = useState(false);
    const [identifiedId, setIdentifiedId] = useState('');
    const [loading, setLoading] = useState(false);

    // Fetch daily stats
    const fetchStats = async () => {
        try {
            const response = await transactionService.getDailyStats();
            if (response.data.status === 'success') {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('[STATS ERROR]', error);
        }
    };

    // Real-time updates via Socket.io
    useEffect(() => {
        socket.on('balanceUpdate', (data) => {
            console.log('[SOCKET] Balance updated, refreshing stats:', data);
            fetchStats();
        });
        return () => socket.off('balanceUpdate');
    }, []);

    // Automatically reset scanned state and fetch stats when the screen comes back into focus
    useEffect(() => {
        if (isFocused) {
            setScanned(false);
            fetchStats();
        }
    }, [isFocused]);

    // Stable settings object to prevent native re-renders
    const scannerSettings = useMemo(() => ({
        barcodeTypes: ["qr"],
    }), []);

    const onBarCodeScanned = ({ data }) => {
        if (scanned || !data) return;
        setScanned(true);

        // Haptic feedback
        Vibration.vibrate(100);

        // Data format: "FUGEN:S12345"
        const upperData = data.toUpperCase();
        if (upperData.startsWith('FUGEN:')) {
            const studentId = data.includes(':') ? data.split(':')[1].trim() : data.substring(6).trim();
            console.log(`[SCAN] Identified: "${studentId}"`);
            setIdentifiedId(studentId);
            setShowIdentifyModal(true);
        } else {
            Alert.alert('Invalid QR', 'This is not a valid FUGEN Student ID code.', [
                { text: 'Try Again', onPress: () => setScanned(false) }
            ]);
        }
    };

    if (!permission) {
        return <View style={styles.container}><ActivityIndicator size="large" color="#1A237E" /></View>;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>Camera access is required to scan Student QR Codes.</Text>
                <Button title="Grant Camera Permission" onPress={requestPermission} color="#1A237E" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.title}>FUGEN SmartPay</Text>
                    <Text style={styles.subtitle}>Scan QR • Today: {stats.totalSales.toFixed(0)} Points ({(stats.cashList?.length || 0) + (stats.creditCount || 0)} sales)</Text>
                </View>
            </View>

            <TouchableOpacity
                style={styles.homeButtonCenter}
                onPress={() => navigation.navigate('Home')}
                activeOpacity={0.7}
            >
                <Text style={styles.homeButtonText}>🏠 Home</Text>
            </TouchableOpacity>

            <View style={styles.cameraFrame}>
                {isFocused && (
                    <CameraView
                        style={StyleSheet.absoluteFillObject}
                        barcodeScannerSettings={scannerSettings}
                        onBarcodeScanned={(result) => {
                            if (!scanned) {
                                onBarCodeScanned(result);
                            }
                        }}
                    />
                )}
            </View>

            <View style={styles.footer}>
                <View style={styles.statsGrid}>
                    <View style={styles.statBoxFull}>
                        <Text style={styles.statsLabel}>TOTAL SALES TODAY</Text>
                        <Text style={styles.statsValue}>SAR {stats.totalSales.toFixed(2)}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.statBoxHalf}
                        onPress={() => setShowCash(true)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.statsLabel}>POINTS SCANNED</Text>
                        <Text style={[styles.statsValue, { color: '#2E7D32' }]}>SAR {stats.totalCash.toFixed(2)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.statBoxHalf, { borderColor: stats.totalCredit > 0 ? '#d32f2f' : '#E0E0E0' }]}
                        onPress={() => setShowCredits(true)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.statsLabel}>TOTAL CREDITS</Text>
                        <Text style={[styles.statsValue, { color: '#d32f2f' }]}>SAR {stats.totalCredit.toFixed(2)}</Text>
                    </TouchableOpacity>
                </View>

                {scanned && (
                    <Button title="Tap to Scan Again" onPress={() => setScanned(false)} color="#1A237E" />
                )}
            </View>

            <Modal
                visible={showCredits}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCredits(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Today's Credits ({stats.creditCount})</Text>
                            <TouchableOpacity onPress={() => setShowCredits(false)}>
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.creditList}>
                            {stats.creditList.length === 0 ? (
                                <Text style={styles.emptyText}>No credits recorded today.</Text>
                            ) : (
                                stats.creditList.map((item, index) => (
                                    <View key={index} style={styles.creditItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.creditName}>{item.studentName}</Text>
                                            <Text style={styles.creditTime}>
                                                {item.grade} {item.section} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.creditMainAmount}>Total: {item.amount.toFixed(2)}</Text>
                                            <Text style={styles.creditDebtAmount}>Debt: {item.creditAmount.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.statsButton}
                            onPress={() => setShowCredits(false)}
                        >
                            <Text style={styles.statsButtonText}>CLOSE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showCash}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCash(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Today's Cash Transactions ({stats.cashList.length})</Text>
                            <TouchableOpacity onPress={() => setShowCash(false)}>
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.creditList}>
                            {stats.cashList.length === 0 ? (
                                <Text style={styles.emptyText}>No cash transactions recorded today.</Text>
                            ) : (
                                stats.cashList.map((item, index) => (
                                    <View key={index} style={styles.creditItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.creditName}>{item.studentName}</Text>
                                            <Text style={styles.creditTime}>
                                                {item.grade} {item.section} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.creditMainAmount}>Total: {item.amount.toFixed(2)}</Text>
                                            <Text style={[styles.creditDebtAmount, { color: '#2E7D32' }]}>Cash: {item.cashAmount.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.statsButton}
                            onPress={() => setShowCash(false)}
                        >
                            <Text style={styles.statsButtonText}>CLOSE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showIdentifyModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => { setShowIdentifyModal(false); setScanned(false); }}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { borderRadius: 20, padding: 0, overflow: 'hidden', width: '85%', alignSelf: 'center', marginBottom: 'auto', marginTop: 'auto' }]}>
                        <View style={[styles.modalHeader, { backgroundColor: '#1A237E', padding: 20, marginBottom: 0 }]}>
                            <Text style={[styles.modalTitle, { color: '#fff' }]}>Student Identified</Text>
                            <TouchableOpacity onPress={() => { setShowIdentifyModal(false); setScanned(false); }}>
                                <Text style={[styles.closeButton, { color: '#fff' }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ padding: 25, alignItems: 'center' }}>
                            <View style={{ backgroundColor: '#E8EAF6', padding: 15, borderRadius: 12, marginBottom: 20, width: '100%', alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, color: '#666', fontWeight: 'bold', marginBottom: 5 }}>STUDENT ID</Text>
                                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1A237E' }}>{identifiedId}</Text>
                            </View>

                            <Text style={{ textAlign: 'center', color: '#444', marginBottom: 25, fontSize: 16 }}>
                                Authentication is required before proceeding. Select bypass mode or verify student.
                            </Text>

                            <TouchableOpacity
                                style={[styles.statsButton, { backgroundColor: '#2E7D32', width: '100%', marginBottom: 12, height: 55, justifyContent: 'center' }]}
                                onPress={async () => {
                                    setLoading(true);
                                    try {
                                        const res = await studentService.getStudent(identifiedId);
                                        setShowIdentifyModal(false);
                                        navigation.navigate('Purchase', {
                                            student: res.data.data,
                                            passkey: 'BYPASSED',
                                            bypassPasskey: true
                                        });
                                    } catch (err) {
                                        Alert.alert('Error', 'Failed to fetch student info.');
                                        setShowIdentifyModal(false);
                                        setScanned(false);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            >
                                {loading ? <ActivityIndicator color="#fff" /> : (
                                    <Text style={styles.statsButtonText}>🚀 PROCEED (SKIP PASSKEY)</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.statsButton, { width: '100%', height: 55, justifyContent: 'center' }]}
                                onPress={() => {
                                    setShowIdentifyModal(false);
                                    navigation.navigate('Passkey', { studentId: identifiedId });
                                }}
                            >
                                <Text style={styles.statsButtonText}>🛡️ REQUIRE PASSKEY</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        paddingTop: 80,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
        paddingHorizontal: 20,
        width: '100%',
    },
    homeButtonCenter: {
        backgroundColor: '#1A237E',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        elevation: 4,
        alignSelf: 'center',
        marginBottom: 15,
        zIndex: 10,
    },
    homeButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1A237E',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 5,
    },
    cameraFrame: {
        width: 280,
        height: 280,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#1A237E',
        backgroundColor: '#000',
    },
    footer: {
        marginTop: 20,
        width: '90%',
        alignItems: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 10,
    },
    statBoxFull: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginBottom: 8,
    },
    statBoxHalf: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        width: '48%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginBottom: 8,
        elevation: 1,
    },
    statsLabel: {
        fontSize: 10,
        color: '#666',
        fontWeight: 'bold',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    statsValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A237E',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A237E',
    },
    closeButton: {
        fontSize: 24,
        color: '#666',
        padding: 5,
    },
    creditList: {
        marginBottom: 20,
    },
    creditItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    creditName: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#333',
    },
    creditTime: {
        fontSize: 12,
        color: '#999',
    },
    creditMainAmount: {
        fontSize: 12,
        color: '#666',
    },
    creditDebtAmount: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#d32f2f',
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        marginVertical: 40,
        fontSize: 16,
    },
    statsButton: {
        backgroundColor: '#1A237E',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    statsButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    permissionText: {
        textAlign: 'center',
        fontSize: 16,
        marginBottom: 20,
        paddingHorizontal: 40,
        color: '#333',
    }
});
