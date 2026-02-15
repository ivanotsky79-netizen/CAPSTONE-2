import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { transactionService, socket } from '../services/api';

export default function TransactionHistoryScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        totalSales: 0,
        totalCash: 0,
        totalCredit: 0,
        todayCreditSales: 0,
        cashList: [],
        creditList: []
    });

    const fetchData = async () => {
        try {
            const res = await transactionService.getDailyStats();
            if (res.data.status === 'success') {
                setStats(res.data.data);
            }
        } catch (err) {
            console.error(err);
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
                style={styles.listContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <Text style={styles.sectionTitle}>Recent Transactions</Text>
                {[...stats.cashList, ...stats.creditList]
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .map((item, index) => (
                        <View key={index} style={styles.txnItem}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.txnName}>{item.studentName}</Text>
                                <Text style={styles.txnSub}>
                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.type || 'PURCHASE'}
                                </Text>
                            </View>
                            <Text style={[styles.txnAmount, {
                                color: item.type === 'TOPUP' ? '#2196F3' : (item.type === 'CREDIT' ? '#d32f2f' : '#333')
                            }]}>
                                {item.type === 'TOPUP' ? '+' : ''}{parseFloat(item.amount).toFixed(2)}
                            </Text>
                        </View>
                    ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 15, justifyContent: 'space-between' },
    summaryBox: {
        backgroundColor: 'white',
        width: '48%',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        elevation: 2,
    },
    boxLabel: { fontSize: 10, color: '#666', fontWeight: 'bold', marginBottom: 5 },
    boxValue: { fontSize: 20, fontWeight: 'bold', color: '#1A237E' },
    listContainer: { flex: 1, paddingHorizontal: 15 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 15, color: '#333' },
    txnItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#1A237E'
    },
    txnName: { fontSize: 15, fontWeight: 'bold' },
    txnSub: { fontSize: 12, color: '#999' },
    txnAmount: { fontSize: 16, fontWeight: 'bold' }
});
