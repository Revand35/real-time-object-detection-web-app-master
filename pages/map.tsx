import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { subscribeDetections, DetectedObject } from '../lib/detectionsBus';

// React port of map/map.html + a subset of map/index.js logic
// - Uses Leaflet + Leaflet Routing Machine via CDN
// - Tracks user location, lets you set destination (lat,lng), draws a route
// - Provides status panel, debug panel, and a permission flow

type LatLng = { lat: number; lng: number };

export default function MapReactPage() {
    const mapElRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const userMarkerRef = useRef<any>(null);
    const destMarkerRef = useRef<any>(null);
    const routeRef = useRef<any>(null);
    const watchIdRef = useRef<number | null>(null);

    const [statusText, setStatusText] = useState('Waiting for location...');
    const [coordinatesText, setCoordinatesText] = useState('Lat: -, Lng: -');
    const [accuracyText, setAccuracyText] = useState('Accuracy: -');
    const [permissionOpen, setPermissionOpen] = useState(true);
    const [debugOpen, setDebugOpen] = useState(false);
    const [routePanelOpen, setRoutePanelOpen] = useState(false);
    const [statusPanelOpen, setStatusPanelOpen] = useState(true);
    const [destination, setDestination] = useState<LatLng | null>(null);
    const [alerts, setAlerts] = useState<string[]>([]);
    const [voiceStatus, setVoiceStatus] = useState<string>('Senavision siap. Ucapkan tujuan Anda.');
    const recognitionRef = useRef<any>(null);
    const isListeningRef = useRef<boolean>(false);

    const getL = () => (typeof window !== 'undefined' ? (window as any).L : null);

    // Initialize Leaflet map (wait for CDN scripts)
    useEffect(() => {
        if (!mapElRef.current || mapRef.current) return;

        const tryInit = () => {
            const L = getL();
            if (!L || !mapElRef.current || mapRef.current) return false;

            mapRef.current = L.map(mapElRef.current, {
                center: [3.59, 98.67],
                zoom: 15,
            });

            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            }).addTo(mapRef.current);
            return true;
        };

        if (!tryInit()) {
            const id = window.setInterval(() => {
                if (tryInit()) window.clearInterval(id);
            }, 100);
        }

        return () => {
            try {
                if (watchIdRef.current && navigator.geolocation) {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                }
                if (routeRef.current) {
                    mapRef.current.removeControl(routeRef.current);
                    routeRef.current = null;
                }
                if (mapRef.current) {
                    mapRef.current.remove();
                    mapRef.current = null;
                }
            } catch {}
        };
    }, []);

    // Start geolocation watcher after user permits
    useEffect(() => {
        const L = getL();
        if (!L || !mapRef.current || permissionOpen) return;

        if (!('geolocation' in navigator)) {
            setStatusText('Geolocation not supported');
            return;
        }

        setStatusText('Requesting location permission...');

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                setStatusText('Location acquired');
                setCoordinatesText(`Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`);
                setAccuracyText(`Accuracy: ${Math.round(accuracy)} m`);

                const latlng = L.latLng(latitude, longitude);

                if (userMarkerRef.current) userMarkerRef.current.setLatLng(latlng);
                else userMarkerRef.current = L.marker(latlng).addTo(mapRef.current);

                if (mapRef.current && !mapRef.current._hasCenteredOnce) {
                    mapRef.current.setView(latlng, 16);
                    mapRef.current._hasCenteredOnce = true;
                }

                if (destination) {
                    drawRoute(latlng, L.latLng(destination.lat, destination.lng));
                }
            },
            (err) => setStatusText(`Location error: ${err.message}`),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );
    }, [permissionOpen, destination]);

    function requestLocationPermission() {
        // Simply close the popup and let watchPosition prompt
        setPermissionOpen(false);
    }

    function setDestinationFromInput() {
        const input = document.getElementById('routeEndInput') as HTMLInputElement | null;
        if (!input || !input.value.trim()) return;
        const parts = input.value.split(',').map((s) => s.trim());
        if (parts.length !== 2) return;
        const lat = Number(parts[0]);
        const lng = Number(parts[1]);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;
        const L = getL();
        if (!L || !mapRef.current) return;

        const dest = { lat, lng };
        setDestination(dest);
        const destLatLng = L.latLng(lat, lng);
        if (destMarkerRef.current) destMarkerRef.current.setLatLng(destLatLng);
        else destMarkerRef.current = L.marker(destLatLng).addTo(mapRef.current);

        if (userMarkerRef.current) drawRoute(userMarkerRef.current.getLatLng(), destLatLng);
    }

    function drawRoute(start: any, end: any) {
        const L = getL();
        if (!L || !mapRef.current) return;
        try {
            if (routeRef.current) {
                mapRef.current.removeControl(routeRef.current);
                routeRef.current = null;
            }
            // @ts-ignore - L.Routing exists from CDN
            routeRef.current = (L as any).Routing.control({
                waypoints: [start, end],
                addWaypoints: false,
                draggableWaypoints: false,
                routeWhileDragging: false,
                fitSelectedRoutes: true,
                show: false,
            }).addTo(mapRef.current);
            try {
                routeRef.current.on('routesfound', (e: any) => {
                    const route = e?.routes?.[0];
                    const meters = route?.summary?.totalDistance;
                    const seconds = route?.summary?.totalTime;
                    if (typeof meters === 'number' && typeof seconds === 'number') {
                        const km = (meters / 1000).toFixed(1);
                        const mins = Math.round(seconds / 60);
                        speak(`Rute siap. Jarak ${km} kilometer, waktu sekitar ${mins} menit.`);
                    }
                });
            } catch {}
        } catch (e) {
            addDebug('error', 'Routing init failed', e);
        }
    }

    function toggleStatusPanel() {
        setStatusPanelOpen((v) => !v);
    }

    function toggleDebugPanel() {
        setDebugOpen((v) => !v);
    }

    function toggleRouteManagementPanel() {
        setRoutePanelOpen((v) => !v);
    }

    function addDebug(type: 'log' | 'info' | 'warn' | 'error', ...args: any[]) {
        if (!debugOpen) return;
        const box = document.getElementById('debugLogsBox');
        if (!box) return;
        const el = document.createElement('div');
        el.textContent = `[${type}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`;
        (el.style as any).fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        (el.style as any).fontSize = '12px';
        box.appendChild(el);
        box.scrollTop = box.scrollHeight;
    }

    // Subscribe to object detections and raise alerts for <2m
    useEffect(() => {
        const unsubscribe = subscribeDetections(({ items }) => {
            const closeObjects = items.filter((it: DetectedObject) =>
                typeof it.distanceMeters === 'number' && it.distanceMeters! < 2
            );
            if (closeObjects.length === 0) return;

            const labels = closeObjects
                .map((o) => `${o.label}${typeof o.distanceMeters === 'number' ? ` ${o.distanceMeters!.toFixed(1)}m` : ''}`)
                .join(', ');

            const message = `Hati-hati! Di depan ada: ${labels}`;
            setAlerts((prev) => [message, ...prev].slice(0, 5));
            speak(message);
        });
        return unsubscribe;
    }, []);

    function speak(text: string) {
        try {
            if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID';
            utterance.rate = 1.05;
            utterance.pitch = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        } catch {}
    }

    // Voice control: start/stop recognition
    function toggleVoiceListening() {
        if (isListeningRef.current) {
            try { recognitionRef.current?.stop?.(); } catch {}
            isListeningRef.current = false;
            setVoiceStatus('Mikrofon dimatikan.');
            return;
        }
        const SpeechRecognition: any = (typeof window !== 'undefined') && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
        if (!SpeechRecognition) {
            setVoiceStatus('Speech recognition tidak didukung browser ini.');
            return;
        }
        const recog = new SpeechRecognition();
        recog.lang = 'id-ID';
        recog.continuous = true;
        recog.interimResults = true;
        recog.onstart = () => setVoiceStatus('Mikrofon aktif. Ucapkan tujuan Anda.');
        recog.onerror = () => setVoiceStatus('Error mikrofon. Coba lagi.');
        recog.onend = () => { isListeningRef.current = false; setVoiceStatus('Mikrofon berhenti.'); };
        recog.onresult = (event: any) => {
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i];
                if (res.isFinal) finalText += res[0].transcript;
            }
            if (finalText) {
                const cmd = finalText.toLowerCase().trim();
                setVoiceStatus(`Saya dengar: "${cmd}"`);
                handleVoiceDestination(cmd);
            }
        };
        recognitionRef.current = recog;
        try { recog.start(); isListeningRef.current = true; } catch {}
    }

    // Parse spoken destination: "lat,lng" or place name → geocode
    async function handleVoiceDestination(text: string) {
        const parts = text.split(',').map((s) => s.trim());
        if (parts.length === 2) {
            const lat = Number(parts[0]);
            const lng = Number(parts[1]);
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                const L = getL();
                if (!L || !mapRef.current) return;
                setDestination({ lat, lng });
                const latlng = L.latLng(lat, lng);
                if (destMarkerRef.current) destMarkerRef.current.setLatLng(latlng);
                else destMarkerRef.current = L.marker(latlng).addTo(mapRef.current);
                if (userMarkerRef.current) drawRoute(userMarkerRef.current.getLatLng(), latlng);
                speak('Tujuan disetel. Menghitung rute.');
                return;
            }
        }
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1&countrycodes=id&accept-language=id`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                    const L = getL();
                    if (!L || !mapRef.current) return;
                    setDestination({ lat, lng });
                    const latlng = L.latLng(lat, lng);
                    if (destMarkerRef.current) destMarkerRef.current.setLatLng(latlng);
                    else destMarkerRef.current = L.marker(latlng).addTo(mapRef.current);
                    if (userMarkerRef.current) drawRoute(userMarkerRef.current.getLatLng(), latlng);
                    speak('Tujuan ditemukan. Menghitung rute.');
                    return;
                }
            }
            speak('Tujuan tidak ditemukan. Coba sebutkan nama lokasi lain.');
        } catch {
            speak('Terjadi kesalahan saat mencari lokasi.');
        }
    }

    return (
        <>
            <Head>
                <title>Live Location Tracker with Route (React)</title>
            </Head>

            {/* JS libs via next/script */}
            <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" strategy="afterInteractive" />
            <Script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js" strategy="afterInteractive" />

            {/* Map container */}
            <div id="map" ref={mapElRef} style={{ height: '100vh', width: '100%' }} />

            {/* Permission popup */}
            {permissionOpen && (
                <div id="permissionPopup" className="permission-popup">
                    <div className="permission-content">
                        <div className="permission-icon">📍</div>
                        <h2>Akses Lokasi Diperlukan</h2>
                        <p>Aplikasi ini memerlukan akses ke lokasi Anda untuk menampilkan data realtime.</p>
                        <button id="requestPermissionBtn" onClick={requestLocationPermission} className="permission-btn">Berikan Akses Lokasi</button>
                        <p className="permission-hint">Setelah mengklik, browser akan meminta izin akses lokasi</p>
                    </div>
                </div>
            )}

            {/* Buttons */}
            <button id="debugToggleBtn" className="debug-toggle-btn" onClick={toggleDebugPanel} title="Toggle Debug Console">{debugOpen ? '✖️ Tutup' : '🐛 Debug'}</button>
            <button id="routeManagementToggleBtn" className="route-management-toggle-btn" onClick={toggleRouteManagementPanel} title="Kelola Rute">🗺️ Kelola Rute</button>
            <button id="mobileToggleBtn" className="mobile-toggle-btn" onClick={toggleStatusPanel}>📍 Info Lokasi</button>

            {/* Status Panel */}
            <div id="statusPanel" className={`status-panel ${statusPanelOpen ? 'active' : ''}`} style={{ display: statusPanelOpen ? 'block' : undefined }}>
                <button id="closePanelBtn" className="close-panel-btn" onClick={toggleStatusPanel} style={{ display: 'none' }} aria-label="Tutup panel">✖️</button>
                <h3><span className="icon">📍</span> Track Your Location</h3>
                <p id="status">{statusText}</p>
                <p id="coordinates">{coordinatesText}</p>
                <p id="accuracy">{accuracyText}</p>
                <p className="voice-status-text">{voiceStatus}</p>

                <div className="route-info">
                    <h4>Live Route Tracking</h4>
                    <p>Shows route from your current location to destination</p>
                    <p className="route-update-info">Route updates automatically</p>
                </div>

                <div style={{ marginTop: 12 }}>
                    <input id="routeEndInput" placeholder="lat,lng (contoh: -6.2,106.8)" className="route-input" />
                    <button id="retryBtn" className="retry-button" onClick={setDestinationFromInput} style={{ display: 'flex', marginTop: 8, width: '100%' }}>
                        <span className="btn-icon">🎯</span>
                        <span>Set Destination</span>
                    </button>
                    <button onClick={toggleVoiceListening} className="retry-button" style={{ display: 'flex', marginTop: 8, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="btn-icon">🎤</span>
                        <span>{isListeningRef.current ? 'Matikan Mikrofon' : 'Aktifkan Mikrofon'}</span>
                    </button>
                </div>
            </div>

            {/* Debug Panel */}
            {debugOpen && (
                <div id="debugPanel" className="debug-panel active" style={{ display: 'flex' }}>
                    <button id="closeDebugBtn" className="close-panel-btn" onClick={toggleDebugPanel} aria-label="Tutup debug panel">✖️</button>
                    <div className="debug-header">
                        <h3><span className="icon">🐛</span> Debug Console</h3>
                        <div className="debug-controls">
                            <button className="clear-debug-btn" onClick={() => { const b = document.getElementById('debugLogsBox'); if (b) b.innerHTML = ''; }}>🗑️ Clear</button>
                            <button className="auto-scroll-btn active" disabled>📜 Auto</button>
                        </div>
                    </div>
                    <div id="debugLogsBox" className="debug-logs"><p className="debug-placeholder">Console logs will appear here...</p></div>
                </div>
            )}

            {/* Route Management Panel (UI shell only) */}
            {routePanelOpen && (
                <div id="routeManagementPanel" className="route-management-panel active" style={{ display: 'flex' }}>
                    <button id="closeRoutePanelBtn" className="close-panel-btn" onClick={toggleRouteManagementPanel} aria-label="Tutup panel rute">✖️</button>
                    <div className="route-panel-header">
                        <h3><span className="icon">🗺️</span> Kelola Rute</h3>
                        <button id="routePanelToggleBtn" className="route-toggle-btn" onClick={toggleRouteManagementPanel} title="Tutup/Buka panel">✖️</button>
                    </div>
                    <div className="route-panel-content">
                        <p className="route-panel-description">Atur slot rute untuk navigasi. (WIP)</p>
                        <div id="routeListContainer" className="route-list-container" />
                        <div id="routeFormContainer" className="route-form-container" style={{ display: 'none' }} />
                    </div>
                </div>
            )}

            {/* Proximity Alerts (latest 5) */}
            {alerts.length > 0 && (
                <div style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 1000, maxWidth: 360 }}>
                    {alerts.map((a, i) => (
                        <div key={i} style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'rgba(220,53,69,0.95)', color: '#fff', boxShadow: '0 6px 16px rgba(220,53,69,0.35)', fontWeight: 600 }}>
                            {a}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}


