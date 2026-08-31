// --- 基本共通ルールデータ ---
const ABILITIES = [
    { key: "STR", name: "筋力" },
    { key: "DEX", name: "敏捷力" },
    { key: "CON", name: "耐久力" },
    { key: "INT", name: "知力" },
    { key: "WIS", name: "判断力" },
    { key: "CHA", name: "魅力" }
];

const POINT_COSTS = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 };

// --- データ保持変数 ---
let classData = null;
let raceDataList = [];

// --- 状態管理 ---
let state = {
    level: 1,
    selectedRaceId: "human",
    halfElfChoice: { stat1: "STR", stat2: "DEX" },
    baseScores: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 },
    asiChoices: {},
    selectedSkills: [],
    style1: "archery",
    style2: "defense"
};

// --- 初期化処理 (複数JSONの非同期並行フェッチ) ---
async function initApp() {
    try {
        const [classRes, raceRes] = await Promise.all([
            fetch('class.json'),
            fetch('race.json')
        ]);

        if (!classRes.ok || !raceRes.ok) {
            throw new Error('設定ファイル(JSON)の読み込みに失敗しました。');
        }

        classData = await classRes.json();
        raceDataList = await raceRes.json();

        // UIイベントの初期化
        setupEventListeners();

        // 初期描画
        renderRaceSelect();
        renderSkills();
        render();
    } catch (error) {
        console.error(error);
        alert('設定データの読み込みエラーが発生しました。Webサーバー経由で起動しているか確認してください。');
    }
}

function setupEventListeners() {
    document.getElementById('level-slider').addEventListener('input', (e) => {
        state.level = parseInt(e.target.value, 10);
        render();
    });

    document.getElementById('race-select').addEventListener('change', (e) => {
        state.selectedRaceId = e.target.value;
        render();
    });

    document.getElementById('he-stat-1').addEventListener('change', (e) => {
        state.halfElfChoice.stat1 = e.target.value;
        render();
    });

    document.getElementById('he-stat-2').addEventListener('change', (e) => {
        state.halfElfChoice.stat2 = e.target.value;
        render();
    });

    document.getElementById('style-1').addEventListener('change', (e) => {
        state.style1 = e.target.value;
        render();
    });

    document.getElementById('style-2').addEventListener('change', (e) => {
        state.style2 = e.target.value;
        render();
    });
}

function getSelectedRace() {
    return raceDataList.find(r => r.id === state.selectedRaceId) || raceDataList[0];
}

function getProficiencyBonus(level) {
    return Math.ceil(1 + (level / 4));
}

function getModifier(score) {
    return Math.floor((score - 10) / 2);
}

function calculateCost(scores) {
    return Object.values(scores).reduce((sum, val) => sum + POINT_COSTS[val], 0);
}

// 種族補正の計算
function getRaceBonusMap() {
    const race = getSelectedRace();
    let bonusMap = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 };

    if (!race) return bonusMap;

    // 固定補正
    if (race.ability_bonuses) {
        Object.keys(race.ability_bonuses).forEach(k => {
            bonusMap[k] += race.ability_bonuses[k];
        });
    }

    // ハーフエルフなどの選択式補正
    if (race.id === "half_elf") {
        if (state.halfElfChoice.stat1) bonusMap[state.halfElfChoice.stat1] += 1;
        if (state.halfElfChoice.stat2) bonusMap[state.halfElfChoice.stat2] += 1;
    }

    return bonusMap;
}

function getFinalScores() {
    let finals = {};
    const raceBonuses = getRaceBonusMap();

    ABILITIES.forEach(a => {
        finals[a.key] = state.baseScores[a.key] + (raceBonuses[a.key] || 0);
    });

    // ASIの算定
    if (classData && classData.asi_levels) {
        classData.asi_levels.forEach(lvl => {
            if (state.level >= lvl && state.asiChoices[lvl]) {
                const c = state.asiChoices[lvl];
                if (c.mode === "single" && c.stat1) {
                    finals[c.stat1] = (finals[c.stat1] || 0) + 2;
                } else if (c.mode === "double") {
                    if (c.stat1) finals[c.stat1] = (finals[c.stat1] || 0) + 1;
                    if (c.stat2) finals[c.stat2] = (finals[c.stat2] || 0) + 1;
                }
            }
        });
    }

    return finals;
}

