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
let classDataList = [];
let raceDataList = [];

// --- 状態管理 ---
let state = {
    selectedClassId: "rogue", // 初期選択クラス
    level: 1,
    selectedRaceId: "human",
    selectedArchetype: "thief",
    halfElfChoice: { stat1: "STR", stat2: "DEX" },
    baseScores: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 },
    asiChoices: {},
    selectedSkills: [],
    style1: "archery",
    style2: "defense"
};

// --- 初期化処理 ---
async function initApp() {
    try {
        const [classRes, raceRes] = await Promise.all([
            fetch('class.json'),
            fetch('race.json')
        ]);

        if (!classRes.ok || !raceRes.ok) {
            throw new Error('設定ファイル(JSON)の読み込みに失敗しました。');
        }

        classDataList = await classRes.json();
        raceDataList = await raceRes.json();

        // UIイベントの初期化
        setupEventListeners();

        // 初期描画
        renderClassSelect();
        renderRaceSelect();
        renderSkills();
        render();
    } catch (error) {
        console.error(error);
        alert('設定データの読み込みエラーが発生しました。Webサーバー（Live Server等）経由で起動しているか確認してください。');
    }
}

function getCurrentClass() {
    return classDataList.find(c => c.class_id === state.selectedClassId) || classDataList[0];
}

function getSelectedRace() {
    return raceDataList.find(r => r.id === state.selectedRaceId) || raceDataList[0];
}

function setupEventListeners() {
    const classSelect = document.getElementById('class-select');
    if (classSelect) {
        classSelect.addEventListener('change', (e) => {
            state.selectedClassId = e.target.value;
            const currentClass = getCurrentClass();
            // クラス変更時にデフォルトサブクラスを更新・技能リセット
            if (currentClass.archetypes && currentClass.archetypes.length > 0) {
                state.selectedArchetype = currentClass.archetypes[0].id;
            }
            state.selectedSkills = [];
            renderSkills();
            render();
        });
    }

    document.getElementById('level-slider').addEventListener('input', (e) => {
        state.level = parseInt(e.target.value, 10);
        render();
    });

    document.getElementById('race-select').addEventListener('change', (e) => {
        state.selectedRaceId = e.target.value;
        render();
    });

    const archSelect = document.getElementById('archetype-select');
    if (archSelect) {
        archSelect.addEventListener('change', (e) => {
            state.selectedArchetype = e.target.value;
            render();
        });
    }

    const he1 = document.getElementById('he-stat-1');
    if (he1) he1.addEventListener('change', (e) => { state.halfElfChoice.stat1 = e.target.value; render(); });

    const he2 = document.getElementById('he-stat-2');
    if (he2) he2.addEventListener('change', (e) => { state.halfElfChoice.stat2 = e.target.value; render(); });

    const st1 = document.getElementById('style-1');
    if (st1) st1.addEventListener('change', (e) => { state.style1 = e.target.value; render(); });

    const st2 = document.getElementById('style-2');
    if (st2) st2.addEventListener('change', (e) => { state.style2 = e.target.value; render(); });
}

function getProficiencyBonus(level) {
    return Math.ceil(1 + (level / 4));
}

function getModifier(score) {
    return Math.floor((score - 10) / 2);
}

// ローグ用：急所攻撃ダイス算出 (ceil(Lv / 2)d6)
function getSneakAttackDice(level) {
    return `${Math.ceil(level / 2)}d6`;
}

function calculateCost(scores) {
    return Object.values(scores).reduce((sum, val) => sum + POINT_COSTS[val], 0);
}

function getRaceBonusMap() {
    const race = getSelectedRace();
    let bonusMap = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 };
    if (!race) return bonusMap;

    if (race.ability_bonuses) {
        Object.keys(race.ability_bonuses).forEach(k => {
            bonusMap[k] += race.ability_bonuses[k];
        });
    }

    if (race.id === "half_elf") {
        if (state.halfElfChoice.stat1) bonusMap[state.halfElfChoice.stat1] += 1;
        if (state.halfElfChoice.stat2) bonusMap[state.halfElfChoice.stat2] += 1;
    }

    return bonusMap;
}

