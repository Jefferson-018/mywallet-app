import { auth, db, provider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "./firebase.js";

// --- CONFIGURAÇÕES ---
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

// Elementos Globais
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loadingScreen = document.getElementById('loading-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const form = document.getElementById('transaction-form');
const listElement = document.getElementById('transaction-list');
const monthFilter = document.getElementById('month-filter');
const categorySummaryElement = document.getElementById('category-summary');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

let chartInstance = null;
let currentUser = null;
let unsubscribe = null;
let allTransactions = []; 
let filteredTransactions = []; 

const dateInput = document.getElementById('date');
if(dateInput) dateInput.valueAsDate = new Date();

if(window.lucide) lucide.createIcons();

// --- 1. LÓGICA DO DARK MODE ---
const userTheme = localStorage.getItem('theme');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (userTheme === 'dark' || (!userTheme && systemTheme)) {
    document.documentElement.classList.add('dark');
    if(themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
} else {
    document.documentElement.classList.remove('dark');
    if(themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
}

if(themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const iconName = isDark ? 'sun' : 'moon';
        themeIcon.setAttribute('data-lucide', iconName);
        lucide.createIcons();
        if(chartInstance) renderChart(filteredTransactions);
    });
}

// --- 2. LOADING ---
function toggleLoading(show) {
    if(show) {
        loadingScreen.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        loadingScreen.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => loadingScreen.style.display = 'none', 500);
    }
}

// --- MÁSCARA DE MOEDA ---
window.formatarMoedaInput = (input) => {
    let value = input.value.replace(/\D/g, "");
    value = (Number(value) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    input.value = value;
}

function limparValorMoeda(valorString) {
    if (!valorString) return 0;
    return valorString.replace(/\D/g, "") / 100;
}

// --- POPULAR MESES ---
function popularSeletorMeses() {
    if(!monthFilter) return;
    monthFilter.innerHTML = ''; 
    const hoje = new Date();
    const dataInicio = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1);
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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

// --- LOGIN COM POPUP (CORREÇÃO DE LOOP) ---
loginBtn.addEventListener('click', async () => {
    try { 
        // AQUI MUDOU: De Redirect para Popup
        await signInWithPopup(auth, provider); 
    } 
    catch (e) { 
        console.error(e);
        // Evita mostrar alerta se o usuário fechar a janela
        if (e.code !== 'auth/popup-closed-by-user') {
            alert("Erro login: " + e.message); 
        }
    }
});

logoutBtn.addEventListener('click', () => {
    toggleLoading(true);
    signOut(auth);
});

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
    if(amountVal <= 0) return alert("Digite um valor válido!");

    const dateVal = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    const type = categoryConfig[category].type;
    const finalAmount = type === 'expense' ? -Math.abs(amountVal) : Math.abs(amountVal);

    try {
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid, desc: desc, amount: finalAmount, date: dateVal, category: category, createdAt: new Date()
        });
        showToast("Lançamento adicionado!");
        
        if(monthFilter && dateVal) {
            const mesDoLancamento = dateVal.slice(0, 7);
            let existe = false;
            for(let opt of monthFilter.options) { if(opt.value === mesDoLancamento) existe = true; }
            if(existe && monthFilter.value !== mesDoLancamento) {
                monthFilter.value = mesDoLancamento;
                aplicarFiltro();
            }
        }
        form.reset();
        document.getElementById('date').valueAsDate = new Date();
    } catch (error) { console.error(error); alert("Erro ao salvar"); }
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
                try { dataCorrigida = new Date(data.date.seconds * 1000).toISOString().split('T')[0]; } 
                catch(e) { dataCorrigida = new Date().toISOString().split('T')[0]; }
            }
            transactions.push({ id: doc.id, ...data, date: dataCorrigida }); 
        });
        transactions.sort((a, b) => {
            const dateA = a.date ? new Date(a.date) : new Date(0);
            const dateB = b.date ? new Date(b.date) : new Date(0);
            return dateB - dateA;
        });
        allTransactions = transactions;
        aplicarFiltro();
        toggleLoading(false);
    });
}

