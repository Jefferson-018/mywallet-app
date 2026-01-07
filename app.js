import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "./firebase.js";

// Registra o Plugin de Labels do Chart.js
Chart.register(ChartDataLabels);

const categoryConfig = {
    salary: { label: 'Receita', icon: 'banknote', color: 'text-green-600', bg: 'bg-green-100', type: 'income' },
    freelance: { label: 'Freelance', icon: 'laptop', color: 'text-emerald-600', bg: 'bg-emerald-100', type: 'income' },
    food: { label: 'Alimentação', icon: 'utensils', color: 'text-orange-600', bg: 'bg-orange-100', type: 'expense' },
    transport: { label: 'Transporte', icon: 'car', color: 'text-blue-600', bg: 'bg-blue-100', type: 'expense' },
    home: { label: 'Casa', icon: 'home', color: 'text-indigo-600', bg: 'bg-indigo-100', type: 'expense' },
    education: { label: 'Educação', icon: 'graduation-cap', color: 'text-cyan-600', bg: 'bg-cyan-100', type: 'expense' },
    leisure: { label: 'Lazer', icon: 'gamepad-2', color: 'text-purple-600', bg: 'bg-purple-100', type: 'expense' },
    health: { label: 'Saúde', icon: 'heart', color: 'text-red-600', bg: 'bg-red-100', type: 'expense' },
    invest: { label: 'Investimento', icon: 'trending-up', color: 'text-yellow-600', bg: 'bg-yellow-100', type: 'expense' },
    shopping: { label: 'Compras', icon: 'shopping-bag', color: 'text-pink-600', bg: 'bg-pink-100', type: 'expense' },
    other: { label: 'Outros', icon: 'package', color: 'text-gray-600', bg: 'bg-gray-100', type: 'expense' }
};

// CORES DOS BANCOS
const bankStyles = {
    nubank: { bg: 'bg-gradient-to-br from-purple-600 to-purple-800' },
    itau: { bg: 'bg-gradient-to-br from-orange-500 to-orange-600' },
    bb: { bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600' },
    santander: { bg: 'bg-gradient-to-br from-red-600 to-red-800' },
    bradesco: { bg: 'bg-gradient-to-br from-red-600 to-red-700' },
    inter: { bg: 'bg-gradient-to-br from-orange-400 to-orange-500' },
    c6: { bg: 'bg-gradient-to-br from-gray-800 to-black' },
    blue: { bg: 'bg-gradient-to-br from-blue-500 to-blue-700' },
    green: { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700' }
};

// LOGOS DAS BANDEIRAS
const flagLogos = {
    visa: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg',
    master: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg',
    elo: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Elo_logo.png', // Elo é .png, cuidado com fundo
    hiper: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Hipercard_logo.svg',
    amex: 'https://upload.wikimedia.org/wikipedia/commons/3/30/American_Express_logo.svg'
};

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loadingScreen = document.getElementById('loading-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const form = document.getElementById('transaction-form');
const cardForm = document.getElementById('card-form');
const editCardForm = document.getElementById('edit-card-form');
const listElement = document.getElementById('transaction-list');
const cardsContainer = document.getElementById('cards-container');
const monthFilter = document.getElementById('month-filter');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const sourceSelect = document.getElementById('transaction-source');

let donutChartInstance = null;
let lineChartInstance = null;
let currentUser = null;
let unsubscribeTrans = null;
let unsubscribeCards = null;
let allTransactions = []; 
let filteredTransactions = []; 
let allCards = [];

if(window.lucide) lucide.createIcons();
const dateInput = document.getElementById('date');
if(dateInput) dateInput.valueAsDate = new Date();

function updateThemeIcon(isDark) {
    themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if(window.lucide) lucide.createIcons();
}

const userTheme = localStorage.getItem('theme');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (userTheme === 'dark' || (!userTheme && systemTheme)) {
    document.documentElement.classList.add('dark');
    updateThemeIcon(true);
} else {
    updateThemeIcon(false);
}

if(themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);
        if(donutChartInstance) renderCharts(filteredTransactions);
    });
}

