import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import { transactionService, studentService } from '../services/api';

export default function PurchaseScreen({ route, navigation }) {
    const [student, setStudent] = useState(route.params.student);
    const { passkey } = route.params;
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState(null);

    useEffect(() => {
        // Just configure audio mode once
        const configureAudio = async () => {
            try {
                await Audio.setAudioModeAsync({
                    playsInSilentModeIOS: true,
                    allowsRecordingIOS: false,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: true,
                });
            } catch (e) {
                console.log('Audio config error:', e);
            }
        };
        configureAudio();
    }, []);

    const playSuccessSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/success.mp3')
            );
            await sound.playAsync();

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    sound.unloadAsync();
                }
            });
        } catch (e) {
            console.log('Sound play error:', e);
        }
    };

    const refreshBalance = async () => {
        try {
            const res = await studentService.getStudent(student.studentId);
            setStudent(res.data.data);
        } catch (err) {
            console.log('Failed to refresh balance');
        }
    };

    const handlePurchase = async () => {
        const val = parseFloat(amount);
        if (!val || val <= 0) return;

        const currentBal = parseFloat(student.balance);
        const creditLimit = 500;

        if (currentBal - val < -creditLimit) {
            Alert.alert(
                '⛔ Credit Limit Exceeded',
                `This purchase would exceed the ${creditLimit}-point credit limit. Current balance: ${currentBal.toFixed(2)} Points.`
            );
            return;
        }

        if (currentBal < val) {
            Alert.alert(
                'Insufficient Balance',
                `Balance is ${currentBal.toFixed(2)} Points. This will result in negative balance. Proceed with Credit?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Use Credit', onPress: () => processTransaction() }
                ]
            );
        } else {
            processTransaction();
        }
    };

    const processTransaction = async () => {
        setLoading(true);
        const prevBalance = parseFloat(student.balance);
        const purchaseAmt = parseFloat(amount);
        try {
            await transactionService.purchase(student.studentId, amount, passkey);
            await playSuccessSound();

            const newBalance = prevBalance - purchaseAmt;
            setReceiptData({
                studentName: student.fullName,
                grade: `${student.grade} - ${student.section}`,
                amount: purchaseAmt,
                prevBalance: prevBalance,
                newBalance: newBalance,
                timestamp: new Date().toLocaleString(),
                isCredit: newBalance < 0,
            });
            setShowReceipt(true);
            setAmount('');
            // Refresh student data
            refreshBalance();
        } catch (error) {
            if (error.message === 'Network Error' || !error.response) {
                Alert.alert('Network Error', 'Cannot reach the server. Please check your connection.');
            } else {
                Alert.alert('Transaction Failed', error.response?.data?.message || 'Error processing purchase');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.studentName}>{student.fullName}</Text>
                <Text style={styles.grade}>{student.grade} - {student.section}</Text>
                <Text style={[styles.balance, { color: student.balance < 0 ? 'red' : 'green' }]}>
                    {parseFloat(student.balance).toFixed(2)} Points
                </Text>
            </View>

            <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Enter Amount (Points)</Text>
                <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                    autoFocus
                />
            </View>

            <View style={styles.quickButtons}>
                {[5, 10, 15, 20].map(val => (
                    <TouchableOpacity key={val} style={styles.qBtn} onPress={() => setAmount(val.toString())}>
                        <Text style={styles.qBtnText}>{val}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={[styles.payButton, loading ? styles.disabled : null]}
                onPress={handlePurchase}
                disabled={loading}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>CONFIRM PURCHASE</Text>}
            </TouchableOpacity>

            {/* Receipt Modal */}
            <Modal visible={showReceipt} transparent animationType="fade">
                <View style={styles.receiptOverlay}>
                    <View style={styles.receiptCard}>
                        <Text style={styles.receiptTitle}>✅ Transaction Complete</Text>
                        <View style={styles.receiptDivider} />
                        {receiptData && (
                            <>
                                <Text style={styles.receiptLabel}>Student</Text>
                                <Text style={styles.receiptValue}>{receiptData.studentName}</Text>
                                <Text style={styles.receiptLabel}>Grade</Text>
                                <Text style={styles.receiptValue}>{receiptData.grade}</Text>
                                <View style={styles.receiptDivider} />
                                <Text style={styles.receiptLabel}>Amount Charged</Text>
                                <Text style={[styles.receiptAmount, { color: '#d32f2f' }]}>-{receiptData.amount.toFixed(2)} Points</Text>
                                <View style={styles.receiptRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.receiptLabel}>Previous</Text>
                                        <Text style={styles.receiptSmallVal}>{receiptData.prevBalance.toFixed(2)}</Text>
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={styles.receiptLabel}>New Balance</Text>
                                        <Text style={[styles.receiptSmallVal, { color: receiptData.newBalance < 0 ? '#d32f2f' : '#2E7D32' }]}>{receiptData.newBalance.toFixed(2)}</Text>
                                    </View>
                                </View>
                                {receiptData.isCredit && (
                                    <View style={styles.receiptWarning}>
                                        <Text style={styles.receiptWarningText}>⚠️ Credit used — student owes balance</Text>
                                    </View>
                                )}
                                <Text style={styles.receiptTime}>{receiptData.timestamp}</Text>
                            </>
                        )}
                        <TouchableOpacity style={styles.receiptBtn} onPress={() => { setShowReceipt(false); navigation.navigate('Scan'); }}>
                            <Text style={styles.receiptBtnText}>NEXT CUSTOMER</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    header: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 30,
        elevation: 2,
    },
    studentName: { fontSize: 22, fontWeight: 'bold' },
    grade: { fontSize: 16, color: '#666', marginBottom: 10 },
    balance: { fontSize: 32, fontWeight: 'bold' },

    inputContainer: { marginBottom: 20 },
    inputLabel: { fontSize: 16, marginBottom: 5, color: '#333' },
    amountInput: {
        backgroundColor: '#fff',
        fontSize: 40,
        padding: 15,
        textAlign: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd'
    },
    quickButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    qBtn: {
        backgroundColor: '#e3f2fd',
        padding: 15,
        borderRadius: 50,
        minWidth: 60,
        alignItems: 'center'
    },
    qBtnText: { fontSize: 18, color: '#1976D2', fontWeight: 'bold' },

    payButton: {
        backgroundColor: '#d32f2f',
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    payText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    disabled: { opacity: 0.7 },

    // Receipt Modal
    receiptOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    receiptCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 25,
        width: '100%',
        maxWidth: 360,
        elevation: 10,
    },
    receiptTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2E7D32',
        textAlign: 'center',
        marginBottom: 5,
    },
    receiptDivider: {
        height: 1,
        backgroundColor: '#e0e0e0',
        marginVertical: 12,
    },
    receiptLabel: {
        fontSize: 11,
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    receiptValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    receiptAmount: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 5,
    },
    receiptRow: {
        flexDirection: 'row',
        marginTop: 10,
        marginBottom: 10,
    },
    receiptSmallVal: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    receiptWarning: {
        backgroundColor: '#fff3e0',
        padding: 10,
        borderRadius: 8,
        marginVertical: 8,
    },
    receiptWarningText: {
        color: '#e65100',
        fontSize: 13,
        textAlign: 'center',
        fontWeight: '600',
    },
    receiptTime: {
        textAlign: 'center',
        color: '#999',
        fontSize: 12,
        marginTop: 5,
        marginBottom: 15,
    },
    receiptBtn: {
        backgroundColor: '#1A237E',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    receiptBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
