/**
 * くれウェルビーイングマップ v2.1 - Phase 2対応
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
        events: 'data/events.json',
        routes: 'data/routes.json',
        crowding: 'data/crowding-data.json'
    },
    weather: {
        // サンプル天気データ（実際はAPIから取得）
        apiEnabled: false
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
    event: [],
    routes: [],
    crowding: []
};
let activeFilters = {
    wifi: true,
    tourism: true,
    facility: true,
    emergency: true,
    event: true
};

// Phase 2: 新機能用の変数
let currentRoute = null;
let routePolyline = null;
let routeMarkers = [];
let heatmapLayer = null;
let favorites = [];

// =====================
// 初期化
// =====================

/**
 * アプリケーションのメインエントリーポイント
 */
async function initializeApp() {
    try {
        showLoading(true);

        // LocalStorageからお気に入りを読み込み
        loadFavoritesFromStorage();

        // 地図の初期化
        map = initializeMap();

        // データの読み込み
        await loadAllData();

        // マーカーの表示
        renderAllMarkers();

        // ルートの表示
        renderRoutes();

        // 統計情報の更新
        updateStatistics();

        // 天気情報の表示
        displayWeatherInfo();

        // お気に入りの表示
        renderFavorites();

        // イベントリスナーの設定
        setupEventListeners();

        // シェアモーダルの追加
        createShareModal();

        // ルートコントロールの追加
        createRouteControls();

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
        const [wifiData, tourismData, facilitiesData, emergencyData, eventsData, routesData, crowdingData] = await Promise.all([
            fetchData(CONFIG.dataFiles.wifi),
            fetchData(CONFIG.dataFiles.tourism),
            fetchData(CONFIG.dataFiles.facilities),
            fetchData(CONFIG.dataFiles.emergency),
            fetchData(CONFIG.dataFiles.events),
            fetchData(CONFIG.dataFiles.routes),
            fetchData(CONFIG.dataFiles.crowding)
        ]);

        allData.wifi = wifiData['2025/10/01'] || [];
        allData.tourism = tourismData.spots || [];
        allData.facility = facilitiesData.facilities || [];
        allData.emergency = emergencyData.facilities || [];
        allData.event = (eventsData.events || []).filter(event => {
            const today = new Date();
            const endDate = new Date(event.endDate);
            return endDate >= today;
        });
        allData.routes = routesData.routes || [];
        allData.crowding = crowdingData.facilities || [];

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
// Phase 2: ルート機能
// =====================

/**
 * ルート一覧を表示
 */
function renderRoutes() {
    const container = document.getElementById('routes-container');
    container.innerHTML = '';

    allData.routes.forEach(route => {
        const routeItem = document.createElement('div');
        routeItem.className = 'route-item';
        routeItem.dataset.routeId = route.id;
        routeItem.innerHTML = `
            <span class="icon">${route.icon}</span>
            <div class="route-info">
                <div class="route-name">${route.name}</div>
                <div class="route-details">${route.duration} | ${route.distance}</div>
            </div>
        `;

        routeItem.addEventListener('click', () => showRoute(route));
        container.appendChild(routeItem);
    });
}

/**
 * ルートをマップ上に表示
 */
function showRoute(route) {
    // 既存のルートをクリア
    clearRoute();

    // ルートをアクティブに設定
    currentRoute = route;

    // UIの更新
    document.querySelectorAll('.route-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-route-id="${route.id}"]`).classList.add('active');

    // ポリラインを描画
    routePolyline = L.polyline(route.polyline, {
        color: route.color,
        weight: 5,
        opacity: 0.7,
        smoothFactor: 1
    }).addTo(map);

    // ウェイポイントマーカーを追加
    route.waypoints.forEach((waypoint, index) => {
        const marker = L.marker([waypoint.latitude, waypoint.longitude], {
            icon: L.divIcon({
                className: 'route-waypoint-marker',
                html: `<div style="background: ${route.color}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${index + 1}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).bindPopup(createRouteWaypointPopup(waypoint)).addTo(map);

        routeMarkers.push(marker);
    });

    // ルートにフィット
    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });

    // ルートコントロールを表示
    showRouteControls(route);
}

/**
 * ルートをクリア
 */
function clearRoute() {
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }

    routeMarkers.forEach(marker => map.removeLayer(marker));
    routeMarkers = [];

    currentRoute = null;

    document.querySelectorAll('.route-item').forEach(item => {
        item.classList.remove('active');
    });

    hideRouteControls();
}

/**
 * ルートコントロールを作成
 */
function createRouteControls() {
    const controls = document.createElement('div');
    controls.className = 'route-controls';
    controls.id = 'route-controls';
    controls.innerHTML = `
        <span class="route-name-display"></span>
        <button id="clear-route-btn">ルートを消去</button>
    `;
    document.getElementById('map-container').appendChild(controls);

    document.getElementById('clear-route-btn').addEventListener('click', clearRoute);
}

/**
 * ルートコントロールを表示
 */
function showRouteControls(route) {
    const controls = document.getElementById('route-controls');
    controls.querySelector('.route-name-display').textContent = route.name;
    controls.classList.add('show');
}

/**
 * ルートコントロールを非表示
 */
function hideRouteControls() {
    document.getElementById('route-controls').classList.remove('show');
}

/**
 * ルートウェイポイントのポップアップを作成
 */
function createRouteWaypointPopup(waypoint) {
    return `
        <div class="route-waypoint-popup">
            <h4>${waypoint.name}</h4>
            <p>${waypoint.description}</p>
            ${waypoint.stayDuration ? `<span class="stay-duration">滞在時間: ${waypoint.stayDuration}分</span>` : ''}
        </div>
    `;
}

// =====================
// Phase 2: ヒートマップ機能
// =====================

/**
 * ヒートマップを表示/非表示
 */
function toggleHeatmap() {
    if (heatmapLayer) {
        // 既に表示されている場合は削除
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
        return;
    }

    // ヒートマップデータを準備
    const heatData = allData.crowding.map(facility => {
        return [
            parseFloat(facility.latitude),
            parseFloat(facility.longitude),
            facility.crowdingLevel / 100
        ];
    });

    // ヒートマップレイヤーを作成
    heatmapLayer = L.heatLayer(heatData, {
        radius: 40,
        blur: 50,
        maxZoom: 15,
        max: 1.0,
        gradient: {
            0.0: '#4CAF50',
            0.5: '#FFC107',
            0.7: '#FF9800',
            1.0: '#F44336'
        }
    }).addTo(map);
}

// =====================
// Phase 2: お気に入り機能
// =====================

/**
 * LocalStorageからお気に入りを読み込み
 */
function loadFavoritesFromStorage() {
    const stored = localStorage.getItem('kure-map-favorites');
    if (stored) {
        try {
            favorites = JSON.parse(stored);
        } catch (e) {
            favorites = [];
        }
    }
}

/**
 * お気に入りをLocalStorageに保存
 */
function saveFavoritesToStorage() {
    localStorage.setItem('kure-map-favorites', JSON.stringify(favorites));
}

/**
 * お気に入りに追加/削除
 */
function toggleFavorite(item) {
    const index = favorites.findIndex(fav => fav.id === item.id && fav.category === item.category);

    if (index >= 0) {
        // 削除
        favorites.splice(index, 1);
    } else {
        // 追加
        favorites.push({
            id: item.id,
            category: item.category,
            name: item.name || item.Wifi名,
            latitude: item.latitude || item.緯度,
            longitude: item.longitude || item.経度
        });
    }

    saveFavoritesToStorage();
    renderFavorites();
}

/**
 * お気に入り一覧を表示
 */
function renderFavorites() {
    const container = document.getElementById('favorites-container');

    if (favorites.length === 0) {
        container.innerHTML = '<p class="empty-state">お気に入りはまだありません</p>';
        return;
    }

    container.innerHTML = '';
    favorites.forEach(fav => {
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
            <div class="favorite-item-info">
                <div class="favorite-item-name">${fav.name}</div>
                <div class="favorite-item-category">${fav.category}</div>
            </div>
            <button class="favorite-btn active" onclick="removeFavorite('${fav.id}', '${fav.category}')">⭐</button>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('favorite-btn')) {
                map.setView([parseFloat(fav.latitude), parseFloat(fav.longitude)], 15);
            }
        });

        container.appendChild(item);
    });
}

/**
 * お気に入りを削除
 */
function removeFavorite(id, category) {
    favorites = favorites.filter(fav => !(fav.id === id && fav.category === category));
    saveFavoritesToStorage();
    renderFavorites();
}

// =====================
// Phase 2: SNSシェア機能
// =====================

/**
 * シェアモーダルを作成
 */
function createShareModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'share-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📤 シェア</h3>
                <button class="modal-close">&times;</button>
            </div>
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                くれウェルビーイングマップをシェアしましょう！
            </p>
            <div class="share-buttons">
                <button class="share-button twitter" onclick="shareToTwitter()">
                    🐦 Twitter
                </button>
                <button class="share-button facebook" onclick="shareToFacebook()">
                    📘 Facebook
                </button>
                <button class="share-button line" onclick="shareToLine()">
                    💬 LINE
                </button>
                <button class="share-button copy" onclick="copyToClipboard()">
                    📋 URLコピー
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // モーダルを閉じる
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.remove('show');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
}

/**
 * シェアモーダルを表示
 */
function showShareModal() {
    document.getElementById('share-modal').classList.add('show');
}

/**
 * Twitterにシェア
 */
function shareToTwitter() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent('くれウェルビーイングマップ - 呉市の総合地図アプリ');
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
}

/**
 * Facebookにシェア
 */
function shareToFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

/**
 * LINEにシェア
 */
function shareToLine() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent('くれウェルビーイングマップ');
    window.open(`https://social-plugins.line.me/lineit/share?url=${url}&text=${text}`, '_blank');
}

/**
 * URLをクリップボードにコピー
 */
function copyToClipboard() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('URLをコピーしました！');
    }).catch(() => {
        alert('コピーに失敗しました');
    });
}

// =====================
// Phase 2: 天気情報機能
// =====================

/**
 * 天気情報を表示（サンプルデータ）
 */
function displayWeatherInfo() {
    const weatherContainer = document.getElementById('weather-info');

    // サンプルデータ（実際はAPIから取得）
    const weatherData = {
        temp: 18,
        description: '晴れ',
        icon: '☀️',
        humidity: 65,
        wind: '3m/s'
    };

    weatherContainer.innerHTML = `
        <div class="weather-main">
            <div class="weather-icon">${weatherData.icon}</div>
            <div class="weather-temp">${weatherData.temp}°</div>
        </div>
        <div class="weather-description">${weatherData.description}</div>
        <div class="weather-details">
            <div class="weather-detail-item">
                <span>湿度</span>
                <span>${weatherData.humidity}%</span>
            </div>
            <div class="weather-detail-item">
                <span>風速</span>
                <span>${weatherData.wind}</span>
            </div>
        </div>
    `;
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
    const isFavorite = favorites.some(fav => fav.id === spot.Wifi名 && fav.category === 'wifi');

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
        <div class="popup-footer">
            <button class="btn favorite-btn ${isFavorite ? 'active' : ''}" onclick="toggleFavoriteFromPopup('wifi', '${spot.Wifi名}', ${spot.緯度}, ${spot.経度})">${isFavorite ? '⭐' : '☆'} お気に入り</button>
        </div>
    `;
}

/**
 * 観光スポットのポップアップを作成
 */
function createTourismPopup(spot) {
    const tags = spot.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    const isFavorite = favorites.some(fav => fav.id === spot.id && fav.category === 'tourism');

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
        <div class="popup-footer">
            <button class="btn favorite-btn ${isFavorite ? 'active' : ''}" onclick="toggleFavoriteFromPopup('tourism', '${spot.id}', ${spot.latitude}, ${spot.longitude})">${isFavorite ? '⭐' : '☆'} お気に入り</button>
        </div>
    `;
}

/**
 * 施設のポップアップを作成
 */
function createFacilityPopup(facility) {
    const isFavorite = favorites.some(fav => fav.id === facility.id && fav.category === 'facility');

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
        <div class="popup-footer">
            <button class="btn favorite-btn ${isFavorite ? 'active' : ''}" onclick="toggleFavoriteFromPopup('facility', '${facility.id}', ${facility.latitude}, ${facility.longitude})">${isFavorite ? '⭐' : '☆'} お気に入り</button>
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

/**
 * ポップアップからお気に入りを切り替え
 */
function toggleFavoriteFromPopup(category, id, latitude, longitude) {
    const item = {
        id: id,
        category: category,
        name: id,
        latitude: latitude,
        longitude: longitude
    };

    toggleFavorite(item);

    // ポップアップを閉じて再表示
    map.closePopup();
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
    const totalSpots = Object.values(allData).slice(0, 5).reduce((sum, arr) => sum + arr.length, 0);
    const wifiUsers = allData.wifi.reduce((sum, spot) => sum + parseInt(spot.利用者数), 0);

    document.getElementById('stat-total-spots').textContent = totalSpots;
    document.getElementById('stat-wifi-users').textContent = wifiUsers.toLocaleString();
    document.getElementById('stat-events').textContent = allData.event.length;
    document.getElementById('stat-facilities').textContent = allData.facility.length;

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

            if (filter === 'heatmap') {
                // ヒートマップの切り替え
                this.classList.toggle('active');
                toggleHeatmap();
            } else {
                // 通常のフィルター
                this.classList.toggle('active');
                toggleFilter(filter);

                // サイドバーのチェックボックスも同期
                const checkbox = document.getElementById(`filter-${filter}`);
                if (checkbox) {
                    checkbox.checked = activeFilters[filter];
                }
            }
        });
    });

    // 検索機能
    document.getElementById('search-input').addEventListener('input', handleSearch);

    // シェアボタン
    document.getElementById('share-btn').addEventListener('click', showShareModal);
}

/**
 * 検索処理
 */
function handleSearch(event) {
    const query = event.target.value.toLowerCase();

    if (query.length < 2) {
        renderAllMarkers();
        return;
    }

    // 検索結果を表示
    // （簡略版 - 実装を完全にするには各カテゴリ毎に再レンダリング）
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
