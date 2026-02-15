import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ReportsScreen({ navigation }) {
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // Generate days for selected month
    const getDaysInMonth = (monthIndex) => {
        const year = currentYear;
        const daysCount = new Date(year, monthIndex + 1, 0).getDate();
        return Array.from({ length: daysCount }, (_, i) => i + 1);
    };

    const handleDaySelect = (day) => {
        navigation.navigate('DayDetails', {
            month: months[selectedMonth],
            day,
            year: currentYear
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <MaterialCommunityIcons name="calendar-month" size={32} color="#1A237E" />
                <Text style={styles.headerTitle}>Historical Reports</Text>
            </View>

            {!selectedMonth ? (
                <ScrollView style={styles.scrollView}>
                    <Text style={styles.sectionTitle}>Select Month</Text>
                    <View style={styles.monthGrid}>
                        {months.map((month, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.monthButton,
                                    index > currentMonth && styles.disabledButton
                                ]}
                                onPress={() => index <= currentMonth && setSelectedMonth(index)}
                                disabled={index > currentMonth}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.monthText,
                                    index > currentMonth && styles.disabledText
                                ]}>
                                    {month}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            ) : (
                <ScrollView style={styles.scrollView}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => setSelectedMonth(null)}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={20} color="#1A237E" />
                        <Text style={styles.backText}>Back to Months</Text>
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>{months[selectedMonth]} {currentYear}</Text>
                    <View style={styles.dayGrid}>
                        {getDaysInMonth(selectedMonth).map((day) => {
                            const isPastDay = selectedMonth < currentMonth ||
                                (selectedMonth === currentMonth && day <= new Date().getDate());

                            return (
                                <TouchableOpacity
                                    key={day}
                                    style={[
                                        styles.dayButton,
                                        !isPastDay && styles.disabledButton
                                    ]}
                                    onPress={() => isPastDay && handleDaySelect(day)}
                                    disabled={!isPastDay}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.dayText,
                                        !isPastDay && styles.disabledText
                                    ]}>
                                        {day}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            )}
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
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1A237E',
        marginLeft: 10,
    },
    scrollView: {
        flex: 1,
        padding: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    monthGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    monthButton: {
        backgroundColor: '#1A237E',
        width: '48%',
        padding: 20,
        borderRadius: 12,
        marginBottom: 12,
        alignItems: 'center',
        elevation: 3,
    },
    monthText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dayGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    dayButton: {
        backgroundColor: '#283593',
        width: '13%',
        aspectRatio: 1,
        margin: '1%',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    dayText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#e0e0e0',
        elevation: 0,
    },
    disabledText: {
        color: '#999',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        padding: 10,
    },
    backText: {
        fontSize: 16,
        color: '#1A237E',
        marginLeft: 5,
        fontWeight: '600',
    },
});