function aplicarFiltro() {
    const mesSelecionado = monthFilter.value; 
    if (!mesSelecionado) { filteredTransactions = allTransactions; } 
    else { filteredTransactions = allTransactions.filter(t => { if(!t.date) return false; return t.date.startsWith(mesSelecionado); }); }
    
    renderList(filteredTransactions);
    renderValues(filteredTransactions);
    renderChart(filteredTransactions);
    renderCategorySummary(filteredTransactions);
}

function renderList(transactions) {
    listElement.innerHTML = '';
    if (transactions.length === 0) {
        listElement.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400 dark:text-gray-500">Nenhuma movimentação neste período.</td></tr>';
        return;
    }
    transactions.forEach(t => {
        const conf = categoryConfig[t.category] || categoryConfig['other'];
        const isExpense = t.amount < 0;
        const amountClass = isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
        const dataFormatada = formatarData(t.date);

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition border-b border-gray-50 dark:border-gray-700 last:border-0";
        row.innerHTML = `
            <td class="p-4"><div class="flex items-center gap-3"><div class="p-2 rounded-lg ${conf.bg} dark:bg-opacity-20 ${conf.color}"><i data-lucide="${conf.icon}" class="w-4 h-4"></i></div><span class="font-medium text-sm text-gray-700 dark:text-gray-200 hidden sm:inline">${conf.label}</span></div></td>
            <td class="p-4 font-medium text-gray-900 dark:text-white text-sm">${t.desc || 'Sem descrição'}</td>
            <td class="p-4 text-sm text-gray-500 dark:text-gray-400">${dataFormatada}</td>
            <td class="p-4 text-right font-bold text-sm ${amountClass}">${isExpense ? '-' : '+'} ${Math.abs(t.amount).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
            <td class="p-4 text-center flex justify-center gap-2">
                <button onclick="prepararEdicao('${t.id}', '${t.desc}', ${t.amount}, '${t.date}')" class="text-gray-400 hover:text-indigo-500 transition" aria-label="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button onclick="deletarItem('${t.id}')" class="text-gray-400 hover:text-red-500 transition" aria-label="Excluir"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>`;
        listElement.appendChild(row);
    });
    if(window.lucide) lucide.createIcons();
}

function renderCategorySummary(transactions) {
    categorySummaryElement.innerHTML = '';
    const expenses = transactions.filter(t => t.amount < 0);
    if(expenses.length === 0) {
        categorySummaryElement.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Sem gastos neste mês.</p>';
        return;
    }
    const totals = {};
    let totalExpenses = 0;
    expenses.forEach(t => {
        const cat = t.category;
        const val = Math.abs(t.amount);
        if(!totals[cat]) totals[cat] = 0;
        totals[cat] += val;
        totalExpenses += val;
    });
    const sortedCats = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    sortedCats.forEach(cat => {
        const conf = categoryConfig[cat] || categoryConfig['other'];
        const val = totals[cat];
        const percent = Math.round((val / totalExpenses) * 100);
        const item = document.createElement('div');
        item.className = "flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition";
        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="p-1.5 rounded-md ${conf.bg} dark:bg-opacity-20 ${conf.color}">
                    <i data-lucide="${conf.icon}" class="w-4 h-4"></i>
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-200">${conf.label}</p>
                    <div class="w-24 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                        <div class="h-full ${conf.color.replace('text-', 'bg-')}" style="width: ${percent}%"></div>
                    </div>
                </div>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold text-gray-900 dark:text-white">${val.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                <p class="text-xs text-gray-400">${percent}%</p>
            </div>
        `;
        categorySummaryElement.appendChild(item);
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
    const balMsg = document.getElementById('balance-msg');
    if(total < 0) { 
        balMsg.innerHTML = '<i data-lucide="alert-circle" class="w-3 h-3"></i> Saldo Negativo'; 
        balMsg.className = "text-xs text-red-200 mt-2 flex items-center gap-1 font-bold"; 
    } else { 
        balMsg.innerHTML = 'Balanço positivo'; 
        balMsg.className = "text-xs text-indigo-200 mt-2 flex items-center gap-1"; 
    }
}

function renderChart(transactions) {
    const ctx = document.getElementById('expenseChart');
    const noData = document.getElementById('no-data-msg');
    if(!ctx) return;
    const income = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const expense = Math.abs(transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
    if (income === 0 && expense === 0) { 
        ctx.style.display = 'none'; 
        if(noData) noData.classList.remove('hidden'); 
        if(chartInstance) { chartInstance.destroy(); chartInstance = null; } 
        return; 
    }
    ctx.style.display = 'block'; 
    if(noData) noData.classList.add('hidden');
    if (chartInstance) chartInstance.destroy();
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e5e7eb' : '#374151';
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Entradas', 'Saídas'], datasets: [{ data: [income, expense], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0, hoverOffset: 4 }] },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom', labels: { color: textColor, usePointStyle: true, font: { family: 'Inter', size: 12 } } }, 
                tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}` } } 
            }, 
            cutout: '70%' 
        }
    });
}

