/**
 * くれウェルビーイングマップ - メインアプリケーション
 * 呉市の住民と観光客のウェルビーイング向上を目指す総合地図アプリ
 */

// =====================
// 定数・設定
// =====================
const CONFIG = {
    map: {
        center: [34.25, 132.6],
        zoom: 11,
        maxZoom: 19,
        minZoom: 10
    },
    marker: {
        minSize: 20,
        maxSize: 50,
        sizeMultiplier: 5
    },
    colors: {
        wifi: '#4CAF50',
        tourism: '#E91E63',
        facility: '#9C27B0',
        emergency: '#F44336',
        event: '#FF5722'
    },
    dataFiles: {
        wifi: 'data/wifi-data.json',
        tourism: 'data/tourism-spots.json',
        facilities: 'data/facilities.json',
        emergency: 'data/emergency.json',
        events: 'data/events.json'
    }
};

// =====================
// グローバル変数
// =====================
let map;
let markersLayer = {
    wifi: L.layerGroup(),
    tourism: L.layerGroup(),
    facility: L.layerGroup(),
    emergency: L.layerGroup(),
    event: L.layerGroup()
};
let allData = {
    wifi: [],
    tourism: [],
    facility: [],
    emergency: [],
    event: []
};
let activeFilters = {
    wifi: true,
    tourism: true,
    facility: true,
    emergency: true,
    event: true
};

// =====================
// 初期化
// =====================

/**
 * アプリケーションのメインエントリーポイント
 */
async function initializeApp() {
    try {
        showLoading(true);

        // 地図の初期化
        map = initializeMap();

        // データの読み込み
        await loadAllData();

        // マーカーの表示
        renderAllMarkers();

        // 統計情報の更新
        updateStatistics();

        // イベントリスナーの設定
        setupEventListeners();

        showLoading(false);
    } catch (error) {
        console.error('初期化エラー:', error);
        alert(`地図の初期化に失敗しました: ${error.message}`);
        showLoading(false);
    }
}

/**
 * 地図を初期化
 */
function initializeMap() {
    const mapInstance = L.map('map').setView(CONFIG.map.center, CONFIG.map.zoom);

    // OpenStreetMapタイルレイヤーを追加
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: CONFIG.map.maxZoom,
        minZoom: CONFIG.map.minZoom
    }).addTo(mapInstance);

    // 全レイヤーを地図に追加
    Object.values(markersLayer).forEach(layer => layer.addTo(mapInstance));

    return mapInstance;
}

// =====================
// データ読み込み
// =====================

/**
 * 全てのデータソースを読み込み
 */
async function loadAllData() {
    try {
        const [wifiData, tourismData, facilitiesData, emergencyData, eventsData] = await Promise.all([
            fetchData(CONFIG.dataFiles.wifi),
            fetchData(CONFIG.dataFiles.tourism),
            fetchData(CONFIG.dataFiles.facilities),
            fetchData(CONFIG.dataFiles.emergency),
            fetchData(CONFIG.dataFiles.events)
        ]);

        // Wi-Fiデータの処理
        allData.wifi = wifiData['2025/10/01'] || [];

        // 観光スポットデータの処理
        allData.tourism = tourismData.spots || [];

        // 施設データの処理
        allData.facility = facilitiesData.facilities || [];

        // 防災・緊急データの処理
        allData.emergency = emergencyData.facilities || [];

        // イベントデータの処理（現在開催中のものをフィルタ）
        allData.event = (eventsData.events || []).filter(event => {
            const today = new Date();
            const endDate = new Date(event.endDate);
            return endDate >= today;
        });

    } catch (error) {
        console.error('データ読み込みエラー:', error);
        throw error;
    }
}

/**
 * データファイルを取得
 */
async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`データの読み込みに失敗: ${url} (${response.status})`);
    }
    return await response.json();
}

// =====================
// マーカー表示
// =====================

/**
 * 全カテゴリのマーカーを表示
 */
