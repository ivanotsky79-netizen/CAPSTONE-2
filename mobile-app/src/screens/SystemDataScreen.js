import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { transactionService, studentService, socket } from '../services/api';

export default function SystemDataScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [systemStats, setSystemStats] = useState({
        totalCash: 0,
        creditors: []
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await transactionService.getDailyStats();

            if (res.data.status === 'success') {
                const data = res.data.data;

                // Build a unique creditor list from today's credit transactions
                const creditorMap = new Map();

                if (data.creditList && data.creditList.length > 0) {
                    data.creditList.forEach(txn => {
                        if (!creditorMap.has(txn.studentId)) {
                            creditorMap.set(txn.studentId, {
                                studentId: txn.studentId,
                                studentName: txn.studentName,
                                grade: txn.grade,
                                section: txn.section,
                                creditAmount: txn.creditAmount || 0
                            });
                        } else {
                            // Accumulate credit amounts for the same student
                            const existing = creditorMap.get(txn.studentId);
                            existing.creditAmount += (txn.creditAmount || 0);
                        }
                    });
                }

                setSystemStats({
                    totalCash: data.totalCash || 0,
                    totalCredit: data.totalCredit || 0,
                    todayCreditSales: data.todayCreditSales || 0,
                    creditors: Array.from(creditorMap.values())
                });
            }
        } catch (err) {
            console.error('[SYSTEM DATA ERROR]', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        socket.on('balanceUpdate', fetchData);
        return () => socket.off('balanceUpdate', fetchData);
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>POS POINTS COLLECTED</Text>
                    <Text style={styles.statValue}>SAR {systemStats.totalCash?.toFixed(2)}</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>POS CREDIT</Text>
                    <Text style={[styles.statValue, { color: '#d32f2f' }]}>SAR {systemStats.todayCreditSales?.toFixed(2)}</Text>
                </View>

                <View style={styles.creditorHeader}>
                    <MaterialCommunityIcons name="account-details" size={24} color="#1A237E" />
                    <Text style={styles.headerText}>POS CREDIT</Text>
                </View>

                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color="#1A237E" style={{ marginTop: 20 }} />
                ) : systemStats.creditors && systemStats.creditors.length > 0 ? (
                    systemStats.creditors.map((c, i) => (
                        <View key={i} style={styles.creditorItem}>
                            <View>
                                <Text style={styles.studentName}>{c.studentName}</Text>
                                <Text style={styles.studentId}>{c.studentId} • {c.grade} {c.section}</Text>
                            </View>
                            <Text style={styles.debtAmount}>SAR {parseFloat(c.creditAmount || 0).toFixed(2)}</Text>
                        </View>
                    ))
                ) : (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#999', fontSize: 16 }}>No credit transactions today</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    scrollContent: { padding: 20 },
    statCard: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 15,
        alignItems: 'center',
        marginBottom: 15,
        elevation: 3,
    },
    statLabel: { fontSize: 13, color: '#666', fontWeight: 'bold', marginBottom: 5 },
    statValue: { fontSize: 32, fontWeight: 'bold', color: '#2E7D32' },
    creditorHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 15 },
    headerText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginLeft: 10 },
    creditorItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 8,
    },
    studentName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    studentId: { fontSize: 13, color: '#666' },
    debtAmount: { fontSize: 16, fontWeight: 'bold', color: '#d32f2f' },
});
