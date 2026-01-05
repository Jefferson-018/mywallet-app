import { auth, db, provider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "./firebase.js";

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

// Elementos
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loadingScreen = document.getElementById('loading-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const form = document.getElementById('transaction-form');
const listElement = document.getElementById('transaction-list');
const monthFilter = document.getElementById('month-filter');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

let donutChartInstance = null;
let lineChartInstance = null; 
let currentUser = null;
let unsubscribe = null;
let allTransactions = []; 
let filteredTransactions = []; 

const dateInput = document.getElementById('date');
if(dateInput) dateInput.valueAsDate = new Date();

if(window.lucide) lucide.createIcons();

// --- DARK MODE ---
const userTheme = localStorage.getItem('theme');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (userTheme === 'dark' || (!userTheme && systemTheme)) {
    document.documentElement.classList.add('dark');
    if(themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
}
if(themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
        if(donutChartInstance) renderCharts(filteredTransactions); 
    });
}

// --- HELPER FUNCTIONS ---
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
    return valorString.replace(/\D/g, "") / 100;
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

// --- AUTH (COM POPUP) ---
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
    } else {
        currentUser = null;
        toggleLoading(false);
        loginScreen.classList.remove('hidden');
        loginScreen.classList.add('flex');
        appScreen.classList.add('hidden');
        if (unsubscribe) unsubscribe();
        listElement.innerHTML = '';
        renderValues([]);
    }
});

// --- SALVAR ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const desc = document.getElementById('desc').value;
    const amountVal = limparValorMoeda(document.getElementById('amount').value);
    if(amountVal <= 0) return alert("Valor inválido");
    const dateVal = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    const type = categoryConfig[category].type;
    const finalAmount = type === 'expense' ? -Math.abs(amountVal) : Math.abs(amountVal);

    try {
        await addDoc(collection(db, "transactions"), { uid: currentUser.uid, desc: desc, amount: finalAmount, date: dateVal, category: category, createdAt: new Date() });
        showToast("Salvo!");
        if(monthFilter && dateVal && monthFilter.value !== dateVal.slice(0, 7)) {
            monthFilter.value = dateVal.slice(0, 7);
            aplicarFiltro();
        }
        form.reset();
        document.getElementById('date').valueAsDate = new Date();
    } catch (e) { alert("Erro ao salvar"); }
});

// --- CARREGAR ---
function carregarDados(uid) {
    const q = query(collection(db, "transactions"), where("uid", "==", uid));
    unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = [];
        snapshot.forEach(doc => { 
            const data = doc.data();
            let dataCorrigida = data.date;
            if(data.date && data.date.seconds) {
                try { dataCorrigida = new Date(data.date.seconds * 1000).toISOString().split('T')[0]; } catch(e) {}
            }
            transactions.push({ id: doc.id, ...data, date: dataCorrigida }); 
        });
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        allTransactions = transactions;
        aplicarFiltro();
        toggleLoading(false);
    });
}

function aplicarFiltro() {
    const mesSelecionado = monthFilter.value; 
    if (!mesSelecionado) { filteredTransactions = allTransactions; } 
    else { filteredTransactions = allTransactions.filter(t => t.date && t.date.startsWith(mesSelecionado)); }
    
    renderList(filteredTransactions);
    renderValues(filteredTransactions);
    renderCharts(filteredTransactions); 
}

// --- RENDERIZAR GRÁFICOS (LINHA E ROSCA) ---
function renderCharts(transactions) {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    // 1. Gráfico de Rosca (Categorias)
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
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor } } }, cutout: '70%' }
        });
    }

    // 2. Gráfico de Linha (Evolução Diária)
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

    const labels = Object.keys(expensesByDay);
    const data = Object.values(expensesByDay);

    lineChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gastos Diários',
                data: data,
                borderColor: '#6366f1', 
                backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                tension: 0.4, 
                fill: true,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => 'R$' + v } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` R$ ${c.raw.toLocaleString('pt-BR')}` } } }
        }
    });
}

function renderList(transactions) {
    listElement.innerHTML = '';
    if (transactions.length === 0) { listElement.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">Vazio.</td></tr>'; return; }
    transactions.forEach(t => {
        const conf = categoryConfig[t.category] || categoryConfig['other'];
        const isExpense = t.amount < 0;
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition border-b border-gray-100 dark:border-gray-700";
        row.innerHTML = `
            <td class="p-4"><div class="flex items-center gap-2"><div class="p-2 rounded ${conf.bg} dark:bg-opacity-20 ${conf.color}"><i data-lucide="${conf.icon}" class="w-4 h-4"></i></div><span class="text-sm dark:text-gray-200">${conf.label}</span></div></td>
            <td class="p-4 text-sm dark:text-gray-300">${t.desc}</td>
            <td class="p-4 text-sm text-gray-500">${formatarData(t.date)}</td>
            <td class="p-4 text-right font-bold text-sm ${isExpense ? 'text-red-500' : 'text-green-500'}">${Math.abs(t.amount).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
            <td class="p-4 text-center"><button onclick="deletarItem('${t.id}')"><i data-lucide="trash-2" class="w-4 h-4 text-gray-400 hover:text-red-500"></i></button></td>`;
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

window.deletarItem = async (id) => { if(confirm("Apagar?")) await deleteDoc(doc(db, "transactions", id)); }
window.prepararEdicao = (id, d, a, dt) => { 
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-desc').value = d;
    document.getElementById('edit-amount').value = a.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById('edit-date').value = dt;
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
    try { await updateDoc(doc(db, "transactions", id), { desc: desc, amount: finalAmount, date: dateVal }); fecharModal(); } catch (e) { alert("Erro"); }
});
window.exportarCSV = () => { /* Mesma lógica CSV */ }