function getFinalScores() {
    let finals = {};
    const raceBonuses = getRaceBonusMap();
    const currentClass = getCurrentClass();

    ABILITIES.forEach(a => {
        finals[a.key] = state.baseScores[a.key] + (raceBonuses[a.key] || 0);
    });

    if (currentClass && currentClass.asi_levels) {
        currentClass.asi_levels.forEach(lvl => {
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

function renderClassSelect() {
    const select = document.getElementById('class-select');
    if (!select) return;
    select.innerHTML = classDataList.map(c => 
        `<option value="${c.class_id}" ${state.selectedClassId === c.class_id ? 'selected' : ''}>${c.class_name}</option>`
    ).join('');
}

function renderRaceSelect() {
    const select = document.getElementById('race-select');
    if (!select) return;
    select.innerHTML = raceDataList.map(r => {
        const name = r.subrace_name ? `${r.race_name} (${r.subrace_name})` : r.race_name;
        return `<option value="${r.id}" ${state.selectedRaceId === r.id ? 'selected' : ''}>${name}</option>`;
    }).join('');
}

function renderArchetypeOptions() {
    const currentClass = getCurrentClass();
    const select = document.getElementById('archetype-select');
    const descElem = document.getElementById('archetype-desc');
    if (!select) return;
    
    if (state.level < currentClass.archetype_level) {
        select.disabled = true;
        select.innerHTML = `<option>3レベルで解放されます</option>`;
        if (descElem) descElem.textContent = "キャラクターレベルが3に達すると類型を選択できます。";
        return;
    }

    select.disabled = false;
    select.innerHTML = currentClass.archetypes.map(a => 
        `<option value="${a.id}" ${state.selectedArchetype === a.id ? 'selected' : ''}>${a.name}</option>`
    ).join('');

    const currentArchetype = currentClass.archetypes.find(a => a.id === state.selectedArchetype);
    if (currentArchetype && descElem) {
        descElem.textContent = currentArchetype.desc;
    }
}

// --- メイン描画コントロール ---
function render() {
    if (classDataList.length === 0 || raceDataList.length === 0) return;

    const currentClass = getCurrentClass();
    const currentRace = getSelectedRace();

    // 1. 基本ステータス
    document.getElementById('level-disp').textContent = state.level;
    document.getElementById('speed-disp').textContent = `${currentRace.speed}ft`;
    const prof = getProficiencyBonus(state.level);
    document.getElementById('prof-bonus').textContent = `+${prof}`;

    // 2. ハーフエルフ専用選択UI制御
    const heGroup = document.getElementById('half-elf-bonus-group');
    if (heGroup) {
        if (currentRace.id === "half_elf") {
            heGroup.classList.remove('hidden');
            const availableStats = ABILITIES.filter(a => a.key !== "CHA");
            
            const renderHESelect = (elemId, currentVal) => {
                const el = document.getElementById(elemId);
                if (el) {
                    el.innerHTML = availableStats.map(a => 
                        `<option value="${a.key}" ${currentVal === a.key ? 'selected' : ''}>${a.name}</option>`
                    ).join('');
                }
            };
            renderHESelect('he-stat-1', state.halfElfChoice.stat1);
            renderHESelect('he-stat-2', state.halfElfChoice.stat2);
        } else {
            heGroup.classList.add('hidden');
        }
    }

    // 3. 能力値 ＆ ポイント計算
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

    // 4. HP算出
    const conMod = getModifier(finals['CON']);
    const raceHpBonus = (currentRace.hp_per_level_bonus || 0) * state.level;
    let hp = currentClass.hp_first_level + conMod + (currentRace.hp_per_level_bonus || 0);
    if (state.level > 1) {
        hp += (state.level - 1) * (currentClass.hp_subsequent_levels + conMod) + (raceHpBonus - (currentRace.hp_per_level_bonus || 0));
    }
    document.getElementById('hp-disp').textContent = hp;

    // 5. 各UIセクション描画
    renderArchetypeOptions();
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
    const currentClass = getCurrentClass();
    const container = document.getElementById('skills-list');
    if (!container) return;
    container.innerHTML = "";
    
    // 現在のクラスの習熟上限を表示
    const skillTitle = document.getElementById('skill-title');
    if (skillTitle) {
        skillTitle.textContent = `技能習熟 (最大${currentClass.skill_choices.count}つ選択)`;
    }

    currentClass.skill_choices.options.forEach(skill => {
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
    const currentClass = getCurrentClass();
    const maxSkills = currentClass.skill_choices.count;
    if (state.selectedSkills.includes(skill)) {
        state.selectedSkills = state.selectedSkills.filter(s => s !== skill);
    } else {
        if (state.selectedSkills.length < maxSkills) {
            state.selectedSkills.push(skill);
        } else {
            alert(`${currentClass.class_name}の技能習熟は${maxSkills}つまで選択可能です。`);
        }
    }
    renderSkills();
}

function renderStyleOptions() {
    const currentClass = getCurrentClass();
    const styleCard = document.getElementById('style-card');
    if (!styleCard) return;

    // 戦闘スタイル要素を持つクラス（ファイター等）のみ表示
    if (!currentClass.fighting_styles) {
        styleCard.classList.add('hidden');
        return;
    }
    styleCard.classList.remove('hidden');

    const s1Select = document.getElementById('style-1');
    const s2Group = document.getElementById('style-2-group');
    const s2Select = document.getElementById('style-2');

    if (s1Select) {
        s1Select.innerHTML = currentClass.fighting_styles.map(s => 
            `<option value="${s.id}" ${state.style1 === s.id ? 'selected' : ''}>${s.name} - ${s.desc}</option>`
        ).join('');
    }

    if (state.level >= 10 && s2Group && s2Select) {
        s2Group.classList.remove('hidden');
        s2Select.innerHTML = currentClass.fighting_styles
            .filter(s => s.id !== state.style1)
            .map(s => `<option value="${s.id}" ${state.style2 === s.id ? 'selected' : ''}>${s.name} - ${s.desc}</option>`)
            .join('');
    } else if (s2Group) {
        s2Group.classList.add('hidden');
    }
}

function renderASIControls() {
    const currentClass = getCurrentClass();
    const container = document.getElementById('asi-container');
    if (!container) return;
    container.innerHTML = "";

    const activeLevels = currentClass.asi_levels.filter(l => l <= state.level);
    if (activeLevels.length === 0) {
        container.innerHTML = "<p class='sub-text'>現在適用可能な能力値上昇はありません</p>";
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
    if (!container) return;
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
    const currentClass = getCurrentClass();
    const container = document.getElementById('features-list');
    if (!container) return;
    container.innerHTML = "";

    // 1. 基本クラス特徴
    let allFeatures = currentClass.features
        .filter(f => f.level <= state.level)
        .map(f => {
            // ローグの急所攻撃ダイス数を自動動的埋め込み
            if (f.name === "急所攻撃") {
                return { ...f, desc: `${f.desc} 【現在のダイス: ${getSneakAttackDice(state.level)}】` };
            }
            return f;
        });

    // 2. サブクラス（類型）特徴
    if (state.level >= currentClass.archetype_level) {
        const arch = currentClass.archetypes.find(a => a.id === state.selectedArchetype);
        if (arch && arch.features) {
            const archFeatures = arch.features
                .filter(f => f.level <= state.level)
                .map(f => ({ ...f, name: `[${arch.name}] ${f.name}` }));
            allFeatures = [...allFeatures, ...archFeatures];
        }
    }

    // レベル順整列
    allFeatures.sort((a, b) => a.level - b.level);

    allFeatures.forEach(f => {
        const item = document.createElement('div');
        item.className = 'feature-item';
        item.innerHTML = `
            <div><span class="lvl-tag">Lv${f.level}</span><strong>${f.name}</strong></div>
            <div class="feature-desc">${f.desc}</div>
        `;
        container.appendChild(item);
    });
}

// 初期化
initApp();
