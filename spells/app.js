let spellsData = [];

// DOM要素
const searchInput = document.getElementById('search-input');
const levelFilter = document.getElementById('level-filter');
const concentrationFilter = document.getElementById('filter-concentration');
const ritualFilter = document.getElementById('filter-ritual');
const spellList = document.getElementById('spell-list');
const resultCount = document.getElementById('result-count');
const modal = document.getElementById('detail-modal');
const modalBody = document.getElementById('modal-body');

// 1. JSONデータのロード
async function loadSpells() {
  try {
    const response = await fetch('spells.json');
    spellsData = await response.json();
    renderSpells();
  } catch (error) {
    console.error('呪文データの読み込みに失敗しました:', error);
    spellList.innerHTML = '<p>データの読み込みエラーが発生しました。</p>';
  }
}

// 2. フィルタリング＆検索処理
function getFilteredSpells() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedLevel = levelFilter.value;
  const requireConc = concentrationFilter.checked;
  const requireRitual = ritualFilter.checked;
  
  // チェックされているクラスを取得
  const selectedClasses = Array.from(
    document.querySelectorAll('#class-filters input:checked')
  ).map(cb => cb.value);

  return spellsData.filter(spell => {
    // 検索語句（名前、英名、説明文）
    const matchQuery = !query || 
      spell.name_ja.toLowerCase().includes(query) ||
      spell.name_en.toLowerCase().includes(query) ||
      spell.description.toLowerCase().includes(query);

    // レベル
    const matchLevel = selectedLevel === 'all' || spell.level.toString() === selectedLevel;

    // クラス (選択されたクラスのいずれかに該当するか)
    const matchClass = selectedClasses.length === 0 || 
      selectedClasses.some(c => spell.classes.includes(c));

    // 特殊条件
    const matchConc = !requireConc || spell.concentration;
    const matchRitual = !requireRitual || spell.ritual;

    return matchQuery && matchLevel && matchClass && matchConc && matchRitual;
  });
}

// 3. ハイライト＆ルール用語ポップアップ処理
function processTextHighlight(text, query) {
  let processed = text;

  // ルール用語の強調リンク化
  const rules = ["拘束状態", "敏捷力セーヴィング・スロー", "筋力セーヴィング・スロー", "暗視", "麻痺"];
  rules.forEach(rule => {
    const regex = new RegExp(rule, 'g');
    processed = processed.replace(regex, `<span class="interactive-rule" onclick="alert('${rule}のルール参照')">${rule}</span>`);
  });

  // 検索語句の黄色ハイライト
  if (query) {
    const searchRegex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    processed = processed.replace(searchRegex, '<mark class="highlight">$1</mark>');
  }

  return processed;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 4. 一覧描画
function renderSpells() {
  const filtered = getFilteredSpells();
  const query = searchInput.value.trim();
  spellList.innerHTML = '';
  resultCount.textContent = `${filtered.length} 件表示中`;

  filtered.forEach(spell => {
    const card = document.createElement('div');
    card.className = 'spell-card';
    
    const levelText = spell.level === 0 ? 'カン トリップ' : `${spell.level}レベル`;
    
    card.innerHTML = `
      <div class="spell-card-header">
        <span class="spell-title">${processTextHighlight(spell.name_ja, query)}</span>
        <span class="spell-meta">${spell.school}</span>
      </div>
      <div class="spell-meta">${spell.name_en}</div>
      <div class="badges">
        <span class="badge badge-lvl">${levelText}</span>
        ${spell.concentration ? '<span class="badge badge-conc">集中</span>' : ''}
        ${spell.ritual ? '<span class="badge badge-ritual">儀式</span>' : ''}
      </div>
    `;

    card.addEventListener('click', () => openModal(spell));
    spellList.appendChild(card);
  });
}

// 5. 詳細モーダル表示
function openModal(spell) {
  const query = searchInput.value.trim();
  const comp = spell.components;
  const compText = [
    comp.v ? 'V(言語)' : '',
    comp.s ? 'S(動作)' : '',
    comp.m ? `M(物質: ${comp.m})` : ''
  ].filter(Boolean).join(', ');

  modalBody.innerHTML = `
    <div class="detail-header">
      <h2>${spell.name_ja} <small>(${spell.name_en})</small></h2>
      <p>${spell.level === 0 ? 'カン トリップ' : `${spell.level}レベル`} ${spell.school}</p>
    </div>
    <div class="detail-grid">
      <div><strong>発動時間:</strong> ${spell.casting_time}</div>
      <div><strong>射程:</strong> ${spell.range}</div>
      <div><strong>構成要素:</strong> ${compText}</div>
      <div><strong>持続時間:</strong> ${spell.duration}</div>
      <div><strong>クラス:</strong> ${spell.classes.join(', ')}</div>
    </div>
    <div class="description">
      ${processTextHighlight(spell.description, query)}
    </div>
    ${spell.higher_levels ? `
      <div class="higher-levels">
        <strong>高レベルキャスト:</strong> ${processTextHighlight(spell.higher_levels, query)}
      </div>
    ` : ''}
  `;

  modal.classList.remove('hidden');
}

// イベントリスナー設定
searchInput.addEventListener('input', renderSpells);
levelFilter.addEventListener('change', renderSpells);
concentrationFilter.addEventListener('change', renderSpells);
ritualFilter.addEventListener('change', renderSpells);
document.querySelectorAll('#class-filters input').forEach(cb => cb.addEventListener('change', renderSpells));

// モーダル閉じる
document.getElementById('modal-close').addEventListener('click', () => modal.classList.add('hidden'));
document.getElementById('modal-overlay').addEventListener('click', () => modal.classList.add('hidden'));

// 初期化実行
loadSpells();
