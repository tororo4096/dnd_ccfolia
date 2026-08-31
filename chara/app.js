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

// --- 外部JSONから読み込まれるデータ保持オブジェクト ---
let classData = null;

// --- 状態管理 ---
let state = {
    level: 1,
    baseScores: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 },
    asiChoices: {},
    selectedSkills: [],
    style1: "archery",
    style2: "defense"
};

// --- 初期化処理 (JSON非同期フェッチ) ---
async function initApp() {
    try {
        const response = await fetch('class.json');
        if (!response.ok) throw new Error('class.json の読み込みに失敗しました。');
        classData = await response.json();

        // イベントリスナーの登録
        document.getElementById('level-slider').addEventListener('input', (e) => {
            state.level = parseInt(e.target.value, 10);
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

        // 初回レンダリング
        renderSkills();
        render();
    } catch (error) {
        console.error(error);
        alert('設定データの読み込みエラーが発生しました。Webサーバー（ローカルサーバー等）経由で開いているか確認してください。');
    }
}

// --- 計算補助関数 ---
function getProficiencyBonus(level) {
    return Math.ceil(1 + (level / 4));
}

function getModifier(score) {
    return Math.floor((score - 10) / 2);
}

function calculateCost(scores) {
    return Object.values(scores).reduce((sum, val) => sum + POINT_COSTS[val], 0);
}

function getFinalScores() {
    let finals = {};
    ABILITIES.forEach(a => {
        finals[a.key] = state.baseScores[a.key] + 1; // ヒューマンボーナス(+1)
    });

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

// --- レンダリング処理 ---
function render() {
    if (!classData) return;

    // 1. レベル & 習熟ボーナス
    document.getElementById('level-disp').textContent = state.level;
    const prof = getProficiencyBonus(state.level);
    document.getElementById('prof-bonus').textContent = `+${prof}`;

    // 2. 能力値 & ポイント買収
    const finals = getFinalScores();
    const usedPoints = calculateCost(state.baseScores);
    document.getElementById('pts-left').textContent = 27 - usedPoints;

    const tbody = document.getElementById('ability-rows');
    tbody.innerHTML = "";
    ABILITIES.forEach(a => {
        const base = state.baseScores[a.key];
        const final = finals[a.key];
        const mod = getModifier(final);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        const asiBonus = final - base - 1;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${a.name} (${a.key})</strong></td>
            <td>${base}</td>
            <td>+1</td>
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

    // 3. HP算出 (JSONから基準値を取得)
    const conMod = getModifier(finals['CON']);
    let hp = classData.hp_first_level + conMod;
    if (state.level > 1) {
        hp += (state.level - 1) * (classData.hp_subsequent_levels + conMod);
    }
    document.getElementById('hp-disp').textContent = hp;

    // 4. 戦闘スタイルドロップダウン
    renderStyleOptions();

    // 5. ASI入力フォーム枠の更新
    renderASIControls();

    // 6. 特徴タイムライン更新
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
            alert(`${classData.class_name}の技能習熟は${maxSkills}つまで選択可能です。`);
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

// アプリケーション開始
initApp();
