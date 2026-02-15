import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert, ActivityIndicator } from 'react-native';
import { studentService } from '../services/api';

export default function PasskeyScreen({ route, navigation }) {
    const { studentId } = route.params;
    const [passkey, setPasskey] = useState('');
    const [studentName, setStudentName] = useState('Loading...');
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        const fetchStudentInfo = async () => {
            try {
                const res = await studentService.getStudent(studentId);
                setStudentName(res.data.data.fullName);
            } catch (err) {
                console.error("[FETCH_STUDENT_ERROR]", err);
                if (err.response?.status === 404) {
                    setStudentName('Student Not Found');
                } else {
                    setStudentName('Connection Error');
                }
            }
        };
        fetchStudentInfo();
    }, [studentId]);

    const handleVerify = async (enteredPasskey) => {
        const keyToVerify = enteredPasskey || passkey;
        if (keyToVerify.length !== 4) {
            Alert.alert('Error', 'Passkey must be 4 digits');
            return;
        }

        setLoading(true);
        try {
            const res = await studentService.verifyPasskey(studentId, keyToVerify);
            const student = res.data.student;

            // Navigate to Purchase with verified credentials
            navigation.replace('Purchase', { student, passkey: keyToVerify });
        } catch (error) {
            Alert.alert('Login Failed', error.response?.data?.message || 'Invalid Passkey');
            setPasskey('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.studentName}>{studentName}</Text>
            <Text style={styles.label}>ID: {studentId}</Text>
            <Text style={styles.prompt}>Enter 4-Digit Passkey</Text>

            <TextInput
                style={styles.input}
                value={passkey}
                onChangeText={(text) => {
                    setPasskey(text);
                    if (text.length === 4) {
                        handleVerify(text);
                    }
                }}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                placeholder="XXXX"
                autoFocus={true}
            />

            {loading ? (
                <ActivityIndicator size="large" color="#1A237E" />
            ) : (
                <View style={{ width: '80%' }}>
                    <Button title="Verify Identity" onPress={() => handleVerify()} color="#1A237E" />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        paddingTop: 100,
    },
    studentName: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#1A237E',
        marginBottom: 5,
    },
    label: {
        fontSize: 16,
        marginBottom: 30,
        color: '#666'
    },
    prompt: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 20,
    },
    input: {
        width: '80%',
        height: 50,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        textAlign: 'center',
        fontSize: 24,
        letterSpacing: 5,
        marginBottom: 20,
    },
});
