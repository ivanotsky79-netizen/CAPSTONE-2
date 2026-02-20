import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { transactionService } from '../services/api';

export default function DayDetailsScreen({ route, navigation }) {
    // 1. Get Params (Month Name, Day Number, Year)
    const { month, day, year } = route.params || {};

    // 2. State for Data
    const [loading, setLoading] = useState(true);
    const [dayData, setDayData] = useState(null);
    const [activeTab, setActiveTab] = useState('canteen');
    const [error, setError] = useState(null);

    // 3. Fetch Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!month || !day || !year) {
                    setError('Invalid Date Parameters');
                    setLoading(false);
                    return;
                }

                // Convert Month Name to Number
                const monthMap = {
                    'January': '01', 'February': '02', 'March': '03', 'April': '04',
                    'May': '05', 'June': '06', 'July': '07', 'August': '08',
                    'September': '09', 'October': '10', 'November': '11', 'December': '12'
                };

                const mm = monthMap[month];
                if (!mm) { searchError('Invalid Month'); return; }
                const dd = String(day).padStart(2, '0');
                const dateStr = `${year}-${mm}-${dd}`;

                console.log('Fetching daily stats for:', dateStr);

                // Fetch from Backend API (matches Admin System)
                // Pass null as location to get full nested data structure
                const res = await transactionService.getDailyStats(null, dateStr);

                if (res.data.status === 'success') {
                    setDayData(res.data.data);
                } else {
                    setError('Failed to load data.');
                }
            } catch (err) {
                console.error('Error fetching day details:', err);
                setError('Failed to load data from server.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [month, day, year]);

    // 4. Formatting Helpers
    const formatCurrency = (val) => {
        try {
            return parseFloat(val || 0).toFixed(2);
        } catch (e) { return '0.00'; }
    };

    const formatTime = (ts) => {
        try {
            if (!ts) return '';
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ''; }
    };

    // 5. Render Loading / Error
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#1A237E" />
                    <Text style={{ marginTop: 10, color: '#666' }}>Syncing with System...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !dayData) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color="#1A237E" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Details Unavailable</Text>
                </View>
                <View style={styles.center}>
                    <MaterialIcons name="cloud-off" size={48} color="#FF5252" />
                    <Text style={styles.errorText}>{error || 'Data is missing.'}</Text>
                </View>
            </SafeAreaView>
        );
    }

    // 6. Prepare Data for Render
    // Structure: { canteen: {...}, system: {...} }
    const currentStats = activeTab === 'canteen'
        ? (dayData.canteen || {})
        : (dayData.system || {});

    const transactions = Array.isArray(currentStats.transactions) ? currentStats.transactions : [];

    const renderTransaction = ({ item, index }) => {
        if (!item) return null;
        return (
            <View style={styles.transactionCard}>
                <View style={[styles.sidebar, { backgroundColor: item.type === 'REFUND' ? '#FFEBEE' : '#E8F5E9' }]} />
                <View style={styles.txnContent}>
                    <View style={styles.row}>
                        <View style={styles.iconBox}>
                            <MaterialIcons
                                name={item.type === 'PURCHASE' ? 'shopping-cart' : 'account-balance-wallet'}
                                size={20}
                                color="#1A237E"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.txnType}>{item.type || 'Transaction'}</Text>
                            <Text style={styles.txnTime}>{item.timestamp ? formatTime(item.timestamp) : 'Time Unknown'}</Text>
                        </View>
                        <View>
                            <Text style={[
                                styles.txnAmount,
                                { color: item.type === 'REFUND' || item.type === 'PURCHASE' ? '#D32F2F' : '#388E3C' }
                            ]}>
                                {formatCurrency(Math.abs(item.amount))}
                            </Text>
                            {item.studentId ? <Text style={styles.studentId}>{item.studentId}</Text> : null}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#1A237E" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{month} {day}, {year}</Text>
            </View>

            <View style={styles.tabsContainer}>
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'canteen' && styles.activeTab]}
                        onPress={() => setActiveTab('canteen')}
                    >
                        <Text style={[styles.tabText, activeTab === 'canteen' && styles.activeTabText]}>Canteen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'system' && styles.activeTab]}
                        onPress={() => setActiveTab('system')}
                    >
                        <Text style={[styles.tabText, activeTab === 'system' && styles.activeTabText]}>System</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total Volume</Text>
                    <Text style={styles.summaryValue}>SAR {formatCurrency(currentStats.totalSales || currentStats.topups || 0)}</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Transactions</Text>
                            <Text style={styles.statValue}>{transactions.length}</Text>
                        </View>
                        {activeTab === 'canteen' && (
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Cash</Text>
                                <Text style={styles.statValue}>{formatCurrency(currentStats.totalCash || currentStats.cashCollected)}</Text>
                            </View>
                        )}
                        {activeTab === 'canteen' && (
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Credit</Text>
                                <Text style={styles.statValue}>{formatCurrency(currentStats.totalCredit)}</Text>
                            </View>
                        )}
                        {activeTab === 'system' && (
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Withdrawals</Text>
                                <Text style={styles.statValue}>{formatCurrency(currentStats.withdrawals)}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <Text style={styles.sectionHeader}>Transaction History</Text>

                {transactions.length > 0 ? (
                    <FlatList
                        data={transactions}
                        renderItem={renderTransaction}
                        keyExtractor={(item, index) => index.toString()}
                        scrollEnabled={false}
                    />
                ) : (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="file-document-outline" size={40} color="#ccc" />
                        <Text style={styles.emptyText}>No transactions recorded.</Text>
                    </View>
                )}

                {/* Spacer for bottom */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f7fa' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'white', elevation: 2 },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A237E' },
    errorText: { fontSize: 18, color: '#333', marginTop: 10, fontWeight: 'bold' },

    tabsContainer: { backgroundColor: 'white', paddingBottom: 10 },
    tabs: { flexDirection: 'row', marginHorizontal: 15, backgroundColor: '#F5F5F5', borderRadius: 10, padding: 4 },
    tab: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
    activeTab: { backgroundColor: '#1A237E' },
    tabText: { color: '#666', fontWeight: 'bold' },
    activeTabText: { color: 'white' },

    content: { flex: 1, padding: 15 },
    summaryCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 20, alignItems: 'center', elevation: 2 },
    summaryLabel: { fontSize: 14, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 },
    summaryValue: { fontSize: 32, fontWeight: 'bold', color: '#1A237E', marginBottom: 20 },
    statsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
    statItem: { alignItems: 'center' },
    statLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
    statValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },

    sectionHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333', marginLeft: 5 },
    transactionCard: { backgroundColor: 'white', borderRadius: 12, marginBottom: 12, overflow: 'hidden', flexDirection: 'row', elevation: 1 },
    sidebar: { width: 6, height: '100%' },
    txnContent: { flex: 1, padding: 15 },
    row: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8EAF6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    txnType: { fontWeight: 'bold', color: '#333', fontSize: 15 },
    txnTime: { fontSize: 12, color: '#888', marginTop: 2 },
    txnAmount: { fontWeight: 'bold', fontSize: 16, textAlign: 'right' },
    studentId: { fontSize: 11, color: '#999', textAlign: 'right', marginTop: 2 },
    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyText: { textAlign: 'center', color: '#999', marginTop: 10, fontStyle: 'italic' },
});