function toggleLoading(show) {
    if(show) loadingScreen.classList.remove('opacity-0', 'pointer-events-none');
    else { loadingScreen.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => loadingScreen.style.display = 'none', 500); }
}

window.formatarMoedaInput = (input) => {
    let value = input.value.replace(/\D/g, "");
    value = (Number(value) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    input.value = value;
}

function limparValorMoeda(valorString) {
    if (!valorString) return 0;
    if (typeof valorString === 'number') return valorString;
    return Number(valorString.replace(/\./g, '').replace(',', '.').replace('R$', '').trim());
}

function popularSeletorMeses() {
    if(!monthFilter) return;
    monthFilter.innerHTML = ''; 
    const hoje = new Date();
    const dataInicio = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1);
    const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    for (let i = 0; i < 25; i++) {
        const d = new Date(dataInicio.getFullYear(), dataInicio.getMonth() + i, 1);
        const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const texto = `${nomesMeses[d.getMonth()]} ${d.getFullYear()}`;
        const option = document.createElement('option');
        option.value = valor;
        option.text = texto;
        const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        if (valor === mesAtualStr) option.selected = true;
        monthFilter.appendChild(option);
    }
    monthFilter.addEventListener('change', aplicarFiltro);
}
popularSeletorMeses();

// --- AUTH ---
loginBtn.addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); } });
logoutBtn.addEventListener('click', () => { toggleLoading(true); signOut(auth); });

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        loginScreen.classList.remove('flex');
        appScreen.classList.remove('hidden');
        userNameDisplay.textContent = user.displayName;
        carregarDados(user.uid);
        carregarCartoes(user.uid); 
    } else {
        currentUser = null;
        toggleLoading(false);
        loginScreen.classList.remove('hidden');
        loginScreen.classList.add('flex');
        appScreen.classList.add('hidden');
        if (unsubscribeTrans) unsubscribeTrans();
        if (unsubscribeCards) unsubscribeCards();
        listElement.innerHTML = '';
        cardsContainer.innerHTML = '';
        renderValues([]);
    }
});

// --- SALVAR TRANSAÇÃO ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const desc = document.getElementById('desc').value;
    const amountVal = limparValorMoeda(document.getElementById('amount').value);
    if(amountVal <= 0) return alert("Valor inválido");
    const dateVal = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    const paymentSource = document.getElementById('transaction-source').value;
    const type = categoryConfig[category].type;
    const finalAmount = type === 'expense' ? -Math.abs(amountVal) : Math.abs(amountVal);

    try {
        await addDoc(collection(db, "transactions"), { 
            uid: currentUser.uid, 
            desc: desc, 
            amount: finalAmount, 
            date: dateVal, 
            category: category, 
            source: paymentSource, 
            createdAt: new Date() 
        });

        if (type === 'expense' && paymentSource !== 'wallet') {
            const card = allCards.find(c => c.id === paymentSource);
            if (card) {
                const novaFatura = (card.bill || 0) + Math.abs(amountVal);
                await updateDoc(doc(db, "cards", paymentSource), { bill: novaFatura });
                showToast(`Fatura do ${card.name} atualizada!`);
            }
        }

        showToast("Salvo!");
        if(monthFilter && dateVal && monthFilter.value !== dateVal.slice(0, 7)) {
            monthFilter.value = dateVal.slice(0, 7);
            aplicarFiltro();
        }
        form.reset();
        document.getElementById('date').valueAsDate = new Date();
    } catch (e) { alert("Erro ao salvar"); console.error(e); }
});

// --- FUNÇÕES DE CARTÃO ---
window.abrirModalCartao = () => document.getElementById('card-modal').classList.remove('hidden');
window.fecharModalCartao = () => document.getElementById('card-modal').classList.add('hidden');