function formatarData(dateValue) {
    try {
        if (dateValue && typeof dateValue === 'string' && dateValue.includes('-')) {
            const parts = dateValue.split('-'); 
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else { return new Date().toLocaleDateString('pt-BR'); }
    } catch (e) { return "Data Inválida"; }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    const colors = type === 'error' ? 'bg-red-500' : 'bg-emerald-500';
    const icon = type === 'error' ? 'alert-circle' : 'check-circle';
    toast.className = `${colors} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 toast-enter min-w-[300px] z-[100]`;
    toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i><span class="font-medium text-sm">${msg}</span>`;
    container.appendChild(toast);
    if(window.lucide) lucide.createIcons();
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.deletarItem = async (id) => { if(confirm("Apagar registro?")) { await deleteDoc(doc(db, "transactions", id)); showToast("Registro apagado!"); } }
window.prepararEdicao = (id, desc, amount, date) => {
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-desc').value = desc;
    const valorFormatado = amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    document.getElementById('edit-amount').value = valorFormatado;
    document.getElementById('edit-date').value = date;
}
window.fecharModal = () => { document.getElementById('edit-modal').classList.add('hidden'); }
document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const desc = document.getElementById('edit-desc').value;
    const amountVal = limparValorMoeda(document.getElementById('edit-amount').value);
    const dateVal = document.getElementById('edit-date').value;
    const original = allTransactions.find(t => t.id === id);
    const isExpense = original && original.amount < 0;
    const finalAmount = isExpense ? -Math.abs(amountVal) : Math.abs(amountVal);
    try {
        const docRef = doc(db, "transactions", id);
        await updateDoc(docRef, { desc: desc, amount: finalAmount, date: dateVal });
        showToast("Registro atualizado!");
        fecharModal();
    } catch (error) { showToast("Erro ao editar", 'error'); }
});
window.exportarCSV = () => {
    if(!filteredTransactions.length) return showToast("Nada para exportar!", 'error');
    let csvContent = "\uFEFFData;Descrição;Categoria;Valor\n";
    filteredTransactions.forEach(t => {
        const val = parseFloat(t.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        const safeDesc = (t.desc || "").replace(/;/g, " ").replace(/[\r\n]+/g, " ");
        const dataCerta = formatarData(t.date);
        let catTraduzida = t.category;
        if(categoryConfig[t.category]) { catTraduzida = categoryConfig[t.category].label; }
        csvContent += `${dataCerta};${safeDesc};${catTraduzida};${val}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "extrato_mywallet_br.csv";
    document.body.appendChild(link);
    link.click();
}