function renderRaceSelect() {
    const select = document.getElementById('race-select');
    select.innerHTML = raceDataList.map(r => {
        const name = r.subrace_name ? `${r.race_name} (${r.subrace_name})` : r.race_name;
        return `<option value="${r.id}" ${state.selectedRaceId === r.id ? 'selected' : ''}>${name}</option>`;
    }).join('');
}

// --- メインレンダリング ---
function render() {
    if (!classData || raceDataList.length === 0) return;

    const currentRace = getSelectedRace();

    // 1. レベル / 移動速度 / 習熟ボーナス
    document.getElementById('level-disp').textContent = state.level;
    document.getElementById('speed-disp').textContent = `${currentRace.speed}ft`;
    const prof = getProficiencyBonus(state.level);
    document.getElementById('prof-bonus').textContent = `+${prof}`;

    // 2. ハーフエルフの選択UI表示制御
    const heGroup = document.getElementById('half-elf-bonus-group');
    if (currentRace.id === "half_elf") {
        heGroup.classList.remove('hidden');
        const availableStats = ABILITIES.filter(a => a.key !== "CHA");
        
        const renderHESelect = (elemId, currentVal) => {
            document.getElementById(elemId).innerHTML = availableStats.map(a => 
                `<option value="${a.key}" ${currentVal === a.key ? 'selected' : ''}>${a.name}</option>`
            ).join('');
        };
        renderHESelect('he-stat-1', state.halfElfChoice.stat1);
        renderHESelect('he-stat-2', state.halfElfChoice.stat2);
    } else {
        heGroup.classList.add('hidden');
    }

    // 3. 能力値 & ポイント買収計算
    const finals = getFinalScores();
    const raceBonuses = getRaceBonusMap();
    const usedPoints = calculateCost(state.baseScores);
    document.getElementById('pts-left').textContent = 27 - usedPoints;

    const tbody = document.getElementById('ability-rows');
    tbody.innerHTML = "";
    ABILITIES.forEach(a => {
        const base = state.baseScores[a.key];
        const rBonus = raceBonuses[a.key] || 0;
        const final = finals[a.key];
        const mod = getModifier(final);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        const asiBonus = final - base - rBonus;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${a.name} (${a.key})</strong></td>
            <td>${base}</td>
            <td>+${rBonus}</td>
            <td>+${asiBonus}</td>
            <td><strong>${final}</strong></td>
            <td><strong>${modStr}</strong></td>
            <td>
                <button class="btn-sm" onclick="changeBase('${a.key}', -1)" ${base <= 8 ? 'disabled' : ''}>-</button>
                <button class="btn-sm" onclick="changeBase('${a.key}', 1)" ${base >= 15 || (usedPoints + POINT_COSTS[base+1] - POINT_COSTS[base] > 27) ? 'disabled' : ''}>+</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // 4. HP算出 (ヒル・ドワーフの種族レベルボーナスを反映)
    const conMod = getModifier(finals['CON']);
    const raceHpBonus = (currentRace.hp_per_level_bonus || 0) * state.level;
    let hp = classData.hp_first_level + conMod + (currentRace.hp_per_level_bonus || 0);
    if (state.level > 1) {
        hp += (state.level - 1) * (classData.hp_subsequent_levels + conMod) + (raceHpBonus - (currentRace.hp_per_level_bonus || 0));
    }
    document.getElementById('hp-disp').textContent = hp;

    // 5. 各選択・タイムライン表示の更新
    renderStyleOptions();
    renderASIControls();
    renderRaceTraits();
    renderTimeline();
}

function changeBase(key, delta) {
    const nextVal = state.baseScores[key] + delta;
    if (nextVal >= 8 && nextVal <= 15) {
        state.baseScores[key] = nextVal;
        render();
    }
}

function renderSkills() {
    if (!classData) return;
    const container = document.getElementById('skills-list');
    container.innerHTML = "";
    
    classData.skill_choices.options.forEach(skill => {
        const label = document.createElement('label');
        const checked = state.selectedSkills.includes(skill) ? "checked" : "";
        label.innerHTML = `
            <input type="checkbox" value="${skill}" ${checked} onchange="toggleSkill('${skill}')">
            ${skill}
        `;
        container.appendChild(label);
    });
}

function toggleSkill(skill) {
    const maxSkills = classData ? classData.skill_choices.count : 2;
    if (state.selectedSkills.includes(skill)) {
        state.selectedSkills = state.selectedSkills.filter(s => s !== skill);
    } else {
        if (state.selectedSkills.length < maxSkills) {
            state.selectedSkills.push(skill);
        } else {
            alert(`技能習熟は${maxSkills}つまで選択可能です。`);
        }
    }
    renderSkills();
}

function renderStyleOptions() {
    if (!classData) return;

    const s1Select = document.getElementById('style-1');
    const s2Group = document.getElementById('style-2-group');
    const s2Select = document.getElementById('style-2');

    s1Select.innerHTML = classData.fighting_styles.map(s => 
        `<option value="${s.id}" ${state.style1 === s.id ? 'selected' : ''}>${s.name} - ${s.desc}</option>`
    ).join('');

    if (state.level >= 10) {
        s2Group.classList.remove('hidden');
        s2Select.innerHTML = classData.fighting_styles
            .filter(s => s.id !== state.style1)
            .map(s => `<option value="${s.id}" ${state.style2 === s.id ? 'selected' : ''}>${s.name} - ${s.desc}</option>`)
            .join('');
    } else {
        s2Group.classList.add('hidden');
    }
}

function renderASIControls() {
    if (!classData) return;
    const container = document.getElementById('asi-container');
    container.innerHTML = "";

    const activeLevels = classData.asi_levels.filter(l => l <= state.level);
    if (activeLevels.length === 0) {
        container.innerHTML = "<p class='sub-text'>現在適用可能な能力値上昇はありません (4レベル以上で獲得)</p>";
        return;
    }

    activeLevels.forEach(lvl => {
        if (!state.asiChoices[lvl]) {
            state.asiChoices[lvl] = { mode: "single", stat1: "STR", stat2: "DEX" };
        }
        const c = state.asiChoices[lvl];

        const row = document.createElement('div');
        row.className = 'asi-row';
        row.innerHTML = `
            <strong>Lv${lvl}:</strong>
            <select onchange="updateASI(${lvl}, 'mode', this.value)">
                <option value="single" ${c.mode === 'single' ? 'selected' : ''}>+2 (1種)</option>
                <option value="double" ${c.mode === 'double' ? 'selected' : ''}>+1 (2種)</option>
            </select>
            <select onchange="updateASI(${lvl}, 'stat1', this.value)">
                ${ABILITIES.map(a => `<option value="${a.key}" ${c.stat1 === a.key ? 'selected' : ''}>${a.name}</option>`).join('')}
            </select>
            ${c.mode === 'double' ? `
                <select onchange="updateASI(${lvl}, 'stat2', this.value)">
                    ${ABILITIES.map(a => `<option value="${a.key}" ${c.stat2 === a.key ? 'selected' : ''}>${a.name}</option>`).join('')}
                </select>
            ` : ''}
        `;
        container.appendChild(row);
    });
}

function updateASI(level, key, value) {
    state.asiChoices[level][key] = value;
    render();
}

function renderRaceTraits() {
    const race = getSelectedRace();
    const container = document.getElementById('race-traits-list');
    container.innerHTML = "";

    if (!race || !race.traits) return;

    race.traits.forEach(t => {
        const item = document.createElement('div');
        item.className = 'trait-item';
        item.innerHTML = `
            <div><strong>${t.name}</strong></div>
            <div class="feature-desc">${t.desc}</div>
        `;
        container.appendChild(item);
    });
}

function renderTimeline() {
    if (!classData) return;
    const container = document.getElementById('features-list');
    container.innerHTML = "";

    const activeFeatures = classData.features.filter(f => f.level <= state.level);
    activeFeatures.forEach(f => {
        const item = document.createElement('div');
        item.className = 'feature-item';
        item.innerHTML = `
            <div><span class="lvl-tag">Lv${f.level}</span><strong>${f.name}</strong></div>
            <div class="feature-desc">${f.desc}</div>
        `;
        container.appendChild(item);
    });
}

// アプリケーション起動
initApp();