window.prepararEdicaoCartao = (id) => {
    const card = allCards.find(c => c.id === id);
    if (!card) return;
    document.getElementById('edit-card-modal').classList.remove('hidden');
    document.getElementById('edit-card-id').value = id;
    document.getElementById('edit-card-name').value = card.name;
    document.getElementById('edit-card-bill').value = (card.bill || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
window.fecharModalEdicaoCartao = () => document.getElementById('edit-card-modal').classList.add('hidden');

// Salvar NOVO cartão
cardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return;
    const bank = document.getElementById('card-bank').value;
    const flag = document.getElementById('card-flag').value; // NOVA CAPTURA
    const name = document.getElementById('card-name').value;
    const last4 = document.getElementById('card-last4').value;
    const bill = limparValorMoeda(document.getElementById('card-bill').value);
    try {
        await addDoc(collection(db, "cards"), { uid: currentUser.uid, bank, flag, name, last4, bill, createdAt: new Date() });
        showToast("Cartão Criado!");
        fecharModalCartao();
        cardForm.reset();
    } catch(e) { alert("Erro"); }
});

editCardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-card-id').value;
    const name = document.getElementById('edit-card-name').value;
    const bill = limparValorMoeda(document.getElementById('edit-card-bill').value);
    try {
        await updateDoc(doc(db, "cards", id), { name, bill });
        showToast("Cartão Atualizado!");
        fecharModalEdicaoCartao();
    } catch(e) { alert("Erro ao editar cartão"); }
});

// --- CARREGAR DADOS ---
function carregarDados(uid) {
    const q = query(collection(db, "transactions"), where("uid", "==", uid));
    unsubscribeTrans = onSnapshot(q, (snapshot) => {
        const transactions = [];
        snapshot.forEach(doc => { 
            const data = doc.data();
            let dataCorrigida = data.date;
            try { if(data.date && data.date.seconds) dataCorrigida = new Date(data.date.seconds * 1000).toISOString().split('T')[0]; } catch(e) {}
            transactions.push({ id: doc.id, ...data, date: dataCorrigida }); 
        });
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        allTransactions = transactions;
        aplicarFiltro();
        toggleLoading(false);
    });
}

function carregarCartoes(uid) {
    const q = query(collection(db, "cards"), where("uid", "==", uid));
    unsubscribeCards = onSnapshot(q, (snapshot) => {
        allCards = [];
        snapshot.forEach(doc => allCards.push({ id: doc.id, ...doc.data() }));
        renderCards(allCards);
        popularSelectCartoes(allCards);
    });
}

function popularSelectCartoes(cards) {
    const defaultOption = '<option value="wallet">💵 Carteira / Conta Corrente</option>';
    let options = defaultOption;
    cards.forEach(card => {
        options += `<option value="${card.id}">💳 Cartão ${card.name} (Final ${card.last4})</option>`;
    });
    sourceSelect.innerHTML = options;
}

function renderCards(cards) {
    cardsContainer.innerHTML = '';
    cards.forEach(card => {
        const style = bankStyles[card.bank] || bankStyles['blue'];
        // Lógica da Bandeira: Se não tiver (cartão antigo), usa Visa como padrão
        const flagUrl = flagLogos[card.flag] || flagLogos['visa']; 
        
        const cardHtml = `
            <div class="min-w-[280px] h-44 ${style.bg} rounded-2xl p-5 text-white shadow-lg flex flex-col justify-between relative overflow-hidden group hover:scale-105 transition duration-300">
                <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white opacity-10"></div>
                <div class="flex justify-between items-start z-10">
                    <span class="font-bold tracking-wider">${card.name}</span>
                    <div class="flex gap-2">
                        <button onclick="prepararEdicaoCartao('${card.id}')" aria-label="Editar" class="opacity-50 hover:opacity-100 transition cursor-pointer"><i data-lucide="pencil" class="w-4 h-4 text-white"></i></button>
                        <i data-lucide="nfc" class="w-6 h-6 opacity-70"></i>
                    </div>
                </div>
                <div class="z-10">
                    <p class="text-xs text-white/80 mb-1">Fatura Atual</p>
                    <p class="text-2xl font-bold">${(card.bill || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                </div>
                <div class="flex justify-between items-end z-10">
                    <p class="text-sm tracking-widest">**** ${card.last4}</p>
                    <div class="flex items-center gap-2">
                        <button onclick="deletarCartao('${card.id}')" aria-label="Excluir" class="opacity-50 hover:opacity-100 transition cursor-pointer"><i data-lucide="trash" class="w-4 h-4 text-white"></i></button>
                        <img src="${flagUrl}" class="h-8 bg-white/20 rounded px-1" alt="Bandeira Cartão">
                    </div>
                </div>
            </div>
        `;
        cardsContainer.innerHTML += cardHtml;
    });

    const addBtnHtml = `
        <button onclick="abrirModalCartao()" class="min-w-[100px] h-44 bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition" aria-label="Adicionar Cartão">
            <i data-lucide="plus" class="w-8 h-8 mb-2"></i>
            <span class="text-xs font-medium">Novo</span>
        </button>
    `;
    cardsContainer.innerHTML += addBtnHtml;
    if(window.lucide) lucide.createIcons();
}