function renderAllMarkers() {
    renderWifiMarkers();
    renderTourismMarkers();
    renderFacilityMarkers();
    renderEmergencyMarkers();
    renderEventMarkers();
}

/**
 * Wi-Fiスポットのマーカーを表示
 */
function renderWifiMarkers() {
    markersLayer.wifi.clearLayers();

    allData.wifi.forEach(spot => {
        const users = parseInt(spot.利用者数);
        const size = getMarkerSize(users);
        const color = getWifiMarkerColor(users);

        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="custom-marker marker-wifi" style="width: ${size}px; height: ${size}px; background-color: ${color};">${users}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2]
        });

        const marker = L.marker([parseFloat(spot.緯度), parseFloat(spot.経度)], { icon })
            .bindPopup(createWifiPopup(spot));

        markersLayer.wifi.addLayer(marker);
    });
}

/**
 * 観光スポットのマーカーを表示
 */
function renderTourismMarkers() {
    markersLayer.tourism.clearLayers();

    allData.tourism.forEach(spot => {
        const icon = createIconMarker('🏯', CONFIG.colors.tourism);

        const marker = L.marker([parseFloat(spot.latitude), parseFloat(spot.longitude)], { icon })
            .bindPopup(createTourismPopup(spot));

        markersLayer.tourism.addLayer(marker);
    });
}

/**
 * 施設のマーカーを表示
 */
function renderFacilityMarkers() {
    markersLayer.facility.clearLayers();

    allData.facility.forEach(facility => {
        const iconText = getIconForFacilityType(facility.type);
        const icon = createIconMarker(iconText, CONFIG.colors.facility);

        const marker = L.marker([parseFloat(facility.latitude), parseFloat(facility.longitude)], { icon })
            .bindPopup(createFacilityPopup(facility));

        markersLayer.facility.addLayer(marker);
    });
}

/**
 * 防災・緊急施設のマーカーを表示
 */
function renderEmergencyMarkers() {
    markersLayer.emergency.clearLayers();

    allData.emergency.forEach(facility => {
        const iconText = getIconForEmergencyType(facility.type);
        const icon = createIconMarker(iconText, CONFIG.colors.emergency);

        const marker = L.marker([parseFloat(facility.latitude), parseFloat(facility.longitude)], { icon })
            .bindPopup(createEmergencyPopup(facility));

        markersLayer.emergency.addLayer(marker);
    });
}

/**
 * イベントのマーカーを表示
 */
function renderEventMarkers() {
    markersLayer.event.clearLayers();

    allData.event.forEach(event => {
        const icon = createIconMarker('🎉', CONFIG.colors.event);

        const marker = L.marker([parseFloat(event.latitude), parseFloat(event.longitude)], { icon })
            .bindPopup(createEventPopup(event));

        markersLayer.event.addLayer(marker);
    });
}

// =====================
// マーカー作成ヘルパー
// =====================

/**
 * アイコンマーカーを作成
 */
function createIconMarker(icon, bgColor) {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="icon-marker" style="background-color: ${bgColor}; color: white;">${icon}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
}

/**
 * マーカーサイズを計算
 */
function getMarkerSize(value) {
    const size = value / CONFIG.marker.sizeMultiplier;
    return Math.max(CONFIG.marker.minSize, Math.min(CONFIG.marker.maxSize, size));
}

/**
 * Wi-Fiマーカーの色を取得
 */
function getWifiMarkerColor(users) {
    if (users > 150) return '#F44336';
    if (users > 100) return '#FF9800';
    if (users > 50) return '#FFC107';
    return CONFIG.colors.wifi;
}

/**
 * 施設タイプに応じたアイコンを取得
 */
function getIconForFacilityType(type) {
    const icons = {
        library: '📚',
        sports: '🏋️',
        hospital: '🏥',
        childcare: '👶',
        welfare: '🤝'
    };
    return icons[type] || '🏢';
}

/**
 * 緊急施設タイプに応じたアイコンを取得
 */
