import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DayDetailsScreen({ route }) {
    const { month, day, year } = route.params;
    const [loading, setLoading] = useState(true);
    const [dayData, setDayData] = useState({
        totalSales: 0,
        totalCash: 0,
        totalCredit: 0,
        transactions: []
    });

    useEffect(() => {
        loadDayData();
    }, []);

    const loadDayData = async () => {
        try {
            const dateKey = `report_${year}_${month}_${day}`;
            const stored = await AsyncStorage.getItem(dateKey);

            if (stored) {
                setDayData(JSON.parse(stored));
            } else {
                // No data saved for this day
                setDayData({
                    totalSales: 0,
                    totalCash: 0,
                    totalCredit: 0,
                    transactions: []
                });
            }
        } catch (err) {
            console.error('Error loading day data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#1A237E" style={{ marginTop: 50 }} />
            </SafeAreaView>
        );
    }

    const [activeTab, setActiveTab] = useState('canteen');

    // Helper to normalize data: if flat (legacy), wrap it like new structure
    const normalizeData = (data) => {
        if (data.canteen && data.system) {
            return data;
        }
        // Legacy Data Shim
        return {
            canteen: {
                totalSales: data.totalSales || 0,
                totalCash: data.totalCash || 0,
                creditSales: data.todayCreditSales || data.totalCredit || 0,
                transactions: data.transactions || []
            },
            system: null // No system data for old reports
        };
    };

    const displayData = dayData.canteen ? dayData : normalizeData(dayData);
    const currentStats = activeTab === 'canteen' ? displayData.canteen : displayData.system;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <MaterialCommunityIcons name="calendar-check" size={28} color="#1A237E" />
                <Text style={styles.headerTitle}>{month} {day}, {year}</Text>
            </View>

            {/* Tab Switcher (Only if System data exists) */}
            {displayData.system && (
                <View style={styles.tabContainer}>
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
            )}

            <ScrollView style={styles.scrollView}>
                {activeTab === 'canteen' ? (
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <MaterialCommunityIcons name="cart" size={32} color="#1A237E" />
                            <Text style={styles.statLabel}>Total Sales</Text>
                            <Text style={styles.statValue}>SAR {currentStats?.totalSales?.toFixed(2) || '0.00'}</Text>
                        </View>

                        <View style={styles.statCard}>
                            <MaterialCommunityIcons name="cash-multiple" size={32} color="#2E7D32" />
                            <Text style={styles.statLabel}>POS Cash</Text>
                            <Text style={[styles.statValue, { color: '#2E7D32' }]}>
                                SAR {currentStats?.totalCash?.toFixed(2) || '0.00'}
                            </Text>
                        </View>

                        <View style={styles.statCard}>
                            <MaterialCommunityIcons name="credit-card-clock" size={32} color="#d32f2f" />
                            <Text style={styles.statLabel}>Credit Sales</Text>
                            <Text style={[styles.statValue, { color: '#d32f2f' }]}>
                                SAR {currentStats?.creditSales?.toFixed(2) || '0.00'}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <MaterialCommunityIcons name="bank-transfer-in" size={32} color="#3f8600" />
                            <Text style={styles.statLabel}>Top-ups (Cash In)</Text>
                            <Text style={[styles.statValue, { color: '#3f8600' }]}>SAR {currentStats?.topups?.toFixed(2) || '0.00'}</Text>
                        </View>

                        <View style={styles.statCard}>
                            <MaterialCommunityIcons name="bank-transfer-out" size={32} color="#cf1322" />
                            <Text style={styles.statLabel}>Withdrawals (Cash Out)</Text>
                            <Text style={[styles.statValue, { color: '#cf1322' }]}>
                                SAR {currentStats?.withdrawals?.toFixed(2) || '0.00'}
                            </Text>
                        </View>

                        <View style={styles.statCard}>
                            <MaterialCommunityIcons name="wallet" size={32} color="#faad14" />
                            <Text style={styles.statLabel}>System Cash Balance</Text>
                            <Text style={[styles.statValue, { color: '#faad14' }]}>
                                SAR {currentStats?.cashOnHand?.toFixed(2) || '0.00'}
                            </Text>
                        </View>
                    </View>
                )}

                {currentStats?.transactions && currentStats.transactions.length > 0 ? (
                    <View style={styles.transactionsSection}>
                        <Text style={styles.sectionTitle}>Transactions ({currentStats.transactions.length})</Text>
                        {currentStats.transactions.map((txn, index) => (
                            <View key={index} style={styles.txnItem}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.txnName}>{txn.studentName || 'System Admin'}</Text>
                                    <Text style={styles.txnSub}>
                                        {new Date(txn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {txn.type}
                                    </Text>
                                </View>
                                <Text style={styles.txnAmount}>SAR {parseFloat(txn.amount).toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="file-document-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No data for this view</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A237E',
        marginLeft: 10,
    },
    scrollView: {
        flex: 1,
        padding: 15,
    },
    statsGrid: {
        marginBottom: 20,
    },
    statCard: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 12,
        marginBottom: 12,
        alignItems: 'center',
        elevation: 3,
    },
    statLabel: {
        fontSize: 13,
        color: '#666',
        marginTop: 8,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A237E',
    },
    transactionsSection: {
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    txnItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#1A237E',
    },
    txnName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#333',
    },
    txnSub: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    txnAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        marginTop: 15,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 15,
        backgroundColor: 'white',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#1A237E',
    },
    tabText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    activeTabText: {
        color: '#1A237E',
    },
});