window.deletarItem = async (id) => { if(confirm("Apagar?")) await deleteDoc(doc(db, "transactions", id)); }
window.deletarCartao = async (id) => { if(confirm("Remover este cartão?")) await deleteDoc(doc(db, "cards", id)); }

window.prepararEdicao = (id) => { 
    const t = allTransactions.find(item => item.id === id);
    if (!t) return;
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-desc').value = t.desc;
    document.getElementById('edit-amount').value = Math.abs(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    document.getElementById('edit-date').value = t.date;
}
window.fecharModal = () => document.getElementById('edit-modal').classList.add('hidden');

document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const desc = document.getElementById('edit-desc').value;
    const amountVal = limparValorMoeda(document.getElementById('edit-amount').value);
    const dateVal = document.getElementById('edit-date').value;
    
    const original = allTransactions.find(t => t.id === id);
    const isExpense = original && original.amount < 0;
    const finalAmount = isExpense ? -Math.abs(amountVal) : Math.abs(amountVal);
    
    try { await updateDoc(doc(db, "transactions", id), { desc: desc, amount: finalAmount, date: dateVal }); showToast("Editado!"); fecharModal(); } catch (e) { alert("Erro"); }
});

window.exportarCSV = () => {
    if(!filteredTransactions.length) return showToast("Nada para exportar!");
    let csv = "\uFEFFData;Descrição;Valor;Categoria;Pagamento\n";
    filteredTransactions.forEach(t => {
        let fonte = "Carteira";
        if(t.source && t.source !== 'wallet') {
            const card = allCards.find(c => c.id === t.source);
            fonte = card ? `Cartão ${card.name}` : "Cartão (Removido)";
        }
        csv += `${formatarData(t.date)};${t.desc};${t.amount.toLocaleString('pt-BR')};${categoryConfig[t.category]?.label || t.category};${fonte}\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = "extrato.csv";
    link.click();
}

function aplicarFiltro() {
    const mesSelecionado = monthFilter.value; 
    if (!mesSelecionado) { filteredTransactions = allTransactions; } 
    else { filteredTransactions = allTransactions.filter(t => t.date && t.date.startsWith(mesSelecionado)); }
    renderList(filteredTransactions);
    renderValues(filteredTransactions);
    renderCharts(filteredTransactions); 
}

function renderCharts(transactions) {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    const ctxDonut = document.getElementById('expenseChart');
    const income = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const expense = Math.abs(transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
    
    if (donutChartInstance) donutChartInstance.destroy();
    if (income === 0 && expense === 0) {
        document.getElementById('no-data-msg').classList.remove('hidden');
        ctxDonut.style.display = 'none';
    } else {
        document.getElementById('no-data-msg').classList.add('hidden');
        ctxDonut.style.display = 'block';
        donutChartInstance = new Chart(ctxDonut, {
            type: 'doughnut',
            data: { labels: ['Entradas', 'Saídas'], datasets: [{ data: [income, expense], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0, hoverOffset: 4 }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { position: 'bottom', labels: { color: textColor } },
                    // NOVA CONFIGURAÇÃO DO PLUGIN DE DATALABELS
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold' },
                        formatter: (value, ctx) => {
                            if(value === 0) return ''; // Se for 0, não mostra nada
                            // Calcula a porcentagem
                            let sum = 0;
                            let dataArr = ctx.chart.data.datasets[0].data;
                            dataArr.map(data => { sum += data; });
                            let percentage = (value*100 / sum).toFixed(0)+"%";
                            return percentage;
                        }
                    }
                }, 
                cutout: '60%' 
            }
        });
    }

    const ctxLine = document.getElementById('lineChart');
    if (lineChartInstance) lineChartInstance.destroy();
    const expensesByDay = {};
    const [ano, mes] = monthFilter.value.split('-');
    const diasNoMes = new Date(ano, mes, 0).getDate();
    for(let i=1; i<=diasNoMes; i++) { expensesByDay[i] = 0; }
    transactions.filter(t => t.amount < 0).forEach(t => {
        const dia = parseInt(t.date.split('-')[2]);
        expensesByDay[dia] += Math.abs(t.amount);
    });
    lineChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: Object.keys(expensesByDay),
            datasets: [{ label: 'Gastos Diários', data: Object.values(expensesByDay), borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.4, fill: true, pointRadius: 2 }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { y: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => 'R$' + v } }, x: { grid: { display: false }, ticks: { color: textColor } } }, 
            plugins: { 
                legend: { display: false },
                datalabels: { display: false } // Desativa labels no gráfico de linha pra não poluir
            } 
        }
    });
}

function renderList(transactions) {
    listElement.innerHTML = '';
    if (transactions.length === 0) { listElement.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">Vazio.</td></tr>'; return; }
    transactions.forEach(t => {
        const conf = categoryConfig[t.category] || categoryConfig['other'];
        const isExpense = t.amount < 0;
        let fonteIcone = '';
        if(t.source && t.source !== 'wallet') fonteIcone = '<i data-lucide="credit-card" class="w-3 h-3 text-indigo-500 ml-1"></i>';

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition border-b border-gray-100 dark:border-gray-700";
        row.innerHTML = `
            <td class="p-4"><div class="flex items-center gap-2"><div class="p-2 rounded ${conf.bg} dark:bg-opacity-20 ${conf.color}"><i data-lucide="${conf.icon}" class="w-4 h-4"></i></div><span class="text-sm dark:text-gray-200">${conf.label}</span></div></td>
            <td class="p-4 text-sm dark:text-gray-300 flex items-center">${t.desc} ${fonteIcone}</td>
            <td class="p-4 text-sm text-gray-500">${formatarData(t.date)}</td>
            <td class="p-4 text-right font-bold text-sm ${isExpense ? 'text-red-500' : 'text-green-500'}">${Math.abs(t.amount).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
            <td class="p-4 text-center flex justify-center gap-2">
                <button onclick="prepararEdicao('${t.id}')" aria-label="Editar" class="text-gray-400 hover:text-indigo-500 transition cursor-pointer"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button onclick="deletarItem('${t.id}')" aria-label="Excluir" class="text-gray-400 hover:text-red-500 transition cursor-pointer"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>`;
        listElement.appendChild(row);
    });
    if(window.lucide) lucide.createIcons();
}

function renderValues(transactions) {
    const amounts = transactions.map(t => t.amount);
    const total = amounts.reduce((acc, item) => acc + item, 0);
    const income = amounts.filter(item => item > 0).reduce((acc, item) => acc + item, 0);
    const expense = amounts.filter(item => item < 0).reduce((acc, item) => acc + item, 0);
    const format = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    document.getElementById('display-total').innerText = format(total);
    document.getElementById('display-income').innerText = format(income);
    document.getElementById('display-expense').innerText = format(Math.abs(expense));
}

function formatarData(d) { try { const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; } catch { return d; } }
function showToast(msg) { 
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = "bg-emerald-500 text-white px-4 py-3 rounded shadow flex items-center gap-2 toast-enter";
    t.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> ${msg}`;
    c.appendChild(t); setTimeout(() => t.remove(), 3000);
}