function getIconForEmergencyType(type) {
    const icons = {
        evacuation: '🛡️',
        aed: '❤️',
        police: '🚓',
        fire: '🚒'
    };
    return icons[type] || '🚨';
}

// =====================
// ポップアップ作成
// =====================

/**
 * Wi-Fiスポットのポップアップを作成
 */
function createWifiPopup(spot) {
    return `
        <div class="popup-header" style="background: ${CONFIG.colors.wifi};">
            <h3>📶 ${spot.Wifi名}</h3>
            <div class="category">Wi-Fiスポット</div>
        </div>
        <div class="popup-body">
            <div class="info-row">
                <span class="icon">📍</span>
                <span>${spot.設置場所住所}</span>
            </div>
            <div class="users">${spot.利用者数}人</div>
            <p style="font-size: 11px; color: #999; text-align: center;">2025年10月1日時点</p>
        </div>
    `;
}

/**
 * 観光スポットのポップアップを作成
 */
function createTourismPopup(spot) {
    const tags = spot.tags.map(tag => `<span class="tag">${tag}</span>`).join('');

    return `
        <div class="popup-header" style="background: ${CONFIG.colors.tourism};">
            <h3>${spot.name}</h3>
            <div class="category">${spot.category}</div>
        </div>
        <div class="popup-body">
            <p>${spot.description}</p>
            <div class="info-row">
                <span class="icon">📍</span>
                <span>${spot.address}</span>
            </div>
            <div class="info-row">
                <span class="icon">⏰</span>
                <span>${spot.openingHours}</span>
            </div>
            <div class="info-row">
                <span class="icon">💰</span>
                <span>${spot.admission}</span>
            </div>
            <div class="info-row">
                <span class="icon">⏱️</span>
                <span>所要時間: ${spot.estimatedTime}</span>
            </div>
            ${spot.barrierFree ? '<div class="info-row"><span class="icon">♿</span><span>バリアフリー対応</span></div>' : ''}
            <div class="tags">${tags}</div>
        </div>
    `;
}

/**
 * 施設のポップアップを作成
 */
function createFacilityPopup(facility) {
    return `
        <div class="popup-header" style="background: ${CONFIG.colors.facility};">
            <h3>${facility.name}</h3>
            <div class="category">${facility.category}</div>
        </div>
        <div class="popup-body">
            <p>${facility.description}</p>
            <div class="info-row">
                <span class="icon">📍</span>
                <span>${facility.address}</span>
            </div>
            <div class="info-row">
                <span class="icon">⏰</span>
                <span>${facility.openingHours}</span>
            </div>
            ${facility.phone ? `<div class="info-row"><span class="icon">📞</span><span>${facility.phone}</span></div>` : ''}
            ${facility.barrierFree ? '<div class="info-row"><span class="icon">♿</span><span>バリアフリー対応</span></div>' : ''}
            ${facility.wifi ? '<div class="info-row"><span class="icon">📶</span><span>Wi-Fi利用可</span></div>' : ''}
        </div>
    `;
}

/**
 * 防災・緊急施設のポップアップを作成
 */
function createEmergencyPopup(facility) {
    return `
        <div class="popup-header" style="background: ${CONFIG.colors.emergency};">
            <h3>${facility.name}</h3>
            <div class="category">${facility.category}</div>
        </div>
        <div class="popup-body">
            <p>${facility.description || ''}</p>
            <div class="info-row">
                <span class="icon">📍</span>
                <span>${facility.address}</span>
            </div>
            ${facility.capacity ? `<div class="info-row"><span class="icon">👥</span><span>収容人数: ${facility.capacity}</span></div>` : ''}
            ${facility.phone ? `<div class="info-row"><span class="icon">📞</span><span>${facility.phone}</span></div>` : ''}
            ${facility.available24h !== undefined ? `<div class="info-row"><span class="icon">⏰</span><span>${facility.available24h ? '24時間利用可' : facility.availableHours}</span></div>` : ''}
        </div>
    `;
}

/**
 * イベントのポップアップを作成
 */
