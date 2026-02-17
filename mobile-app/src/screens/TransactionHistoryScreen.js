import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { studentService, transactionService } from '../services/api';

export default function UsersScreen() {
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    // Profile Modal
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [loadingTxn, setLoadingTxn] = useState(false);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await studentService.getAllStudents();
            if (res.data.status === 'success') {
                const list = res.data.data;
                // Sort by name
                list.sort((a, b) => a.fullName.localeCompare(b.fullName));
                setStudents(list);
                setFilteredStudents(list);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const handleSearch = (text) => {
        setSearchText(text);
        if (!text) {
            setFilteredStudents(students);
            return;
        }
        const lower = text.toLowerCase();
        const filtered = students.filter(s =>
            s.fullName.toLowerCase().includes(lower) ||
            s.studentId.toLowerCase().includes(lower)
        );
        setFilteredStudents(filtered);
    };

    const openProfile = async (student) => {
        setSelectedStudent(student);
        setModalVisible(true);
        setLoadingTxn(true);
        try {
            const res = await transactionService.getTransactions(student.studentId);
            if (res.data.status === 'success') {
                setTransactions(res.data.data);
            } else {
                setTransactions([]);
            }
        } catch (err) {
            console.error(err);
            setTransactions([]);
        } finally {
            setLoadingTxn(false);
        }
    };

    const renderStudent = ({ item }) => (
        <TouchableOpacity style={styles.studentCard} onPress={() => openProfile(item)}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.fullName.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.studentName}>{item.fullName}</Text>
                <Text style={styles.studentId}>{item.studentId} • {item.gradeSection}</Text>
            </View>
            <View>
                <Text style={[styles.balanceText, { color: parseFloat(item.balance) < 0 ? '#d32f2f' : '#2E7D32' }]}>
                    {parseFloat(item.balance) < 0 ? 'Owning' : 'Balance'}
                </Text>
                <Text style={[styles.balanceValue, { color: parseFloat(item.balance) < 0 ? '#d32f2f' : '#2E7D32' }]}>
                    SAR {Math.abs(parseFloat(item.balance)).toFixed(2)}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.searchContainer}>
                <MaterialCommunityIcons name="magnify" size={24} color="#666" style={{ marginRight: 10 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search Student..."
                    value={searchText}
                    onChangeText={handleSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1A237E" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={filteredStudents}
                    keyExtractor={item => item.studentId}
                    renderItem={renderStudent}
                    contentContainerStyle={{ padding: 15 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No students found.</Text>}
                />
            )}

            <Modal
                visible={modalVisible}
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                            <MaterialCommunityIcons name="close" size={28} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Student Profile</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    {selectedStudent && (
                        <View style={styles.profileHeader}>
                            <View style={[styles.bigAvatar, { backgroundColor: '#1A237E' }]}>
                                <Text style={styles.bigAvatarText}>{selectedStudent.fullName.charAt(0)}</Text>
                            </View>
                            <Text style={styles.profileName}>{selectedStudent.fullName}</Text>
                            <Text style={styles.profileId}>{selectedStudent.studentId}</Text>

                            <View style={[styles.balanceCard, {
                                backgroundColor: parseFloat(selectedStudent.balance) < 0 ? '#ffebee' : '#e8f5e9',
                                borderColor: parseFloat(selectedStudent.balance) < 0 ? '#ef5350' : '#66bb6a'
                            }]}>
                                <Text style={styles.balanceLabel}>Current Balance</Text>
                                <Text style={[styles.balanceBig, { color: parseFloat(selectedStudent.balance) < 0 ? '#c62828' : '#2e7d32' }]}>
                                    SAR {parseFloat(selectedStudent.balance).toFixed(2)}
                                </Text>
                            </View>
                        </View>
                    )}

                    <Text style={styles.historyTitle}>Transaction History</Text>
                    {loadingTxn ? (
                        <ActivityIndicator color="#1A237E" style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={transactions}
                            keyExtractor={(item, index) => index.toString()}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                            renderItem={({ item }) => (
                                <View style={styles.txnItem}>
                                    <View>
                                        <Text style={styles.txnType}>{item.type || 'TXN'}</Text>
                                        <Text style={styles.txnDate}>{new Date(item.timestamp).toLocaleString()}</Text>
                                    </View>
                                    <View>
                                        <Text style={[styles.txnAmount, { color: item.type === 'PURCHASE' ? '#d32f2f' : '#2E7D32' }]}>
                                            {item.type === 'PURCHASE' ? '-' : '+'}{parseFloat(item.amount).toFixed(2)}
                                        </Text>
                                        {item.newBalance && <Text style={styles.txnBalance}>Bal: {parseFloat(item.newBalance).toFixed(2)}</Text>}
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>No transactions found.</Text>}
                        />
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', margin: 15, paddingHorizontal: 15, height: 50, borderRadius: 10, elevation: 2 },
    searchInput: { flex: 1, fontSize: 16 },
    studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 1 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 18, fontWeight: 'bold', color: '#555' },
    studentName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    studentId: { fontSize: 12, color: '#888' },
    balanceText: { fontSize: 10, textAlign: 'right', fontWeight: 'bold' },
    balanceValue: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
    emptyText: { textAlign: 'center', color: '#999', marginTop: 20 },

    // Modal
    modalContainer: { flex: 1, backgroundColor: 'white' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    closeButton: { padding: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    profileHeader: { alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    bigAvatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    bigAvatarText: { fontSize: 32, fontWeight: 'bold', color: 'white' },
    profileName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
    profileId: { fontSize: 14, color: '#666', marginBottom: 15 },
    balanceCard: { padding: 15, borderRadius: 12, borderWidth: 1, width: '100%', alignItems: 'center' },
    balanceLabel: { fontSize: 12, fontWeight: 'bold', color: '#555', textTransform: 'uppercase' },
    balanceBig: { fontSize: 28, fontWeight: 'bold', marginTop: 5 },
    historyTitle: { fontSize: 18, fontWeight: 'bold', margin: 20, marginBottom: 10 },
    txnItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    txnType: { fontWeight: 'bold', color: '#333' },
    txnDate: { fontSize: 12, color: '#999' },
    txnAmount: { fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
    txnBalance: { fontSize: 11, color: '#aaa', textAlign: 'right' }
});
