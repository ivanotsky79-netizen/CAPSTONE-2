import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DayDetailsScreen({ route }) {
    // Robust Destructuring with defaults
    const { month, day, year } = route.params || { month: 'Unknown', day: '?', year: '?' };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Day Details (Debug Mode)</Text>
            <Text style={styles.text}>{month} {day}, {year}</Text>
            <Text style={styles.subtext}>If you see this, the crash is fixed!</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#1A237E'
    },
    text: {
        fontSize: 18,
        margin: 10,
        color: '#333'
    },
    subtext: {
        fontSize: 14,
        color: 'green',
        marginTop: 30
    }
});
