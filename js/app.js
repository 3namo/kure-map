/**
 * くれまちWi-Fi利用者マップ - メインアプリケーション
 * 呉市のWi-Fiスポットデータを地図上に可視化します
 */

// 定数定義
const CONFIG = {
    map: {
        center: [34.25, 132.6],
        zoom: 11,
        maxZoom: 19
    },
    marker: {
        minSize: 20,
        maxSize: 50,
        sizeMultiplier: 5
    },
    colors: {
        green: '#4CAF50',   // 50人以下
        yellow: '#FFC107',  // 51-100人
        orange: '#FF9800',  // 101-150人
        red: '#F44336'      // 151人以上
    },
    dataDate: '2025/10/01'
};

/**
 * 地図を初期化する
 * @returns {L.Map} Leafletマップオブジェクト
 */
function initializeMap() {
    const map = L.map('map').setView(CONFIG.map.center, CONFIG.map.zoom);

    // OpenStreetMapタイルレイヤーを追加
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: CONFIG.map.maxZoom
    }).addTo(map);

    return map;
}

/**
 * 利用者数に応じたマーカーの色を取得
 * @param {number} users - 利用者数
 * @returns {string} カラーコード
 */
function getMarkerColor(users) {
    if (users > 150) return CONFIG.colors.red;
    if (users > 100) return CONFIG.colors.orange;
    if (users > 50) return CONFIG.colors.yellow;
    return CONFIG.colors.green;
}

/**
 * 利用者数に応じたマーカーのサイズを計算
 * @param {number} users - 利用者数
 * @returns {number} マーカーのサイズ（ピクセル）
 */
function getMarkerSize(users) {
    const size = users / CONFIG.marker.sizeMultiplier;
    return Math.max(
        CONFIG.marker.minSize,
        Math.min(CONFIG.marker.maxSize, size)
    );
}

/**
 * ポップアップのHTMLコンテンツを生成
 * @param {Object} location - Wi-Fiスポット情報
 * @returns {string} HTMLコンテンツ
 */
function createPopupContent(location) {
    return `
        <div class="marker-popup">
            <h3>📶 ${location.Wifi名}</h3>
            <p>📍 ${location.設置場所住所}</p>
            <div class="users">${location.利用者数}人</div>
            <p style="font-size: 11px; color: #999;">2025年10月1日時点</p>
        </div>
    `;
}

/**
 * カスタムマーカーアイコンを作成
 * @param {number} users - 利用者数
 * @param {number} size - マーカーサイズ
 * @param {string} color - マーカー色
 * @returns {L.DivIcon} Leafletアイコンオブジェクト
 */
function createCustomIcon(users, size, color) {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-marker" style="width: ${size}px; height: ${size}px; background-color: ${color};">${users}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

/**
 * 地図上にマーカーを追加
 * @param {L.Map} map - Leafletマップオブジェクト
 * @param {Array} locations - Wi-Fiスポットデータの配列
 * @returns {number} 総利用者数
 */
function addMarkersToMap(map, locations) {
    let totalUsers = 0;

    locations.forEach(location => {
        const users = parseInt(location.利用者数);
        totalUsers += users;

        const markerSize = getMarkerSize(users);
        const color = getMarkerColor(users);
        const popupContent = createPopupContent(location);
        const customIcon = createCustomIcon(users, markerSize, color);

        // マーカーを地図に追加
        L.marker([parseFloat(location.緯度), parseFloat(location.経度)], { icon: customIcon })
            .addTo(map)
            .bindPopup(popupContent);
    });

    return totalUsers;
}

/**
 * 総利用者数を画面に表示
 * @param {number} totalUsers - 総利用者数
 */
function displayTotalUsers(totalUsers) {
    const element = document.getElementById('total-users');
    if (element) {
        element.textContent = totalUsers.toLocaleString();
    }
}

/**
 * Wi-Fiデータを読み込んで地図を構築
 */
async function loadDataAndInitialize() {
    try {
        // Wi-Fiデータを読み込み
        const response = await fetch('data/wifi-data.json');
        if (!response.ok) {
            throw new Error(`データの読み込みに失敗しました: ${response.status}`);
        }

        const wifiData = await response.json();
        const locations = wifiData[CONFIG.dataDate];

        if (!locations || locations.length === 0) {
            throw new Error('Wi-Fiスポットデータが見つかりません');
        }

        // 地図を初期化
        const map = initializeMap();

        // マーカーを追加して総利用者数を計算
        const totalUsers = addMarkersToMap(map, locations);

        // 総利用者数を表示
        displayTotalUsers(totalUsers);

    } catch (error) {
        console.error('エラーが発生しました:', error);
        alert(`地図の初期化に失敗しました: ${error.message}`);
    }
}

// DOMの読み込みが完了したらアプリケーションを起動
document.addEventListener('DOMContentLoaded', loadDataAndInitialize);
