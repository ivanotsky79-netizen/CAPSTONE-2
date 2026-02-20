import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { transactionService, studentService } from '../services/api';

export default function PurchaseScreen({ route, navigation }) {
    const [student, setStudent] = useState(route.params.student);
    const { passkey } = route.params;
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

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
        try {
            await transactionService.purchase(student.studentId, amount, passkey);
            // Play success sound before showing the alert
            await playSuccessSound();
            Alert.alert('✅ Success', 'Transaction Completed!', [
                { text: 'New Sale', onPress: () => navigation.navigate('Scan') }
            ]);
            setAmount('');
        } catch (error) {
            Alert.alert('Transaction Failed', error.response?.data?.message || 'Error processing purchase');
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
    disabled: { opacity: 0.7 }
});
