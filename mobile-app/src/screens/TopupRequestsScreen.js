import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { transactionService, socket } from '../services/api';

export default function TopupRequestsScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [requests, setRequests] = useState([]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await transactionService.getTopupRequests();
            if (res.data.status === 'success') {
                setRequests(res.data.data);
            }
        } catch (err) {
            console.error('[FETCH REQUESTS ERROR]', err);
            Alert.alert('Error', 'Failed to load requests');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        socket.on('balanceUpdate', fetchRequests);
        return () => socket.off('balanceUpdate', fetchRequests);
    }, []);

    const handleApprove = async (id) => {
        try {
            await transactionService.approveTopupRequest(id);
            Alert.alert('Success', 'Reservation accepted and student notified');
            fetchRequests();
        } catch (err) {
            Alert.alert('Error', 'Failed to approve request');
        }
    };

    const handleResolve = async (id) => {
        Alert.alert(
            'Confirm Collection',
            'Have you collected the physical cash and want to complete this top-up?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, Complete',
                    onPress: async () => {
                        try {
                            await transactionService.resolveTopupRequest(id);
                            Alert.alert('Success', 'Top-up completed successfully');
                            fetchRequests();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to resolve request');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => (
        <View style={styles.requestCard}>
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{item.studentName}</Text>
                    <Text style={styles.studentId}>{item.studentId} • {item.gradeSection || 'N/A'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'ACCEPTED' ? '#E8F5E9' : '#FFF3E0' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'ACCEPTED' ? '#2E7D32' : '#E65100' }]}>{item.status}</Text>
                </View>
            </View>

            <View style={styles.detailsRow}>
                <View style={styles.detailBox}>
                    <MaterialCommunityIcons name="currency-usd" size={16} color="#666" />
                    <Text style={styles.detailText}>Points {item.amount}</Text>
                </View>
                <View style={styles.detailBox}>
                    <MaterialCommunityIcons name="calendar-clock" size={16} color="#666" />
                    <Text style={styles.detailText}>{item.date} • {item.timeSlot}</Text>
                </View>
            </View>

            <View style={styles.actionRow}>
                {item.status === 'PENDING' ? (
                    <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(item.id)}>
                        <MaterialCommunityIcons name="check-circle-outline" size={20} color="white" />
                        <Text style={styles.actionBtnText}>Accept</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.actionBtn, styles.resolveBtn]} onPress={() => handleResolve(item.id)}>
                        <MaterialCommunityIcons name="cash-register" size={20} color="white" />
                        <Text style={styles.actionBtnText}>Collected & Complete</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#1A237E" />
                </View>
            ) : (
                <FlatList
                    data={requests}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="clipboard-check-outline" size={60} color="#ccc" />
                            <Text style={styles.emptyText}>No unresolved top-up requests.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 15 },
    requestCard: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 16,
        marginBottom: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    studentName: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    studentId: { fontSize: 14, color: '#666', marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: 'bold' },
    detailsRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    detailBox: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    detailText: { fontSize: 14, color: '#444' },
    actionRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 10,
    },
    approveBtn: { backgroundColor: '#1A237E' },
    resolveBtn: { backgroundColor: '#2E7D32' },
    actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#999', fontSize: 16, marginTop: 15, fontStyle: 'italic' }
});