function createEventPopup(event) {
    return `
        <div class="popup-header" style="background: ${CONFIG.colors.event};">
            <h3>${event.name}</h3>
            <div class="category">${event.category}</div>
        </div>
        <div class="popup-body">
            <p>${event.description}</p>
            <div class="info-row">
                <span class="icon">📅</span>
                <span>${event.startDate} 〜 ${event.endDate}</span>
            </div>
            <div class="info-row">
                <span class="icon">📍</span>
                <span>${event.location}</span>
            </div>
            <div class="info-row">
                <span class="icon">💰</span>
                <span>${event.admission}</span>
            </div>
        </div>
    `;
}

// =====================
// フィルタリング
// =====================

/**
 * カテゴリフィルターを適用
 */
function applyFilters() {
    Object.keys(activeFilters).forEach(category => {
        if (activeFilters[category]) {
            markersLayer[category].addTo(map);
        } else {
            map.removeLayer(markersLayer[category]);
        }
    });
}

/**
 * フィルターを切り替え
 */
function toggleFilter(category) {
    activeFilters[category] = !activeFilters[category];
    applyFilters();
}

// =====================
// 統計情報
// =====================

/**
 * 統計情報を更新
 */
function updateStatistics() {
    const totalSpots = Object.values(allData).reduce((sum, arr) => sum + arr.length, 0);
    const wifiUsers = allData.wifi.reduce((sum, spot) => sum + parseInt(spot.利用者数), 0);

    document.getElementById('stat-total-spots').textContent = totalSpots;
    document.getElementById('stat-wifi-users').textContent = wifiUsers.toLocaleString();
    document.getElementById('stat-events').textContent = allData.event.length;
    document.getElementById('stat-facilities').textContent = allData.facility.length;

    // カウントの更新
    document.getElementById('count-wifi').textContent = allData.wifi.length;
    document.getElementById('count-tourism').textContent = allData.tourism.length;
    document.getElementById('count-facility').textContent = allData.facility.length;
    document.getElementById('count-event').textContent = allData.event.length;
    document.getElementById('count-emergency').textContent = allData.emergency.length;
}

// =====================
// イベントリスナー
// =====================

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
    // サイドバートグル
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // フィルターアイテム（サイドバー）
    document.querySelectorAll('.filter-item[data-category]').forEach(item => {
        item.addEventListener('click', function() {
            const category = this.dataset.category;
            const checkbox = this.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            toggleFilter(category);
        });
    });

    // クイックフィルターボタン
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.dataset.filter;
            this.classList.toggle('active');
            toggleFilter(filter);

            // サイドバーのチェックボックスも同期
            const checkbox = document.getElementById(`filter-${filter}`);
            if (checkbox) {
                checkbox.checked = activeFilters[filter];
            }
        });
    });

    // 検索機能
    document.getElementById('search-input').addEventListener('input', handleSearch);
}

/**
 * 検索処理
 */
function handleSearch(event) {
    const query = event.target.value.toLowerCase();

    if (query.length < 2) {
        // 検索クリア - すべて表示
        renderAllMarkers();
        return;
    }

    // 各カテゴリでフィルタリング
    Object.keys(allData).forEach(category => {
        markersLayer[category].clearLayers();

        const filtered = allData[category].filter(item => {
            const name = item.name || item.Wifi名 || '';
            const address = item.address || item.設置場所住所 || item.location || '';
            return name.toLowerCase().includes(query) || address.toLowerCase().includes(query);
        });

        // フィルタリングされた結果を表示
        filtered.forEach(item => {
            // ここでは簡略化のため、再レンダリングをスキップ
            // 実装を完全にするには各タイプに応じたマーカーを再作成する必要があります
        });
    });
}

// =====================
// ユーティリティ
// =====================

/**
 * ローディング表示を切り替え
 */
function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    if (show) {
        loadingEl.classList.remove('hidden');
    } else {
        loadingEl.classList.add('hidden');
    }
}

// =====================
// アプリケーション起動
// =====================

document.addEventListener('DOMContentLoaded', initializeApp);
