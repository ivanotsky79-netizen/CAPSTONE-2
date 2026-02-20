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

    const [students, setStudents] = useState([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, studentsRes] = await Promise.all([
                transactionService.getDailyStats(),
                studentService.getAllStudents()
            ]);

            if (statsRes.data.status === 'success') {
                const data = statsRes.data.data;
                setSystemStats({
                    totalCash: data.totalCash || 0,
                    totalCredit: data.totalCredit || 0,
                    todayCreditSales: data.todayCreditSales || 0,
                });
            }

            if (studentsRes.data.status === 'success') {
                // Filter students with negative balance (Active Debtors)
                const debtors = studentsRes.data.data.filter(s => parseFloat(s.balance) < 0);
                setStudents(debtors);
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
                    <MaterialCommunityIcons name="account-alert" size={24} color="#d32f2f" />
                    <Text style={styles.headerText}>ACTIVE ACCOUNTS WITH CREDITS</Text>
                </View>

                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color="#1A237E" style={{ marginTop: 20 }} />
                ) : students.length > 0 ? (
                    students.map((s, i) => (
                        <View key={i} style={styles.creditorItem}>
                            <View>
                                <Text style={styles.studentName}>{s.fullName}</Text>
                                <Text style={styles.studentId}>{s.studentId} • {s.gradeSection}</Text>
                            </View>
                            <Text style={styles.debtAmount}>SAR {Math.abs(parseFloat(s.balance)).toFixed(2)}</Text>
                        </View>
                    ))
                ) : (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#999', fontSize: 16 }}>No students with pending credit.</Text>
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
