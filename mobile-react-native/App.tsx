import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';

const API_BASE = 'http://localhost:5173/api';

type Lead = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status?: string;
  source?: string;
  concern?: string;
};

type LeadsResponse = { success: boolean; data?: Lead[]; message?: string };
type LeadResponse = { success: boolean; data?: Lead; message?: string };

export default function App() {
  const [screen, setScreen] = useState<'home' | 'queue' | 'active-call' | 'post-call' | 'lead-360' | 'add-lead'>('home');
  const [leads, setLeads] = useState<Lead[]>([
    { id: 'TRH-24190', name: 'Lakshmi Narayana', phone: '+91 98491 22618', status: 'Hot', concern: 'Enterprise CRM rollout' },
    { id: 'TRH-24184', name: 'Madhavi Rao', phone: '+91 99850 41172', status: 'Warm', concern: 'Premium service enquiry' },
    { id: 'TRH-24179', name: 'Mohammed Faizal', phone: '+91 97011 98420', status: 'Warm', concern: 'Annual plan renewal' },
  ]);
  const [selectedLead, setSelectedLead] = useState<Lead>(leads[0]);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isCalling, setIsCalling] = useState(false);

  // New Lead Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSource, setNewSource] = useState('Mobile App');

  useEffect(() => {
    // Fetch live leads from backend
    fetch(`${API_BASE}/leads`)
      .then(res => res.json() as Promise<LeadsResponse>)
      .then(res => {
        if (res.success && res.data && res.data.length > 0) {
          setLeads(res.data);
          setSelectedLead(res.data[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let interval: any;
    if (isCalling) {
      interval = setInterval(() => setCallSeconds(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  const startCall = (lead: Lead) => {
    setSelectedLead(lead);
    setCallSeconds(0);
    setIsCalling(true);
    setScreen('active-call');
  };

  const endCall = () => {
    setIsCalling(false);
    setScreen('post-call');
  };

  const handleSaveLead = async () => {
    if (!newName.trim()) {
      Alert.alert('Validation Error', 'Please enter a lead name.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
          source: newSource,
          status: 'new',
          ownerId: 'agent-1',
        }),
      });
      const data = await res.json() as LeadResponse;
      if (data.success && data.data) {
        const createdLead = data.data;
        Alert.alert('Success', 'Lead created in CRM backend!');
        setLeads(prev => [createdLead, ...prev]);
        setNewName('');
        setNewPhone('');
        setNewEmail('');
        setScreen('home');
      } else {
        Alert.alert('Error', data.message || 'Failed to create lead');
      }
    } catch {
      // Local fallback
      const localLead = {
        id: `TRH-${Date.now().toString().slice(-5)}`,
        name: newName.trim(),
        phone: newPhone.trim(),
        status: 'Hot',
        concern: 'Mobile Enquiry',
      };
      setLeads(prev => [localLead, ...prev]);
      Alert.alert('Saved', 'Lead added locally.');
      setScreen('home');
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b2545" />

      {/* TOPBAR */}
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <View style={styles.logoBadge}><Text style={styles.logoText}>T</Text></View>
          <Text style={styles.brandTitle}>TRH360 CRM</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setScreen('add-lead')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* SCREEN ROUTER */}
      {screen === 'home' && (
        <ScrollView style={styles.content}>
          <View style={styles.alertBanner}>
            <Text style={styles.alertTitle}>⚡ SLA Alert</Text>
            <Text style={styles.alertDesc}>3 calls need immediate follow-up</Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>{leads.length}</Text>
              <Text style={styles.metricLabel}>Total Leads</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>14</Text>
              <Text style={styles.metricLabel}>Calls Due</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>86%</Text>
              <Text style={styles.metricLabel}>SLA Score</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Priority Queue</Text>
          {leads.map((item, index) => (
            <TouchableOpacity
              key={item.id || index}
              style={styles.leadCard}
              onPress={() => { setSelectedLead(item); setScreen('lead-360'); }}
            >
              <View style={styles.leadInfo}>
                <Text style={styles.leadName}>{item.name}</Text>
                <Text style={styles.leadPhone}>{item.phone || 'No phone'}</Text>
                <Text style={styles.leadConcern}>{item.concern || item.source || 'Inbound'}</Text>
              </View>
              <View style={styles.leadActionCol}>
                <View style={[styles.tempBadge, item.status === 'Hot' ? styles.badgeHot : styles.badgeWarm]}>
                  <Text style={styles.tempText}>{item.status || 'Hot'}</Text>
                </View>
                <TouchableOpacity style={styles.callCircleBtn} onPress={() => startCall(item)}>
                  <Text style={styles.callCircleText}>📞</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {screen === 'lead-360' && (
        <ScrollView style={styles.content}>
          <TouchableOpacity onPress={() => setScreen('home')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back to My Day</Text>
          </TouchableOpacity>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>{selectedLead?.name}</Text>
            <Text style={styles.detailPhone}>{selectedLead?.phone}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.tempBadge, styles.badgeHot]}><Text style={styles.tempText}>Hot Intent · 86</Text></View>
            </View>
            <Text style={styles.detailMeta}>Status: {selectedLead?.status || 'Qualified'}</Text>
            <Text style={styles.detailMeta}>Source: {selectedLead?.source || 'Google Search'}</Text>
          </View>

          <TouchableOpacity style={styles.primaryActionBtn} onPress={() => startCall(selectedLead)}>
            <Text style={styles.primaryActionText}>📞 Call Lead Now</Text>
          </TouchableOpacity>

          <View style={styles.timelineBox}>
            <Text style={styles.timelineHeader}>AI Journey Timeline</Text>
            <Text style={styles.timelineItem}>• Meaningful Call - 4m 38s (Pricing discussed)</Text>
            <Text style={styles.timelineItem}>• WhatsApp Delivered - Pricing proposal sent</Text>
            <Text style={styles.timelineItem}>• Meeting Booked - Saturday 11:30 AM</Text>
          </View>
        </ScrollView>
      )}

      {screen === 'active-call' && (
        <View style={styles.activeCallShell}>
          <Text style={styles.activeCallRecording}>● Recording with consent</Text>
          <Text style={styles.activeCallName}>{selectedLead?.name}</Text>
          <Text style={styles.activeCallMeta}>{selectedLead?.phone}</Text>
          <Text style={styles.activeCallTimer}>{formatTime(callSeconds)}</Text>

          <View style={styles.liveNotesBox}>
            <Text style={styles.liveNotesTitle}>AI Live Notes</Text>
            <Text style={styles.liveNotesText}>Customer discussing enterprise rollout and implementation cost. Decision-maker: Priya.</Text>
          </View>

          <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
            <Text style={styles.endCallText}>End Call ☎</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === 'post-call' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionHeader}>Post-Call AI Review</Text>
          <View style={styles.detailCard}>
            <Text style={styles.detailMeta}>Duration: {formatTime(callSeconds)}</Text>
            <Text style={styles.detailMeta}>Call Outcome: Connected · Positive</Text>
            <Text style={styles.liveNotesTitle}>Extracted Remark:</Text>
            <TextInput
              style={styles.textArea}
              multiline
              defaultValue="High intent for CRM rollout. Solution review confirmed for Saturday 11:30 AM."
            />
          </View>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={() => { Alert.alert('Saved', 'Call attached to Lead 360'); setScreen('home'); }}>
            <Text style={styles.primaryActionText}>✓ Confirm & Attach to CRM</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {screen === 'add-lead' && (
        <ScrollView style={styles.content}>
          <TouchableOpacity onPress={() => setScreen('home')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.sectionHeader}>Create New Lead</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} placeholder="e.g. Ramesh Reddy" value={newName} onChangeText={setNewName} />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} placeholder="+91 98000 00000" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />

            <Text style={styles.label}>Email Address</Text>
            <TextInput style={styles.input} placeholder="ramesh@example.com" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Lead Source</Text>
            <TextInput style={styles.input} value={newSource} onChangeText={setNewSource} />
          </View>

          <TouchableOpacity style={styles.primaryActionBtn} onPress={handleSaveLead}>
            <Text style={styles.primaryActionText}>Save Lead to CRM</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setScreen('home')}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navLabel}>My Day</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setScreen('add-lead')}>
          <Text style={styles.navIcon}>➕</Text>
          <Text style={styles.navLabel}>Add Lead</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  topbar: { backgroundColor: '#0b2545', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logoBadge: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#d09a26', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoText: { color: '#0b2545', fontWeight: 'bold', fontSize: 18 },
  brandTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  addBtn: { backgroundColor: '#d09a26', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { color: '#0b2545', fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  alertBanner: { backgroundColor: '#fef3c7', borderColor: '#d09a26', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 16 },
  alertTitle: { color: '#92400e', fontWeight: 'bold', fontSize: 14 },
  alertDesc: { color: '#b45309', fontSize: 13, marginTop: 2 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metricCard: { flex: 1, backgroundColor: '#ffffff', padding: 14, borderRadius: 10, marginHorizontal: 4, alignItems: 'center', elevation: 1 },
  metricVal: { fontSize: 20, fontWeight: 'bold', color: '#0b2545' },
  metricLabel: { fontSize: 11, color: '#64748b', marginTop: 4 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  leadCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', elevation: 1 },
  leadInfo: { flex: 1 },
  leadName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  leadPhone: { fontSize: 13, color: '#64748b', marginTop: 2 },
  leadConcern: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  leadActionCol: { alignItems: 'flex-end', justifyContent: 'space-between' },
  tempBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeHot: { backgroundColor: '#fee2e2' },
  badgeWarm: { backgroundColor: '#fef3c7' },
  tempText: { fontSize: 11, fontWeight: 'bold', color: '#991b1b' },
  callCircleBtn: { backgroundColor: '#10b981', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  callCircleText: { fontSize: 16 },
  backButton: { marginBottom: 16 },
  backButtonText: { color: '#0b2545', fontWeight: 'bold', fontSize: 14 },
  detailCard: { backgroundColor: '#ffffff', padding: 18, borderRadius: 12, marginBottom: 16 },
  detailTitle: { fontSize: 20, fontWeight: 'bold', color: '#0b2545' },
  detailPhone: { fontSize: 14, color: '#64748b', marginTop: 4 },
  badgeRow: { marginVertical: 8 },
  detailMeta: { fontSize: 13, color: '#475569', marginTop: 4 },
  primaryActionBtn: { backgroundColor: '#0b2545', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  primaryActionText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  timelineBox: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12 },
  timelineHeader: { fontSize: 14, fontWeight: 'bold', color: '#0b2545', marginBottom: 10 },
  timelineItem: { fontSize: 13, color: '#475569', marginVertical: 4 },
  activeCallShell: { flex: 1, backgroundColor: '#0b2545', alignItems: 'center', justifyContent: 'center', padding: 24 },
  activeCallRecording: { color: '#ef4444', fontSize: 13, fontWeight: 'bold', marginBottom: 20 },
  activeCallName: { color: '#ffffff', fontSize: 26, fontWeight: 'bold' },
  activeCallMeta: { color: '#94a3b8', fontSize: 16, marginTop: 4 },
  activeCallTimer: { color: '#d09a26', fontSize: 44, fontWeight: 'bold', marginVertical: 30 },
  liveNotesBox: { backgroundColor: 'rgba(255,255,255,0.08)', padding: 16, borderRadius: 12, width: '100%', marginBottom: 40 },
  liveNotesTitle: { color: '#93c5fd', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  liveNotesText: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  endCallButton: { backgroundColor: '#dc2626', paddingVertical: 14, paddingHorizontal: 36, borderRadius: 30 },
  endCallText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  formGroup: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#f8fafc' },
  textArea: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, height: 80, textAlignVertical: 'top', marginTop: 8 },
  bottomNav: { height: 60, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
});
